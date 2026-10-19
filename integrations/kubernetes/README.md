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

The chart deploys into the release namespace (`--namespace`, or
`targetNamespace` for the k3s Helm controller). Override
`clusterResourceNamespace` only when the operator and its consumer token Secrets
should live somewhere else.

> Upgrading from 0.0.x: `clusterResourceNamespace` now defaults to the release
> namespace instead of the fixed `acmehub-system`. Set it explicitly if your
> `targetNamespace` differs and you want to keep the old placement.

Namespace creation is automatic:

- `namespace.create: auto` (default) — create the namespace if it is missing.
  If it already exists, whether created by Helm, another release, or your
  cluster bootstrap, it is left untouched, so installation never fails on
  ownership metadata.
- `namespace.create: true` — always render the `Namespace` object. An existing
  namespace must then carry this release's ownership metadata.
- `namespace.create: false` — never create it; the namespace must already exist.

The chart-owned `Namespace` is annotated with
`helm.sh/resource-policy: keep`, so `helm uninstall` does not delete it.

For the k3s Helm controller, `targetNamespace` is all you need:

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: acmehub-syncer
  namespace: kube-system
spec:
  chart: acmehub-syncer
  repo: https://geektr-cloud.github.io/acme-hub
  targetNamespace: acmehub-system
```

`auto` needs permission to `get` namespaces at render time. For GitOps
renderers or restricted Helm RBAC, use the deterministic form instead:

```yaml
spec:
  targetNamespace: acmehub-system
  createNamespace: true
  valuesContent: |
    namespace:
      create: false
```

If you want Helm to manage a pre-existing namespace anyway (for example, to
apply the chart's labels), adopt it first:

```bash
kubectl label namespace acmehub-system app.kubernetes.io/managed-by=Helm --overwrite
kubectl annotate namespace acmehub-system \
  meta.helm.sh/release-name=acmehub-syncer \
  meta.helm.sh/release-namespace=acmehub-system \
  helm.sh/resource-policy=keep --overwrite
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
    name: shared-token  # Secret must exist in --cluster-resource-namespace (chart default: release namespace)
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

### Helm chart values

| Value | Default | Description |
|-------|---------|-------------|
| `clusterResourceNamespace` | `""` | Namespace for the operator and ClusterACMEHubConsumer token Secrets. Empty means the release namespace. |
| `namespace.create` | `auto` | `auto` creates the namespace only when missing; `true` always renders it; `false` never creates it. |

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
