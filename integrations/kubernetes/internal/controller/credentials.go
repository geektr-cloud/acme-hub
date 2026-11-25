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

var (
	errEmptyEndpoint = errors.New("endpoint is empty")
	errEmptyToken    = errors.New("token is empty")
)

// loadConsumerCredentials reads the endpoint and token from the consumer
// credential Secret and trims incidental whitespace from file-based secrets.
func loadConsumerCredentials(
	ctx context.Context,
	c client.Client,
	namespace, name string,
) (endpoint, token string, err error) {
	secret := &corev1.Secret{}
	key := types.NamespacedName{Namespace: namespace, Name: name}
	if err := c.Get(ctx, key, secret); err != nil {
		return "", "", fmt.Errorf("get consumer credential secret %s: %w", key, err)
	}

	endpoint = strings.TrimSpace(string(secret.Data["endpoint"]))
	if endpoint == "" {
		return "", "", fmt.Errorf("consumer credential secret %s: %w", key, errEmptyEndpoint)
	}

	token = strings.TrimSpace(string(secret.Data["token"]))
	if token == "" {
		return "", "", fmt.Errorf("consumer credential secret %s: %w", key, errEmptyToken)
	}

	return endpoint, token, nil
}
