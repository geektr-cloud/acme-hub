package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ClusterACMEHubConsumerSpec defines the desired state of ClusterACMEHubConsumer.
type ClusterACMEHubConsumerSpec struct {
	// Endpoint is the acme-hub base URL (e.g. https://acme.geektr.cloud).
	// +kubebuilder:validation:Required
	Endpoint string `json:"endpoint"`

	// SecretRef references a Secret (name only) in the --cluster-resource-namespace.
	// +kubebuilder:validation:Required
	SecretRef SecretReference `json:"secretRef"`
}

// ClusterACMEHubConsumerStatus defines the observed state of ClusterACMEHubConsumer.
type ClusterACMEHubConsumerStatus struct {
	// Conditions represent the latest available observations of the object's state.
	// +listType=map
	// +listMapKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// ObservedGeneration reflects the generation of the spec that was last reconciled.
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Cluster,shortName=cac
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="ENDPOINT",type="string",JSONPath=".spec.endpoint"
// +kubebuilder:printcolumn:name="READY",type="string",JSONPath=`.status.conditions[?(@.type=="Ready")].status`
// +kubebuilder:printcolumn:name="AGE",type="date",JSONPath=".metadata.creationTimestamp"

// ClusterACMEHubConsumer is the Schema for the clusteracmehubconsumers API.
type ClusterACMEHubConsumer struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ClusterACMEHubConsumerSpec   `json:"spec,omitempty"`
	Status ClusterACMEHubConsumerStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// ClusterACMEHubConsumerList contains a list of ClusterACMEHubConsumer.
type ClusterACMEHubConsumerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []ClusterACMEHubConsumer `json:"items"`
}

func init() {
	SchemeBuilder.Register(&ClusterACMEHubConsumer{}, &ClusterACMEHubConsumerList{})
}
