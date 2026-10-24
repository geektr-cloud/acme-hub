# Context

## acme-hub proxy

A proxy dedicated to acme-hub API traffic. It applies only to the client that
talks to acme-hub and is independent of the process or cluster's general egress
proxy, which may also carry Kubernetes API or unrelated traffic.

Not to be confused with:

- the cluster / process egress proxy (`HTTPS_PROXY`), which affects other
  clients as well
- the acme-hub endpoint itself
