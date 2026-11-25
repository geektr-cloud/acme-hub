package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/testutil"
)

var _ = Describe("ACMEHubCertificate Controller", func() {
	const (
		timeout  = time.Second * 30
		interval = time.Millisecond * 250
	)

	var mockServer *httptest.Server

	BeforeEach(func() {
		fullchain, privateKey, notBefore, notAfter, err := testutil.Certificate([]string{"test.example.com"})
		Expect(err).NotTo(HaveOccurred())

		// Create a mock acme-hub server. The test client trusts its certificate.
		mockServer = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/pki/v1/certificates/issue" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"commonName":  "test.example.com",
				"sans":        []string{"test.example.com"},
				"privateKey":  privateKey,
				"certificate": fullchain,
				"chain":       fullchain,
				"fullchain":   fullchain,
				"notBefore":   notBefore.Format(time.RFC3339),
				"notAfter":    notAfter.Format(time.RFC3339),
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
				_ = k8sClient.Delete(ctx, cert)
			}

			tlsSecret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, tlsSecret)
			if err == nil {
				_ = k8sClient.Delete(ctx, tlsSecret)
			}

			consumer := &acmev1alpha1.ACMEHubConsumer{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: consumerName, Namespace: consumerNS}, consumer)
			if err == nil {
				_ = k8sClient.Delete(ctx, consumer)
			}

			secret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: secretName, Namespace: consumerNS}, secret)
			if err == nil {
				_ = k8sClient.Delete(ctx, secret)
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
			Expect(string(secret.Data["tls.crt"])).Should(ContainSubstring("BEGIN CERTIFICATE"))
			Expect(string(secret.Data["tls.key"])).Should(ContainSubstring("BEGIN EC PRIVATE KEY"))

			By("Verifying ownership metadata")
			Expect(secret.Annotations).Should(HaveKeyWithValue(managedSecretAnnotation, "true"))
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

		It("Should refuse to overwrite an unmanaged TLS Secret", func() {
			existing := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{Name: tlsSecretName, Namespace: consumerNS},
				Type:       corev1.SecretTypeTLS,
				Data: map[string][]byte{
					"tls.crt": []byte("keep-cert"),
					"tls.key": []byte("keep-key"),
				},
			}
			Expect(k8sClient.Create(ctx, existing)).Should(Succeed())

			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{Name: certName, Namespace: consumerNS},
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

			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated); err != nil {
					return false
				}
				ready := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
				return ready != nil &&
					ready.Status == metav1.ConditionFalse &&
					ready.Reason == "SecretWriteError"
			}, timeout, interval).Should(BeTrue())

			unchanged := &corev1.Secret{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, unchanged)).Should(Succeed())
			Expect(string(unchanged.Data["tls.crt"])).Should(Equal("keep-cert"))
			Expect(string(unchanged.Data["tls.key"])).Should(Equal("keep-key"))

			Expect(k8sClient.Delete(ctx, cert)).Should(Succeed())
			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				return apierrors.IsNotFound(
					k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated),
				)
			}, timeout, interval).Should(BeTrue())
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, unchanged)).Should(Succeed())
		})

		It("Should adopt an explicitly managed TLS Secret", func() {
			existing := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{
					Name:        tlsSecretName,
					Namespace:   consumerNS,
					Annotations: map[string]string{managedSecretAnnotation: "true"},
				},
				Type: corev1.SecretTypeTLS,
				Data: map[string][]byte{
					"tls.crt": []byte("old-cert"),
					"tls.key": []byte("old-key"),
				},
			}
			Expect(k8sClient.Create(ctx, existing)).Should(Succeed())

			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{Name: certName, Namespace: consumerNS},
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

			Eventually(func() bool {
				updated := &corev1.Secret{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, updated); err != nil {
					return false
				}
				return strings.Contains(string(updated.Data["tls.crt"]), "BEGIN CERTIFICATE") &&
					updated.OwnerReferences != nil &&
					len(updated.OwnerReferences) == 1 &&
					updated.OwnerReferences[0].Name == certName
			}, timeout, interval).Should(BeTrue())
		})

		It("Should delete the owned Secret when the certificate is deleted", func() {
			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{Name: certName, Namespace: consumerNS},
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

			Eventually(func() bool {
				secret := &corev1.Secret{}
				return k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, secret) == nil
			}, timeout, interval).Should(BeTrue())

			Expect(k8sClient.Delete(ctx, cert)).Should(Succeed())
			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				return apierrors.IsNotFound(
					k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated),
				)
			}, timeout, interval).Should(BeTrue())
			Eventually(func() bool {
				secret := &corev1.Secret{}
				return apierrors.IsNotFound(
					k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, secret),
				)
			}, timeout, interval).Should(BeTrue())
		})
	})

	Context("When the token Secret is created after the consumer", func() {
		const (
			consumerName    = "late-consumer"
			certName        = "late-cert"
			tlsSecretName   = "late-tls-secret"
			tokenSecretName = "late-token-secret"
			consumerNS      = "default"
		)

		BeforeEach(func() {
			consumer := &acmev1alpha1.ACMEHubConsumer{
				ObjectMeta: metav1.ObjectMeta{Name: consumerName, Namespace: consumerNS},
				Spec: acmev1alpha1.ACMEHubConsumerSpec{
					Endpoint:  mockServer.URL,
					SecretRef: acmev1alpha1.SecretReference{Name: tokenSecretName},
				},
			}
			Expect(k8sClient.Create(ctx, consumer)).Should(Succeed())

			cert := &acmev1alpha1.ACMEHubCertificate{
				ObjectMeta: metav1.ObjectMeta{Name: certName, Namespace: consumerNS},
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
		})

		AfterEach(func() {
			cert := &acmev1alpha1.ACMEHubCertificate{}
			if err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, cert); err == nil {
				_ = k8sClient.Delete(ctx, cert)
			}
			tlsSecret := &corev1.Secret{}
			if err := k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, tlsSecret); err == nil {
				_ = k8sClient.Delete(ctx, tlsSecret)
			}
			consumer := &acmev1alpha1.ACMEHubConsumer{}
			if err := k8sClient.Get(ctx, types.NamespacedName{Name: consumerName, Namespace: consumerNS}, consumer); err == nil {
				_ = k8sClient.Delete(ctx, consumer)
			}
			tokenSecret := &corev1.Secret{}
			if err := k8sClient.Get(ctx, types.NamespacedName{Name: tokenSecretName, Namespace: consumerNS}, tokenSecret); err == nil {
				_ = k8sClient.Delete(ctx, tokenSecret)
			}
		})

		It("Should retry immediately when the token Secret appears", func() {
			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated); err != nil {
					return false
				}
				ready := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
				return ready != nil &&
					ready.Status == metav1.ConditionFalse &&
					ready.Reason == "ConsumerNotReady"
			}, timeout, interval).Should(BeTrue())

			tokenSecret := &corev1.Secret{
				ObjectMeta: metav1.ObjectMeta{Name: tokenSecretName, Namespace: consumerNS},
				StringData: map[string]string{"token": "late-token"},
			}
			Expect(k8sClient.Create(ctx, tokenSecret)).Should(Succeed())

			Eventually(func() bool {
				updated := &acmev1alpha1.ACMEHubCertificate{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: certName, Namespace: consumerNS}, updated); err != nil {
					return false
				}
				ready := meta.FindStatusCondition(updated.Status.Conditions, "Ready")
				return ready != nil && ready.Status == metav1.ConditionTrue
			}, timeout, interval).Should(BeTrue())

			Eventually(func() bool {
				secret := &corev1.Secret{}
				return k8sClient.Get(ctx, types.NamespacedName{Name: tlsSecretName, Namespace: consumerNS}, secret) == nil
			}, timeout, interval).Should(BeTrue())
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
			mockServer = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusPreconditionFailed)
				_ = json.NewEncoder(w).Encode(map[string]any{
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
				_ = k8sClient.Delete(ctx, cert)
			}
			consumer := &acmev1alpha1.ACMEHubConsumer{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: "error-consumer", Namespace: consumerNS}, consumer)
			if err == nil {
				_ = k8sClient.Delete(ctx, consumer)
			}
			secret := &corev1.Secret{}
			err = k8sClient.Get(ctx, types.NamespacedName{Name: "error-token-secret", Namespace: consumerNS}, secret)
			if err == nil {
				_ = k8sClient.Delete(ctx, secret)
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
				_ = k8sClient.Delete(ctx, cert)
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
