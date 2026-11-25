package controller

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// #nosec G101 -- annotation key, not a credential.
const managedSecretAnnotation = "acme.geektr.cloud/managed"

func markManagedSecret(secret *corev1.Secret) {
	if secret.Annotations == nil {
		secret.Annotations = map[string]string{}
	}
	secret.Annotations[managedSecretAnnotation] = "true"
}

func isManagedSecret(secret *corev1.Secret, owner metav1.Object) bool {
	return metav1.IsControlledBy(secret, owner) || secret.Annotations[managedSecretAnnotation] == "true"
}
