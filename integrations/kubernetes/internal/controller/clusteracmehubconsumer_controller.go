package controller

import (
	"context"
	"errors"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/handler"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/acmehub"
)

// ClusterACMEHubConsumerReconciler reconciles a ClusterACMEHubConsumer object.
type ClusterACMEHubConsumerReconciler struct {
	client.Client
	ClusterResourceNamespace string
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

	logger.V(1).Info("reconciling ClusterACMEHubConsumer", "name", consumer.Name)

	ready := true
	reason := "Valid"
	message := "Consumer is valid"

	if _, err := acmehub.ParseEndpoint(consumer.Spec.Endpoint); err != nil {
		ready = false
		reason = "InvalidEndpoint"
		message = err.Error()
	}

	if ready {
		if _, err := loadConsumerToken(ctx, r.Client, r.ClusterResourceNamespace, consumer.Spec.SecretRef.Name); err != nil {
			ready = false
			reason = "SecretNotFound"
			if errors.Is(err, errEmptyToken) {
				reason = "InvalidSecret"
			} else if !apierrors.IsNotFound(err) {
				reason = "SecretError"
			}
			message = err.Error()
		}
	}

	status := metav1.ConditionFalse
	if ready {
		status = metav1.ConditionTrue
	}

	statusChanged := setCondition(&consumer.Status.Conditions, "Ready", status, reason, message)
	if consumer.Status.ObservedGeneration != consumer.Generation {
		consumer.Status.ObservedGeneration = consumer.Generation
		statusChanged = true
	}

	if statusChanged {
		if err := r.Status().Update(ctx, consumer); err != nil {
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

func (r *ClusterACMEHubConsumerReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&acmev1alpha1.ClusterACMEHubConsumer{}).
		Watches(
			&corev1.Secret{},
			handler.EnqueueRequestsFromMapFunc(r.mapSecretToClusterConsumer),
		).
		Named("clusteracmehubconsumer").
		Complete(r)
}

func (r *ClusterACMEHubConsumerReconciler) mapSecretToClusterConsumer(
	ctx context.Context,
	obj client.Object,
) []reconcile.Request {
	secret, ok := obj.(*corev1.Secret)
	if !ok || secret.Namespace != r.ClusterResourceNamespace {
		return nil
	}

	var consumers acmev1alpha1.ClusterACMEHubConsumerList
	if err := r.List(
		ctx,
		&consumers,
		client.MatchingFields{clusterConsumerSecretRefIndex: secret.Name},
	); err != nil {
		log.FromContext(ctx).Error(err, "list ClusterACMEHubConsumers for secret", "secret", secret.Namespace+"/"+secret.Name)
		return nil
	}

	requests := make([]reconcile.Request, 0, len(consumers.Items))
	for i := range consumers.Items {
		requests = append(requests, reconcile.Request{
			NamespacedName: client.ObjectKeyFromObject(&consumers.Items[i]),
		})
	}
	return requests
}
