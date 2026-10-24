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

The chart does **not** create or manage the namespace. It must already exist;
use `--create-namespace` (Helm CLI) or `createNamespace: true` (k3s HelmChart)
if you want Helm to create it for you.

> Upgrading from 0.1.2: the chart no longer creates the namespace. Ensure the
> target namespace exists before upgrading.

The three CRDs are regular chart resources under `templates/crds/` and are also
annotated with `helm.sh/resource-policy: keep`: Helm upgrades their schemas on
`helm upgrade` but does not delete them on uninstall.

> Upgrading from 0.1.0: the previous chart installed CRDs from a `crds/`
> directory, so the existing CRDs have no Helm ownership metadata. On the first
> 0.1.1 install, set `spec.takeOwnership: true` on the HelmChart (or pass
> `--take-ownership` to Helm), or adopt the CRDs manually:
>
> ```bash
> for crd in acmehubcertificates.acme.geektr.cloud \
>            acmehubconsumers.acme.geektr.cloud \
>            clusteracmehubconsumers.acme.geektr.cloud; do
>   kubectl label crd "$crd" app.kubernetes.io/managed-by=Helm --overwrite
>   kubectl annotate crd "$crd" \
>     meta.helm.sh/release-name=acmehub-syncer \
>     meta.helm.sh/release-namespace=acmehub-system --overwrite
> done
> ```
>
> Subsequent upgrades do not need this flag.

For the k3s Helm controller, create the namespace first or let Helm create it:

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChart
metadata:
  name: acmehub-syncer
  namespace: kube-system
spec:
  chart: acmehub-syncer
  repo: https://geektr-cloud.github.io/acme-hub
  version: "0.1.3"
  targetNamespace: acmehub-system
  createNamespace: true
```

`createNamespace: true` creates the namespace if it is missing; the chart never
renders or owns a Namespace object.

## Proxy

The operator reads `ACME_HUB_PROXY` at startup. It is used **only** by the
acme-hub API client; the Kubernetes API client is unaffected. Supported schemes
are `http`, `https` and `socks5`. An invalid value fails startup.

```yaml
acmeHubProxy: "http://proxy.example:8080"
```

When the value is empty the client keeps its default transport behavior,
including any process-wide `HTTPS_PROXY` / `NO_PROXY`. When set, the dedicated
client always uses this proxy and ignores `NO_PROXY`.

Avoid putting long-lived proxy credentials in this value: it is stored in the
Helm release secret and visible via `helm get values`.

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

A cold issuance includes DNS-01 TXT propagation and CA validation and can take
longer than 60 seconds. The operator allows up to 120 seconds for one issue
request; cached certificates and renewals return immediately.

### Helm chart values

| Value | Default | Description |
|-------|---------|-------------|
| `clusterResourceNamespace` | `""` | Namespace for the operator and ClusterACMEHubConsumer token Secrets. Empty means the release namespace. Must already exist. |
| `acmeHubProxy` | `""` | Proxy for acme-hub API requests only (`http`, `https`, `socks5`). Empty uses the default transport. |

## RBAC

The operator requires:
- **CRDs**: Full CRUD on all three CRDs + status/finalizers subresources
- **Secrets**: `get`, `list`, `watch` (read token Secrets) + `create`, `update`, `patch` (write TLS Secrets)
- **Leader election**: `get`, `list`, `watch`, `create`, `update`, `patch` on `coordination.k8s.io/leases` in the operator namespace

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
