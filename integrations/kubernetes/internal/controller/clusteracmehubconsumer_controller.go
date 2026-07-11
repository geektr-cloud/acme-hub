package controller

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	acmev1alpha1 "github.com/geektr-cloud/acmehub-syncer/api/v1alpha1"
)

// ClusterACMEHubConsumerReconciler reconciles a ClusterACMEHubConsumer object.
type ClusterACMEHubConsumerReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=clusteracmehubconsumers,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=clusteracmehubconsumers/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=acme.geektr.cloud,resources=clusteracmehubconsumers/finalizers,verbs=update

func (r *ClusterACMEHubConsumerReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	logger := log.FromContext(ctx)

	consumer := &acmev1alpha1.ClusterACMEHubConsumer{}
	if err := r.Get(ctx, req.NamespacedName, consumer); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	logger.Info("reconciling ClusterACMEHubConsumer", "name", consumer.Name)

	ready := true
	reason := "Valid"
	message := "Consumer is valid"

	if consumer.Spec.Endpoint == "" {
		ready = false
		reason = "InvalidEndpoint"
		message = "Endpoint is empty"
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

func (r *ClusterACMEHubConsumerReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&acmev1alpha1.ClusterACMEHubConsumer{}).
		Named("clusteracmehubconsumer").
		Complete(r)
}
