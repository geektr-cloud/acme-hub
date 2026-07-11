package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ConsumerReference identifies which consumer to use for certificate issuance.
type ConsumerReference struct {
	// Kind of the consumer resource. Must be ACMEHubConsumer or ClusterACMEHubConsumer.
	// +kubebuilder:validation:Enum=ACMEHubConsumer;ClusterACMEHubConsumer
	// +kubebuilder:default=ACMEHubConsumer
	Kind string `json:"kind,omitempty"`

	// Name of the consumer resource.
	// +kubebuilder:validation:Required
	Name string `json:"name"`
}

// ACMEHubCertificateSpec defines the desired state of ACMEHubCertificate.
type ACMEHubCertificateSpec struct {
	// ConsumerRef identifies which consumer to use for issuing the certificate.
	// +kubebuilder:validation:Required
	ConsumerRef ConsumerReference `json:"consumerRef"`

	// SecretName is the name of the TLS Secret to create/update in the same namespace.
	// +kubebuilder:validation:Required
	SecretName string `json:"secretName"`

	// Domains is the list of domain names for the certificate. The first entry
	// (with any leading "*." stripped) becomes the commonName.
	// +kubebuilder:validation:Required
	// +kubebuilder:validation:MinItems=1
	Domains []string `json:"domains"`
}

// ACMEHubCertificateStatus defines the observed state of ACMEHubCertificate.
type ACMEHubCertificateStatus struct {
	// Conditions represent the latest available observations of the object's state.
	// +listType=map
	// +listMapKey=type
	Conditions []metav1.Condition `json:"conditions,omitempty"`

	// NotBefore is the start of the certificate validity period.
	NotBefore *metav1.Time `json:"notBefore,omitempty"`

	// NotAfter is the end of the certificate validity period.
	NotAfter *metav1.Time `json:"notAfter,omitempty"`

	// LastSyncTime is the time the certificate was last successfully synced.
	LastSyncTime *metav1.Time `json:"lastSyncTime,omitempty"`

	// ObservedGeneration reflects the generation of the spec that was last reconciled.
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`

	// CommonName is the certificate's CN from the last issue response.
	CommonName string `json:"commonName,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Namespaced,shortName=ahcert
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="READY",type="string",JSONPath=`.status.conditions[?(@.type=="Ready")].status`
// +kubebuilder:printcolumn:name="COMMON-NAME",type="string",JSONPath=".status.commonName"
// +kubebuilder:printcolumn:name="SECRET",type="string",JSONPath=".spec.secretName"
// +kubebuilder:printcolumn:name="NOT-AFTER",type="date",JSONPath=".status.notAfter"
// +kubebuilder:printcolumn:name="AGE",type="date",JSONPath=".metadata.creationTimestamp"

// ACMEHubCertificate is the Schema for the acmehubcertificates API.
type ACMEHubCertificate struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ACMEHubCertificateSpec   `json:"spec,omitempty"`
	Status ACMEHubCertificateStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// ACMEHubCertificateList contains a list of ACMEHubCertificate.
type ACMEHubCertificateList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []ACMEHubCertificate `json:"items"`
}

func init() {
	SchemeBuilder.Register(&ACMEHubCertificate{}, &ACMEHubCertificateList{})
}
