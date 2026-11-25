package acmehub

import (
	"fmt"
	"net/url"
	"strings"
)

// ParseEndpoint validates an acme-hub base URL. Only HTTPS is accepted;
// credentials, queries, and fragments are rejected so the endpoint cannot
// silently change the request target or leak secrets through URL logging.
func ParseEndpoint(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("endpoint is empty")
	}

	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("parse endpoint: %w", err)
	}
	if u.Scheme != "https" {
		return nil, fmt.Errorf("endpoint scheme must be https, got %q", u.Scheme)
	}
	if u.Host == "" {
		return nil, fmt.Errorf("endpoint host is empty")
	}
	if u.User != nil {
		return nil, fmt.Errorf("endpoint must not contain userinfo")
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return nil, fmt.Errorf("endpoint must not contain a query or fragment")
	}

	return u, nil
}

// ParseAllowedEndpoints parses a comma-separated allowlist of HTTPS origins.
// An empty list allows every valid HTTPS endpoint. Paths are not allowed in the
// allowlist: matching is by scheme, host, and port only.
func ParseAllowedEndpoints(raw string) ([]string, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}

	seen := map[string]struct{}{}
	allowed := []string{}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		u, err := ParseEndpoint(part)
		if err != nil {
			return nil, fmt.Errorf("invalid allowed endpoint %q: %w", part, err)
		}
		if u.Path != "" && u.Path != "/" {
			return nil, fmt.Errorf("allowed endpoint %q must be an origin, not a path", part)
		}
		origin := endpointOrigin(u)
		if _, ok := seen[origin]; ok {
			continue
		}
		seen[origin] = struct{}{}
		allowed = append(allowed, origin)
	}
	return allowed, nil
}

// IsEndpointAllowed validates an endpoint and checks it against an optional
// allowlist. The allowlist is a list of origins, so a path on the actual
// endpoint does not change the match.
func IsEndpointAllowed(endpoint string, allowed []string) error {
	u, err := ParseEndpoint(endpoint)
	if err != nil {
		return err
	}
	if len(allowed) == 0 {
		return nil
	}

	origin := endpointOrigin(u)
	for _, allowedOrigin := range allowed {
		if origin == allowedOrigin {
			return nil
		}
	}
	return fmt.Errorf("endpoint %q is not in the allowlist", origin)
}

func endpointOrigin(u *url.URL) string {
	return strings.ToLower(u.Scheme + "://" + u.Host)
}
