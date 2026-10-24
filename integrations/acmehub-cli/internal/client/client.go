package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/geektr-cloud/acme-hub/integrations/acmehub-cli/internal/certkit"
)

// FetchTimeout bounds a single issue request. Cold issuance including DNS-01
// propagation can exceed 60s, so the default is generous.
const FetchTimeout = 120 * time.Second

// Config carries the endpoint + token needed to reach acme-hub.
type Config struct {
	Endpoint string
	Token    string
	Proxy    *url.URL
}

// Fetch calls POST {endpoint}/pki/v1/certificates/issue with the given domains
// and decodes the response into a certkit.Cert. The bearer token is never
// included in any returned error.
func Fetch(ctx context.Context, cfg Config, domains []string) (*certkit.Cert, error) {
	if cfg.Endpoint == "" {
		return nil, fmt.Errorf("endpoint is empty")
	}
	if cfg.Token == "" {
		return nil, fmt.Errorf("token is empty")
	}
	if len(domains) == 0 {
		return nil, fmt.Errorf("no domains given")
	}

	ctx, cancel := context.WithTimeout(ctx, FetchTimeout)
	defer cancel()

	body, err := json.Marshal(map[string]any{"domains": domains})
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}

	url := cfg.Endpoint + "/pki/v1/certificates/issue"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := newHTTPClient(cfg.Proxy).Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("issue endpoint returned %d: %s", resp.StatusCode, summarize(respBody))
	}

	return certkit.ParseIssueResponse(respBody)
}

// ParseProxy parses ACME_HUB_PROXY. An empty value disables the dedicated
// proxy. Supported schemes are http, https and socks5.
func ParseProxy(raw string) (*url.URL, error) {
	if raw == "" {
		return nil, nil
	}
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("parse ACME_HUB_PROXY: %w", err)
	}
	switch u.Scheme {
	case "http", "https", "socks5":
	default:
		return nil, fmt.Errorf("ACME_HUB_PROXY: unsupported scheme %q (want http, https or socks5)", u.Scheme)
	}
	if u.Host == "" {
		return nil, fmt.Errorf("ACME_HUB_PROXY: missing host")
	}
	return u, nil
}

func newHTTPClient(proxy *url.URL) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if proxy != nil {
		transport.Proxy = http.ProxyURL(proxy)
	}
	return &http.Client{
		Timeout:   FetchTimeout,
		Transport: transport,
	}
}

// summarize trims a response body for inclusion in error messages.
func summarize(b []byte) string {
	const max = 512
	s := string(bytes.TrimSpace(b))
	if len(s) > max {
		return s[:max] + "..."
	}
	return s
}
