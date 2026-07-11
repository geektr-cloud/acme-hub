# acmehub-syncer

Kubernetes operator that syncs TLS certificates from [acme-hub](https://acme.geektr.cloud) into Kubernetes TLS Secrets.

## Overview

acmehub-syncer is a Kubernetes operator (built with kubebuilder + controller-runtime) that acts as a consumer of acme-hub's public PKI endpoints. It watches `ACMEHubCertificate` custom resources, calls acme-hub's `/pki/v1/certificates/issue` endpoint to obtain certificates, and writes them as `kubernetes.io/tls` Secrets for use by Ingress controllers or Gateway API.

This is conceptually identical to the [Caddy plugin](../caddy/) — both consume acme-hub's certificate issuance API, but acmehub-syncer targets Kubernetes.

## CRDs

| CRD | Scope | Description |
|-----|-------|-------------|
| `ACMEHubConsumer` | Namespaced | References an acme-hub endpoint + token Secret in the same namespace |
| `ClusterACMEHubConsumer` | Cluster | References an acme-hub endpoint + token Secret in `--cluster-resource-namespace` |
| `ACMEHubCertificate` | Namespaced | Declares desired certificate (domains, Secret name, consumer ref) |

## Installation

```bash
helm repo add acmehub-syncer https://geektr-cloud.github.io/acme-hub
helm install acmehub-syncer acmehub-syncer/acmehub-syncer \
  --namespace acmehub-system --create-namespace
```

## Quick Start

### 1. Create a consumer token Secret

```bash
kubectl create secret generic my-acme-hub-token \
  --from-literal=token=YOUR_ACME_HUB_TOKEN
```

### 2. Create an ACMEHubConsumer

```yaml
apiVersion: acme.geektr.cloud/v1alpha1
kind: ACMEHubConsumer
metadata:
  name: my-consumer
  namespace: default
spec:
  endpoint: https://acme.geektr.cloud
  secretRef:
    name: my-acme-hub-token
```

### 3. Create an ACMEHubCertificate

```yaml
apiVersion: acme.geektr.cloud/v1alpha1
kind: ACMEHubCertificate
metadata:
  name: my-cert
  namespace: default
spec:
  consumerRef:
    kind: ACMEHubConsumer
    name: my-consumer
  secretName: my-tls-secret
  domains:
    - example.com
    - "*.example.com"
```

The operator will call acme-hub's issue endpoint and create a `kubernetes.io/tls` Secret named `my-tls-secret`.

### Using ClusterACMEHubConsumer

For cluster-wide shared consumers:

```yaml
apiVersion: acme.geektr.cloud/v1alpha1
kind: ClusterACMEHubConsumer
metadata:
  name: shared-consumer
spec:
  endpoint: https://acme.geektr.cloud
  secretRef:
    name: shared-token  # Secret must exist in --cluster-resource-namespace (default: acmehub-system)
```

```yaml
apiVersion: acme.geektr.cloud/v1alpha1
kind: ACMEHubCertificate
metadata:
  name: my-cert
spec:
  consumerRef:
    kind: ClusterACMEHubConsumer
    name: shared-consumer
  secretName: my-tls-secret
  domains:
    - example.com
```

## Renewal

Certificates are automatically renewed when they reach 90% of their lifetime (configurable via `RenewRatio` in `internal/schedule/renew.go`). The controller requeues after the calculated duration, so renewal happens proactively before expiry.

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--cluster-resource-namespace` | `acmehub-system` | Namespace for ClusterACMEHubConsumer token Secrets |
| `--metrics-bind-address` | `:8080` | Metrics endpoint address |
| `--health-probe-bind-address` | `:8081` | Health probe endpoint address |
| `--leader-elect` | `false` | Enable leader election |

## RBAC

The operator requires:
- **CRDs**: Full CRUD on all three CRDs + status/finalizers subresources
- **Secrets**: `get`, `list`, `watch` (read token Secrets) + `create`, `update`, `patch` (write TLS Secrets)

This is cluster-wide Secret access — standard for certificate management operators. See the generated `config/rbac/role.yaml` for exact rules.

## Security Notes

- **Private keys in etcd**: The issued certificate private keys are stored in TLS Secrets (etcd). Enable [EncryptionConfiguration](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/) to encrypt etcd at rest.
- **HTTPS only**: The operator to acme-hub communication must use HTTPS (`endpoint` should start with `https://`). Private keys are transmitted in the response body.
- **RBAC**: Token Secrets and TLS Secrets are both sensitive. Scope RBAC permissions carefully.

## Development

```bash
# Build
make build

# Run locally (requires kubeconfig)
make run

# Run unit tests
go test ./internal/acmehub/ ./internal/schedule/ -v

# Run all tests (requires envtest binaries)
make test

# Generate manifests and deepcopy
make manifests generate

# Lint
make fmt vet
```

## Comparison with Caddy Plugin

| | Caddy Plugin | acmehub-syncer |
|---|---|---|
| Runtime | Caddy server | Kubernetes |
| Config | Caddyfile / JSON | CRD YAML |
| Certificate store | In-memory cache | Kubernetes Secrets |
| Renewal | On TLS handshake | Scheduled (90% lifetime) |
| Auth | Endpoint + token in config | Secret reference in CRD |
