package controller

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/tools/record"
	"k8s.io/client-go/util/workqueue"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/controller"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/acmehub"
	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/schedule"
)

const finalizerName = "acme.geektr.cloud/finalizer"

// ACMEHubCertificateReconciler reconciles an ACMEHubCertificate object.
type ACMEHubCertificateReconciler struct {
	client.Client
	Scheme                   *runtime.Scheme
	Recorder                 record.EventRecorder
	ClusterResourceNamespace string
	AcmeHubProxy             *url.URL
	AllowedEndpoints         []string
	IssueTimeout             time.Duration
	MaxConcurrentReconciles  int

	acmeClient *acmehub.Client
}

// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubcertificates,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubcertificates/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubcertificates/finalizers,verbs=update
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=events,verbs=create;patch

func (r *ACMEHubCertificateReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)
	now := time.Now()

	cert := &acmev1alpha1.ACMEHubCertificate{}
	if err := r.Get(ctx, req.NamespacedName, cert); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	// Handle deletion finalizer. Only delete Secrets this CR controls; a
	// transient read error must not silently orphan the Secret.
	if !cert.DeletionTimestamp.IsZero() {
		if controllerutil.ContainsFinalizer(cert, finalizerName) {
			secret := &corev1.Secret{}
			secretKey := types.NamespacedName{
				Namespace: cert.Namespace,
				Name:      cert.Spec.SecretName,
			}
			if err := r.Get(ctx, secretKey, secret); err != nil {
				if !apierrors.IsNotFound(err) {
					return ctrl.Result{}, fmt.Errorf("get secret: %w", err)
				}
			} else if metav1.IsControlledBy(secret, cert) {
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
		changed, statusErr := r.updateFailureStatus(ctx, cert, "ConsumerNotReady", err.Error())
		if changed {
			r.Recorder.Event(cert, corev1.EventTypeWarning, "ConsumerNotReady", err.Error())
		}
		if statusErr != nil {
			return ctrl.Result{}, errors.Join(err, statusErr)
		}
		return ctrl.Result{}, err
	}

	// Issue certificate
	acmeClient := r.acmeClient
	if acmeClient == nil {
		acmeClient = r.newACMEClient()
	}
	issueResp, err := acmeClient.Issue(ctx, endpoint, token, cert.Spec.Domains)
	if err != nil {
		changed, statusErr := r.updateFailureStatus(ctx, cert, "IssueFailed", err.Error())
		if changed {
			r.Recorder.Event(cert, corev1.EventTypeWarning, "IssueFailed", err.Error())
		}
		if statusErr != nil {
			return ctrl.Result{}, errors.Join(err, statusErr)
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
		if secret.UID != "" {
			if !isManagedSecret(secret, cert) {
				return fmt.Errorf(
					"secret %s/%s already exists and is not managed by acmehub-syncer; add annotation %s=true to adopt it",
					secret.Namespace, secret.Name, managedSecretAnnotation,
				)
			}
			if secret.Type != corev1.SecretTypeTLS {
				return fmt.Errorf(
					"secret %s/%s has type %q, want %q",
					secret.Namespace, secret.Name, secret.Type, corev1.SecretTypeTLS,
				)
			}
		}

		markManagedSecret(secret)
		secret.Type = corev1.SecretTypeTLS
		if string(secret.Data["tls.crt"]) != issueResp.Fullchain ||
			string(secret.Data["tls.key"]) != issueResp.PrivateKey {
			secret.Data = desiredData
		}
		return ctrl.SetControllerReference(cert, secret, r.Scheme)
	})
	if err != nil {
		changed, statusErr := r.updateFailureStatus(ctx, cert, "SecretWriteError", err.Error())
		if changed {
			r.Recorder.Event(cert, corev1.EventTypeWarning, "SecretWriteError", err.Error())
		}
		if statusErr != nil {
			return ctrl.Result{}, errors.Join(err, statusErr)
		}
		return ctrl.Result{}, err
	}

	if result == controllerutil.OperationResultNone {
		logger.V(1).Info("secret unchanged", "operation", result)
	} else {
		logger.Info("secret reconciled", "operation", result)
	}

	notBefore := metav1.NewTime(issueResp.NotBefore)
	notAfter := metav1.NewTime(issueResp.NotAfter)
	statusChanged := result != controllerutil.OperationResultNone

	if cert.Status.NotBefore == nil || !cert.Status.NotBefore.Time.Equal(notBefore.Time) {
		cert.Status.NotBefore = &notBefore
		statusChanged = true
	}
	if cert.Status.NotAfter == nil || !cert.Status.NotAfter.Time.Equal(notAfter.Time) {
		cert.Status.NotAfter = &notAfter
		statusChanged = true
	}
	if result != controllerutil.OperationResultNone || cert.Status.LastSyncTime == nil {
		lastSync := metav1.NewTime(now)
		cert.Status.LastSyncTime = &lastSync
		statusChanged = true
	}
	if cert.Status.ObservedGeneration != cert.Generation {
		cert.Status.ObservedGeneration = cert.Generation
		statusChanged = true
	}
	if cert.Status.CommonName != issueResp.CommonName {
		cert.Status.CommonName = issueResp.CommonName
		statusChanged = true
	}
	if setCondition(&cert.Status.Conditions, "Ready", metav1.ConditionTrue, "Synced", "Certificate synced successfully") {
		statusChanged = true
	}

	if statusChanged {
		if err := r.Status().Update(ctx, cert); err != nil {
			return ctrl.Result{}, err
		}
		r.Recorder.Event(cert, corev1.EventTypeNormal, "Synced", "Certificate synced for "+cert.Spec.Domains[0])
	}

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

	var credentialNamespace string
	var credentialName string

	switch kind {
	case "ACMEHubConsumer":
		consumer := &acmev1alpha1.ACMEHubConsumer{}
		key := types.NamespacedName{Namespace: cert.Namespace, Name: cert.Spec.ConsumerRef.Name}
		if err := r.Get(ctx, key, consumer); err != nil {
			return "", "", fmt.Errorf("get ACMEHubConsumer %s: %w", key, err)
		}
		credentialNamespace = consumer.Namespace
		credentialName = consumer.Spec.SecretRef.Name
	case "ClusterACMEHubConsumer":
		consumer := &acmev1alpha1.ClusterACMEHubConsumer{}
		key := types.NamespacedName{Name: cert.Spec.ConsumerRef.Name}
		if err := r.Get(ctx, key, consumer); err != nil {
			return "", "", fmt.Errorf("get ClusterACMEHubConsumer %s: %w", key, err)
		}
		credentialNamespace = r.ClusterResourceNamespace
		credentialName = consumer.Spec.SecretRef.Name
	default:
		return "", "", fmt.Errorf("unknown consumer kind: %s", kind)
	}

	endpoint, token, err = loadConsumerCredentials(ctx, r.Client, credentialNamespace, credentialName)
	if err != nil {
		return "", "", err
	}
	if err := acmehub.IsEndpointAllowed(endpoint, r.AllowedEndpoints); err != nil {
		return "", "", err
	}

	return endpoint, token, nil
}

func (r *ACMEHubCertificateReconciler) updateFailureStatus(
	ctx context.Context,
	cert *acmev1alpha1.ACMEHubCertificate,
	reason, message string,
) (bool, error) {
	changed := setCondition(&cert.Status.Conditions, "Ready", metav1.ConditionFalse, reason, message)
	if cert.Status.ObservedGeneration != cert.Generation {
		cert.Status.ObservedGeneration = cert.Generation
		changed = true
	}
	if !changed {
		return false, nil
	}
	if err := r.Status().Update(ctx, cert); err != nil {
		return false, err
	}
	return true, nil
}

func (r *ACMEHubCertificateReconciler) newACMEClient() *acmehub.Client {
	c := acmehub.NewClientWithProxy(r.AcmeHubProxy)
	if r.IssueTimeout > 0 {
		c.HTTPClient.Timeout = r.IssueTimeout
	}
	return c
}

func (r *ACMEHubCertificateReconciler) SetupWithManager(mgr ctrl.Manager) error {
	if r.acmeClient == nil {
		r.acmeClient = r.newACMEClient()
	}
	maxConcurrent := r.MaxConcurrentReconciles
	if maxConcurrent < 1 {
		maxConcurrent = 1
	}

	return ctrl.NewControllerManagedBy(mgr).
		WithOptions(controller.Options{
			MaxConcurrentReconciles: maxConcurrent,
			RateLimiter: workqueue.NewTypedItemExponentialFailureRateLimiter[reconcile.Request](
				36*time.Second,
				3*time.Hour,
			),
		}).
		For(&acmev1alpha1.ACMEHubCertificate{}).
		Owns(&corev1.Secret{}).
		Watches(
			&corev1.Secret{},
			handler.EnqueueRequestsFromMapFunc(r.mapSecretToCertificates),
		).
		Watches(
			&acmev1alpha1.ACMEHubConsumer{},
			handler.EnqueueRequestsFromMapFunc(r.mapConsumerToCertificates),
		).
		Watches(
			&acmev1alpha1.ClusterACMEHubConsumer{},
			handler.EnqueueRequestsFromMapFunc(r.mapConsumerToCertificates),
		).
		Named("acmehubcertificate").
		Complete(r)
}

func (r *ACMEHubCertificateReconciler) mapSecretToCertificates(
	ctx context.Context,
	obj client.Object,
) []reconcile.Request {
	secret, ok := obj.(*corev1.Secret)
	if !ok {
		return nil
	}
	for _, ref := range secret.OwnerReferences {
		if ref.Kind == "ACMEHubCertificate" {
			// Owns() already maps the managed TLS Secret.
			return nil
		}
	}

	logger := log.FromContext(ctx)
	var requests []reconcile.Request

	var consumers acmev1alpha1.ACMEHubConsumerList
	if err := r.List(
		ctx,
		&consumers,
		client.InNamespace(secret.Namespace),
		client.MatchingFields{consumerSecretRefIndex: secret.Namespace + "/" + secret.Name},
	); err != nil {
		logger.Error(err, "list ACMEHubConsumers for secret", "secret", secret.Namespace+"/"+secret.Name)
	} else {
		for _, consumer := range consumers.Items {
			requests = append(
				requests,
				r.enqueueCertificatesForConsumer(ctx, "ACMEHubConsumer", consumer.Namespace, consumer.Name)...,
			)
		}
	}

	if secret.Namespace == r.ClusterResourceNamespace {
		var consumers acmev1alpha1.ClusterACMEHubConsumerList
		if err := r.List(
			ctx,
			&consumers,
			client.MatchingFields{clusterConsumerSecretRefIndex: secret.Name},
		); err != nil {
			logger.Error(err, "list ClusterACMEHubConsumers for secret", "secret", secret.Namespace+"/"+secret.Name)
		} else {
			for _, consumer := range consumers.Items {
				requests = append(
					requests,
					r.enqueueCertificatesForConsumer(ctx, "ClusterACMEHubConsumer", "", consumer.Name)...,
				)
			}
		}
	}

	return requests
}

func (r *ACMEHubCertificateReconciler) mapConsumerToCertificates(
	ctx context.Context,
	obj client.Object,
) []reconcile.Request {
	switch consumer := obj.(type) {
	case *acmev1alpha1.ACMEHubConsumer:
		return r.enqueueCertificatesForConsumer(ctx, "ACMEHubConsumer", consumer.Namespace, consumer.Name)
	case *acmev1alpha1.ClusterACMEHubConsumer:
		return r.enqueueCertificatesForConsumer(ctx, "ClusterACMEHubConsumer", "", consumer.Name)
	default:
		return nil
	}
}

func (r *ACMEHubCertificateReconciler) enqueueCertificatesForConsumer(
	ctx context.Context,
	kind, namespace, name string,
) []reconcile.Request {
	var certs acmev1alpha1.ACMEHubCertificateList
	opts := []client.ListOption{
		client.MatchingFields{certConsumerRefIndex: certConsumerRefKey(kind, namespace, name)},
	}
	if kind != "ClusterACMEHubConsumer" {
		opts = append(opts, client.InNamespace(namespace))
	}
	if err := r.List(ctx, &certs, opts...); err != nil {
		log.FromContext(ctx).Error(err, "list ACMEHubCertificates for consumer", "kind", kind, "name", name)
		return nil
	}

	requests := make([]reconcile.Request, 0, len(certs.Items))
	for _, cert := range certs.Items {
		requests = append(requests, reconcile.Request{
			NamespacedName: types.NamespacedName{Namespace: cert.Namespace, Name: cert.Name},
		})
	}
	return requests
}
