package controller

import (
	"context"
	"fmt"

	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/manager"

	acmev1alpha1 "github.com/geektr-cloud/acme-hub/integrations/kubernetes/api/v1alpha1"
)

const (
	certConsumerRefIndex          = "acmehubcertificate.consumerRef"
	consumerSecretRefIndex        = "acmehubconsumer.secretRef"
	clusterConsumerSecretRefIndex = "clusteracmehubconsumer.secretRef"
)

// SetupIndexes registers the indexes used by the Secret and consumer watches.
// It must run once before any controller starts.
func SetupIndexes(ctx context.Context, mgr manager.Manager) error {
	if err := mgr.GetFieldIndexer().IndexField(
		ctx,
		&acmev1alpha1.ACMEHubCertificate{},
		certConsumerRefIndex,
		func(obj client.Object) []string {
			cert := obj.(*acmev1alpha1.ACMEHubCertificate)
			return []string{certConsumerRefKey(cert.Spec.ConsumerRef.Kind, cert.Namespace, cert.Spec.ConsumerRef.Name)}
		},
	); err != nil {
		return fmt.Errorf("index ACMEHubCertificate by consumer ref: %w", err)
	}

	if err := mgr.GetFieldIndexer().IndexField(
		ctx,
		&acmev1alpha1.ACMEHubConsumer{},
		consumerSecretRefIndex,
		func(obj client.Object) []string {
			consumer := obj.(*acmev1alpha1.ACMEHubConsumer)
			return []string{consumer.Namespace + "/" + consumer.Spec.SecretRef.Name}
		},
	); err != nil {
		return fmt.Errorf("index ACMEHubConsumer by secret ref: %w", err)
	}

	if err := mgr.GetFieldIndexer().IndexField(
		ctx,
		&acmev1alpha1.ClusterACMEHubConsumer{},
		clusterConsumerSecretRefIndex,
		func(obj client.Object) []string {
			consumer := obj.(*acmev1alpha1.ClusterACMEHubConsumer)
			return []string{consumer.Spec.SecretRef.Name}
		},
	); err != nil {
		return fmt.Errorf("index ClusterACMEHubConsumer by secret ref: %w", err)
	}

	return nil
}

func certConsumerRefKey(kind, namespace, name string) string {
	if kind == "" {
		kind = "ACMEHubConsumer"
	}
	if kind == "ClusterACMEHubConsumer" {
		return kind + "/" + name
	}
	return kind + "/" + namespace + "/" + name
}
