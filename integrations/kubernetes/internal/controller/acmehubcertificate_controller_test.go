package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
)

var _ = Describe("ACMEHubCertificate Controller", func() {
	const (
		timeout  = time.Second * 30
		interval = time.Millisecond * 250
	)

	var mockServer *httptest.Server

	BeforeEach(func() {
		// Create a mock acme-hub server
		mockServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/pki/v1/certificates/issue" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			now := time.Now().UTC().Truncate(time.Second)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"commonName":  "test.example.com",
				"sans":        []string{"test.example.com"},
				"privateKey":  "-----BEGIN PRIVATE KEY-----\nfake-key\n-----END PRIVATE KEY-----",
				"certificate": "-----BEGIN CERTIFICATE-----\nfake-cert\n-----END CERTIFICATE-----",
				"chain":       "-----BEGIN CERTIFICATE-----\nfake-chain\n-----END CERTIFICATE-----",
				"fullchain":   "-----BEGIN CERTIFICATE-----\nfake-fullchain\n-----END CERTIFICATE-----",
				"notBefore":   now.Format(time.RFC3339),
				"notAfter":    now.Add(90 * 24 * time.Hour).Format(time.RFC3339),
			})
		}))
	})

	AfterEach(func() {
		mockServer.Close()
	})

	Context("When reconciling a certificate with a namespaced consumer", func() {
		const (
			consumerName  = "test-consumer"
			secretName    = "test-token-secret"
			certName      = "test-cert"
			tlsSecretName = "test-tls-secret"
			consumerNS    = "default"
		)

		BeforeEach(func() {
			// Create token Secret
			tokenSecret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      secretName,
					Namespace: consumerNS,
				},
				StringData: map[string]string{
					"token": "test-token-123",
				},
			}
			Expect(k8sClient.Create(ctx, tokenSecret)).Should(Succeed())

			// Create ACMEHubConsumer
			consumer := &acmev1alpha1.ACMEHubConsumer{
				ObjectMeta: metav1.ObjectMeta{
					Name:      consumerName,
					Namespace: consumerNS,
				},
				Spec: acmev1alpha1.ACMEHubConsumerSpec{
					Endpoint: mockServer.URL,
					SecretRef: acmev1alpha1.SecretReference{
						Name: secretName,
					},
				},
			}
			Expect(k8sClient.Create(ctx, consumer)).Should(Succeed())
		})

		AfterEach(func() {
			// Clean up
			cert := &acmev1alpha1.ACMEHubCertificate{}
			err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, cert)
			if err == nil {
				k8sClient.Delete(ctx, cert)
			}

			tlsSecret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, tlsSecret)
			if err == nil {
				k8sClient.Delete(ctx, tlsSecret)
			}

			consumer := &acmev1alpha1.ACMEHubConsumer{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: consumerName, Namespace: consumerNS}, consumer)
			if err == nil {
				k8sClient.Delete(ctx, consumer)
			}

			secret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: secretName, Namespace: consumerNS}, secret)
			if err == nil {
				k8sClient.Delete(ctx, secret)
			}
		})

		It("Should issue certificate and create TLS Secret", func() {
			By("Creating an ACMEHubCertificate")
			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{
					Name:      certName,
					Namespace: consumerNS,
				},
				Spec: acmev1alpha1.ACMEHubCertificateSpec{
					ConsumerRef: acmev1alpha1.ConsumerReference{
						Kind: "ACMEHubConsumer",
						Name: consumerName,
					},
					SecretName: tlsSecretName,
					Domains:    []string{"test.example.com"},
				},
			}
			Expect(k8sClient.Create(ctx, cert)).Should(Succeed())

			By("Waiting for the TLS Secret to be created")
			Eventually(func() bool {
				secret := &corev1.Secret{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, secret)
				return err == nil
			}, timeout, interval).Should(BeTrue())

			By("Verifying the TLS Secret contents")
			secret := &corev1.Secret{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, secret)).Should(Succeed())
			Expect(secret.Type).Should(Equal(corev1.SecretTypeTLS))
			Expect(secret.Data).Should(HaveKey("tls.crt"))
			Expect(secret.Data).Should(HaveKey("tls.key"))
			Expect(string(secret.Data["tls.crt"])).Should(ContainSubstring("fake-fullchain"))
			Expect(string(secret.Data["tls.key"])).Should(ContainSubstring("fake-key"))

			By("Verifying the owner reference is set")
			Expect(secret.OwnerReferences).Should(HaveLen(1))
			Expect(secret.OwnerReferences[0].Name).Should(Equal(certName))
			Expect(secret.OwnerReferences[0].Kind).Should(Equal("ACMEHubCertificate"))

			By("Verifying the status is Ready")
			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated)
				if err != nil {
					return false
				}
				ready := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
				return ready != nil && ready.Status == metav1.ConditionTrue
			}, timeout, interval).Should(BeTrue())

			By("Verifying status fields are populated")
			updated := &acmev1alpha1.ACMEHubCertificate{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated)).Should(Succeed())
			Expect(updated.Status.CommonName).Should(Equal("test.example.com"))
			Expect(updated.Status.NotBefore).ShouldNot(BeNil())
			Expect(updated.Status.NotAfter).ShouldNot(BeNil())
			Expect(updated.Status.LastSyncTime).ShouldNot(BeNil())
			Expect(updated.Status.ObservedGeneration).Should(Equal(updated.Generation))
		})
	})

	Context("When the issue endpoint returns an error", func() {
		const (
			certName   = "test-cert-error"
			consumerNS = "default"
		)

		BeforeEach(func() {
			// Override mock server to return errors
			mockServer.Close()
			mockServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusPreconditionFailed)
				json.NewEncoder(w).Encode(map[string]any{
					"status": 412,
					"error":  "domain not registered",
				})
			}))

			// Create token Secret
			tokenSecret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "error-token-secret",
					Namespace: consumerNS,
				},
				StringData: map[string]string{
					"token": "test-token",
				},
			}
			Expect(k8sClient.Create(ctx, tokenSecret)).Should(Succeed())

			// Create consumer
			consumer := &acmev1alpha1.ACMEHubConsumer{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "error-consumer",
					Namespace: consumerNS,
				},
				Spec: acmev1alpha1.ACMEHubConsumerSpec{
					Endpoint: mockServer.URL,
					SecretRef: acmev1alpha1.SecretReference{
						Name: "error-token-secret",
					},
				},
			}
			Expect(k8sClient.Create(ctx, consumer)).Should(Succeed())
		})

		AfterEach(func() {
			cert := &acmev1alpha1.ACMEHubCertificate{}
			err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, cert)
			if err == nil {
				k8sClient.Delete(ctx, cert)
			}
			consumer := &acmev1alpha1.ACMEHubConsumer{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: "error-consumer", Namespace: consumerNS}, consumer)
			if err == nil {
				k8sClient.Delete(ctx, consumer)
			}
			secret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: "error-token-secret", Namespace: consumerNS}, secret)
			if err == nil {
				k8sClient.Delete(ctx, secret)
			}
		})

		It("Should set Ready=False with IssueFailed reason", func() {
			By("Creating an ACMEHubCertificate")
			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{
					Name:      certName,
					Namespace: consumerNS,
				},
				Spec: acmev1alpha1.ACMEHubCertificateSpec{
					ConsumerRef: acmev1alpha1.ConsumerReference{
						Kind: "ACMEHubConsumer",
						Name: "error-consumer",
					},
					SecretName: "error-tls-secret",
					Domains:    []string{"bad.example.com"},
				},
			}
			Expect(k8sClient.Create(ctx, cert)).Should(Succeed())

			By("Waiting for Ready condition to be False")
			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated)
				if err != nil {
					return false
				}
				ready := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
				return ready != nil && ready.Status == metav1.ConditionFalse && ready.Reason == "IssueFailed"
			}, timeout, interval).Should(BeTrue())
		})
	})

	Context("When consumer does not exist", func() {
		const (
			certName   = "test-cert-no-consumer"
			consumerNS = "default"
		)

		AfterEach(func() {
			cert := &acmev1alpha1.ACMEHubCertificate{}
			err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, cert)
			if err == nil {
				k8sClient.Delete(ctx, cert)
			}
		})

		It("Should set Ready=False with ConsumerNotReady reason", func() {
			By("Creating an ACMEHubCertificate referencing a non-existent consumer")
			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{
					Name:      certName,
					Namespace: consumerNS,
				},
				Spec: acmev1alpha1.ACMEHubCertificateSpec{
					ConsumerRef: acmev1alpha1.ConsumerReference{
						Kind: "ACMEHubConsumer",
						Name: "nonexistent-consumer",
					},
					SecretName: "no-consumer-tls-secret",
					Domains:    []string{"test.example.com"},
				},
			}
			Expect(k8sClient.Create(ctx, cert)).Should(Succeed())

			By("Waiting for Ready condition to be False with ConsumerNotReady")
			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated)
				if err != nil {
					return false
				}
				ready := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
				return ready != nil && ready.Status == metav1.ConditionFalse && ready.Reason == "ConsumerNotReady"
			}, timeout, interval).Should(BeTrue())
		})
	})
})
