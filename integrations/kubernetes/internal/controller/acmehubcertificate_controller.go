package controller

import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/workqueue"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	acmev1alpha1 "github.com/geektr-cloud/acmehub-syncer/api/v1alpha1"
	"github.com/geektr-cloud/acmehub-syncer/internal/acmehub"
	"github.com/geektr-cloud/acmehub-syncer/internal/schedule"
)

const finalizerName = "acme.geektr.cloud/finalizer"

// ACMEHubCertificateReconciler reconciles an ACMEHubCertificate object.
type ACMEHubCertificateReconciler struct {
	client.Client
	Scheme                   *runtime.Scheme
	Recorder                 record.EventRecorder
	ClusterResourceNamespace string
}

// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubcertificates,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubcertificates/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubcertificates/finalizers,verbs=update
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch
// +kubebuilder:rbac:groups="",resources=events,verbs=create;patch

func (r *ACMEHubCertificateReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)
	now := time.Now()

	cert := &acmev1alpha1.ACMEHubCertificate{}
	if err := r.Get(ctx, req.NamespacedName, cert); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	// Handle deletion finalizer
	if !cert.DeletionTimestamp.IsZero() {
		if controllerutil.ContainsFinalizer(cert, finalizerName) {
			secret := &corev1.Secret{}
			secretKey := types.NamespacedName{
				Namespace: cert.Namespace,
				Name:      cert.Spec.SecretName,
			}
			if err := r.Get(ctx, secretKey, secret); err == nil {
				if err := r.Delete(ctx, secret); err != nil {
					return ctrl.Result{}, fmt.Errorf("delete secret: %w", err)
				}
			}
			controllerutil.RemoveFinalizer(cert, finalizerName)
			if err := r.Update(ctx, cert); err != nil {
				return ctrl.Result{}, fmt.Errorf("remove finalizer: %w", err)
			}
		}
		return ctrl.Result{}, nil
	}

	// Add finalizer if not present
	if !controllerutil.ContainsFinalizer(cert, finalizerName) {
		controllerutil.AddFinalizer(cert, finalizerName)
		if err := r.Update(ctx, cert); err != nil {
			return ctrl.Result{}, fmt.Errorf("add finalizer: %w", err)
		}
	}

	// Resolve consumer
	endpoint, token, err := r.resolveConsumer(ctx, cert)
	if err != nil {
		logger.Error(err, "failed to resolve consumer")
		setCondition(&cert.Status.Conditions, "Ready", metav1.ConditionFalse, "ConsumerNotReady", err.Error())
		r.Recorder.Event(cert, corev1.EventTypeWarning, "ConsumerNotReady", err.Error())
		if err := r.Status().Update(ctx, cert); err != nil {
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, err
	}

	// Issue certificate
	acmeClient := acmehub.NewClient()
	issueResp, err := acmeClient.Issue(ctx, endpoint, token, cert.Spec.Domains)
	if err != nil {
		logger.Error(err, "failed to issue certificate")
		setCondition(&cert.Status.Conditions, "Ready", metav1.ConditionFalse, "IssueFailed", err.Error())
		r.Recorder.Event(cert, corev1.EventTypeWarning, "IssueFailed", err.Error())
		if err := r.Status().Update(ctx, cert); err != nil {
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, err
	}

	// Build TLS Secret
	secret := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cert.Spec.SecretName,
			Namespace: cert.Namespace,
		},
	}

	desiredData := map[string][]byte{
		"tls.crt": []byte(issueResp.Fullchain),
		"tls.key": []byte(issueResp.PrivateKey),
	}

	result, err := controllerutil.CreateOrUpdate(ctx, r.Client, secret, func() error {
		if string(secret.Data["tls.crt"]) == issueResp.Fullchain &&
			string(secret.Data["tls.key"]) == issueResp.PrivateKey {
			return nil
		}

		secret.Type = corev1.SecretTypeTLS
		secret.Data = desiredData
		return ctrl.SetControllerReference(cert, secret, r.Scheme)
	})
	if err != nil {
		setCondition(&cert.Status.Conditions, "Ready", metav1.ConditionFalse, "SecretWriteError", err.Error())
		r.Recorder.Event(cert, corev1.EventTypeWarning, "SecretWriteError", err.Error())
		if err := r.Status().Update(ctx, cert); err != nil {
			return ctrl.Result{}, err
		}
		return ctrl.Result{}, err
	}

	logger.Info("secret reconciled", "operation", result)

	notBefore := metav1.NewTime(issueResp.NotBefore)
	notAfter := metav1.NewTime(issueResp.NotAfter)
	lastSync := metav1.NewTime(now)

	cert.Status.NotBefore = &notBefore
	cert.Status.NotAfter = &notAfter
	cert.Status.LastSyncTime = &lastSync
	cert.Status.ObservedGeneration = cert.Generation
	cert.Status.CommonName = issueResp.CommonName
	setCondition(&cert.Status.Conditions, "Ready", metav1.ConditionTrue, "Synced", "Certificate synced successfully")

	if err := r.Status().Update(ctx, cert); err != nil {
		return ctrl.Result{}, err
	}

	r.Recorder.Event(cert, corev1.EventTypeNormal, "Synced", "Certificate synced for "+cert.Spec.Domains[0])

	_, after := schedule.RequeueAfter(issueResp.NotBefore, issueResp.NotAfter, now)
	if after < time.Minute {
		after = time.Minute
	}

	return ctrl.Result{RequeueAfter: after}, nil
}

func (r *ACMEHubCertificateReconciler) resolveConsumer(ctx context.Context, cert *acmev1alpha1.ACMEHubCertificate) (endpoint, token string, err error) {
	kind := cert.Spec.ConsumerRef.Kind
	if kind == "" {
		kind = "ACMEHubConsumer"
	}

	var tokenSecretNamespace string
	var tokenSecretName string

	switch kind {
	case "ACMEHubConsumer":
		consumer := &acmev1alpha1.ACMEHubConsumer{}
		key := types.NamespacedName{Namespace: cert.Namespace, Name: cert.Spec.ConsumerRef.Name}
		if err := r.Get(ctx, key, consumer); err != nil {
			return "", "", fmt.Errorf("get ACMEHubConsumer %s: %w", key, err)
		}
		endpoint = consumer.Spec.Endpoint
		tokenSecretNamespace = consumer.Namespace
		tokenSecretName = consumer.Spec.SecretRef.Name
	case "ClusterACMEHubConsumer":
		consumer := &acmev1alpha1.ClusterACMEHubConsumer{}
		key := types.NamespacedName{Name: cert.Spec.ConsumerRef.Name}
		if err := r.Get(ctx, key, consumer); err != nil {
			return "", "", fmt.Errorf("get ClusterACMEHubConsumer %s: %w", key, err)
		}
		endpoint = consumer.Spec.Endpoint
		tokenSecretNamespace = r.ClusterResourceNamespace
		tokenSecretName = consumer.Spec.SecretRef.Name
	default:
		return "", "", fmt.Errorf("unknown consumer kind: %s", kind)
	}

	secret := &corev1.Secret{}
	secretKey := types.NamespacedName{Namespace: tokenSecretNamespace, Name: tokenSecretName}
	if err := r.Get(ctx, secretKey, secret); err != nil {
		return "", "", fmt.Errorf("get token secret %s: %w", secretKey, err)
	}

	tokenBytes, ok := secret.Data["token"]
	if !ok {
		return "", "", fmt.Errorf("secret %s missing 'token' key", secretKey)
	}

	return endpoint, string(tokenBytes), nil
}

func (r *ACMEHubCertificateReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		WithOptions(controller.Options{
			RateLimiter: workqueue.NewTypedItemExponentialFailureRateLimiter[reconcile.Request](
				36*time.Second,
				3*time.Hour,
			),
		}).
		For(&acmev1alpha1.ACMEHubCertificate{}).
		Owns(&corev1.Secret{}).
		Named("acmehubcertificate").
		Complete(r)
}
