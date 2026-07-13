package controller

import (
	"context"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
)

// ACMEHubConsumerReconciler reconciles an ACMEHubConsumer object.
type ACMEHubConsumerReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubconsumers,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubconsumers/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=acmehubconsumers/finalizers,verbs=update

func (r *ACMEHubConsumerReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)

	consumer := &acmev1alpha1.ACMEHubConsumer{}
	if err := r.Get(ctx, req.NamespacedName, consumer); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	logger.Info("reconciling ACMEHubConsumer", "name", consumer.Name)

	ready := true
	reason := "Valid"
	message := "Consumer is valid"

	if consumer.Spec.Endpoint == "" {
		ready = false
		reason = "InvalidEndpoint"
		message = "Endpoint is empty"
	}

	if ready {
		secret := &corev1.Secret{}
		secretKey := types.NamespacedName{
			Namespace: consumer.Namespace,
			Name:      consumer.Spec.SecretRef.Name,
		}
		if err := r.Get(ctx, secretKey, secret); err != nil {
			ready = false
			reason = "SecretNotFound"
			message = "Token secret not found: " + err.Error()
		} else if _, ok := secret.Data["token"]; !ok {
			ready = false
			reason = "SecretNotFound"
			message = "Token secret missing 'token' key"
		}
	}

	status := metav1.ConditionFalse
	if ready {
		status = metav1.ConditionTrue
	}

	setCondition(&consumer.Status.Conditions, "Ready", status, reason, message)
	consumer.Status.ObservedGeneration = consumer.Generation

	if err := r.Status().Update(ctx, consumer); err != nil {
		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

func (r *ACMEHubConsumerReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&acmev1alpha1.ACMEHubConsumer{}).
		Named("acmehubconsumer").
		Complete(r)
}
