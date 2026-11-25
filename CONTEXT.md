# Context

## Language

**consumer credential Secret**:
The Secret that holds an acme-hub consumer's endpoint and token, and is the trust unit for acme-hub requests.
_Avoid_: token Secret, consumer token

**managed TLS Secret**:
The Kubernetes Secret that holds the certificate and private key issued for an `ACMEHubCertificate`, and that the operator is allowed to overwrite and delete.
_Avoid_: target Secret, certificate Secret

## acme-hub proxy

A proxy dedicated to acme-hub API traffic. It applies only to the client that
talks to acme-hub and is independent of the process or cluster's general egress
proxy, which may also carry Kubernetes API or unrelated traffic.

Not to be confused with:

- the cluster / process egress proxy (`HTTPS_PROXY`), which affects other
  clients as well
- the acme-hub endpoint itself
