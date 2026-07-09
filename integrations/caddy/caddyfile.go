package acmehub

import (
	"strings"

	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
)

func (p *AcmeHubProvider) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	d.Next()
	args := d.RemainingArgs()
	switch len(args) {
	case 0:
		p.Profile = "default"
	case 1:
		p.Profile = strings.TrimPrefix(args[0], "@")
	default:
		return d.ArgErr()
	}

	for d.NextBlock(0) {
		switch d.Val() {
		case "endpoint":
			if !d.AllArgs(&p.Endpoint) {
				return d.ArgErr()
			}
		case "token":
			if !d.AllArgs(&p.Token) {
				return d.ArgErr()
			}
		default:
			return d.Errf("unrecognized subdirective: %s", d.Val())
		}
	}

	return nil
}
