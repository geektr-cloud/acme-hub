package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// SecretReference identifies a consumer credential Secret in the same namespace.
type SecretReference struct {
	// Name of the Secret containing the acme-hub endpoint and token
	// (keys: "endpoint", "token").
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MinLength=1
	Name string `json:"name"`
}

// ACMEHubConsumerSpec defines the desired state of ACMEHubConsumer.
type ACMEHubConsumerSpec struct {
	// SecretRef references a Secret in the same namespace containing the acme-hub
	// endpoint and token.
	// +kubebuilder:validation:Required
	SecretRef SecretReference `json:"secretRef"`
}

// ACMEHubConsumerStatus defines the observed state of ACMEHubConsumer.
type ACMEHubConsumerStatus struct {
	// Conditions represent the latest available observations of the object's state.
	// +listType=map
	// +listMapKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// ObservedGeneration reflects the generation of the spec that was last reconciled.
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Namespaced,shortName=ahc
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="SECRET",type="string",JSONPath=".spec.secretRef.name"
// +kubebuilder:printcolumn:name="READY",type="string",JSONPath=`.status.conditions[?(@.type=="Ready")].status`
// +kubebuilder:printcolumn:name="AGE",type="date",JSONPath=".metadata.creationTimestamp"

// ACMEHubConsumer is the Schema for the acmehubconsumers API.
type ACMEHubConsumer struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ACMEHubConsumerSpec   `json:"spec,omitempty"`
	Status ACMEHubConsumerStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// ACMEHubConsumerList contains a list of ACMEHubConsumer.
type ACMEHubConsumerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []ACMEHubConsumer `json:"items"`
}

func init() {
	SchemeBuilder.Register(&ACMEHubConsumer{}, &ACMEHubConsumerList{})
}
