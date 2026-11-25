# Consumer credentials live in a Secret

The acme-hub endpoint is stored with the consumer token in one consumer
credential Secret instead of on `ACMEHubConsumer` and
`ClusterACMEHubConsumer`. This binds a credential to its destination and stops
a CRD writer from pairing someone else's token with an attacker-controlled
endpoint. A principal with patch access to the Secret can still change the
endpoint, so an optional endpoint allowlist remains defense in depth.
