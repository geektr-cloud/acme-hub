# The operator only manages opted-in TLS Secrets

`ACMEHubCertificate` writes only Secrets it created or that carry
`acme.geektr.cloud/managed=true`, refuses to overwrite unmanaged Secrets, and
deletes only Secrets it controls. This prevents a certificate CR author from
using the operator's cluster-wide Secret permissions to overwrite or delete
another workload's TLS Secret. Deleting a CR never removes an unmanaged Secret.
