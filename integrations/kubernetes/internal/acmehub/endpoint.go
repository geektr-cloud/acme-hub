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
