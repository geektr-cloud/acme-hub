package controller

import (
	"context"
	"errors"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

var errEmptyToken = errors.New("token is empty")

// loadConsumerToken reads the consumer token Secret and trims incidental
// whitespace from file-based secrets.
func loadConsumerToken(ctx context.Context, c client.Client, namespace, name string) (string, error) {
	secret := &corev1.Secret{}
	key := types.NamespacedName{Namespace: namespace, Name: name}
	if err := c.Get(ctx, key, secret); err != nil {
		return "", fmt.Errorf("get token secret %s: %w", key, err)
	}

	token := strings.TrimSpace(string(secret.Data["token"]))
	if token == "" {
		return "", fmt.Errorf("token secret %s: %w", key, errEmptyToken)
	}

	return token, nil
}
