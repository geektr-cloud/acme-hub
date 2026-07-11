package acmehub

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddytls"
	"github.com/caddyserver/certmagic"
)

func init() {
	caddy.RegisterModule(AcmeHubProvider{})
}

var httpClient = &http.Client{Timeout: 30 * time.Second}

type AcmeHubProvider struct {
	Profile  string `json:"profile,omitempty"`
	Endpoint string `json:"endpoint,omitempty"`
	Token    string `json:"token,omitempty"`

	cfg       ProfileConfig     `json:"-"`
	cache     *certCache        `json:"-"`
	wildcards map[string]string `json:"-"` // suffix → wildcard domain, e.g. ".acmehub.anitya.cn" → "*.acmehub.anitya.cn"
}

func (AcmeHubProvider) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "tls.get_certificate.acmehub",
		New: func() caddy.Module { return new(AcmeHubProvider) },
	}
}

func (p *AcmeHubProvider) Provision(ctx caddy.Context) error {
	if p.Endpoint != "" && p.Token != "" {
		p.cfg = ProfileConfig{Endpoint: p.Endpoint, Token: p.Token}
	} else if p.Endpoint != "" || p.Token != "" {
		return fmt.Errorf("acmehub: endpoint and token must both be set or both be empty")
	} else {
		profile := p.Profile
		if profile == "" {
			profile = "default"
		}
		cfg, err := resolveProfile(profile)
		if err != nil {
			return err
		}
		p.cfg = cfg
	}
	p.cache = newCertCache()
	p.wildcards = make(map[string]string)
	p.detectWildcards(ctx)
	return nil
}

func (p *AcmeHubProvider) detectWildcards(ctx caddy.Context) {
	tlsApp, err := ctx.App("tls")
	if err != nil {
		return
	}
	app, ok := tlsApp.(*caddytls.TLS)
	if !ok || app == nil || app.Automation == nil {
		return
	}
	for _, policy := range app.Automation.Policies {
		for _, subj := range policy.SubjectsRaw {
			if strings.HasPrefix(subj, "*.") {
				suffix := "." + strings.TrimPrefix(subj, "*.")
				p.wildcards[suffix] = subj
			}
		}
	}
}

func (p *AcmeHubProvider) resolveDomain(sni string) string {
	for suffix, wildcard := range p.wildcards {
		if !strings.HasSuffix(sni, suffix) {
			continue
		}
		prefix := strings.TrimSuffix(sni, suffix)
		if prefix != "" && !strings.Contains(prefix, ".") {
			return wildcard
		}
	}
	return sni
}

func (p *AcmeHubProvider) GetCertificate(_ context.Context, hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	name := hello.ServerName
	if name == "" {
		return nil, fmt.Errorf("acmehub: empty SNI")
	}

	if cert, ok := p.cache.Get(name); ok {
		return cert, nil
	}

	cert, maxAge, err := p.fetchCert(p.resolveDomain(name))
	if err != nil {
		return nil, err
	}

	p.cache.Set(name, cert, maxAge)
	return cert, nil
}

type certResponse struct {
	CommonName  string   `json:"commonName"`
	Sans        []string `json:"sans"`
	PrivateKey  string   `json:"privateKey"`
	Certificate string   `json:"certificate"`
	Chain       string   `json:"chain"`
	Fullchain   string   `json:"fullchain"`
	NotBefore   string   `json:"notBefore"`
	NotAfter    string   `json:"notAfter"`
}

func (p *AcmeHubProvider) fetchCert(domain string) (*tls.Certificate, time.Duration, error) {
	body, _ := json.Marshal(map[string]any{
		"domains": []string{domain},
	})
	endpoint := strings.TrimRight(p.cfg.Endpoint, "/") + "/pki/v1/certificates/issue"

	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, 0, fmt.Errorf("acmehub: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.cfg.Token)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("acmehub: http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, 0, fmt.Errorf("acmehub: api returned %d: %s", resp.StatusCode, b)
	}

	var cr certResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return nil, 0, fmt.Errorf("acmehub: decode response: %w", err)
	}

	tlsCert, err := tls.X509KeyPair([]byte(cr.Fullchain), []byte(cr.PrivateKey))
	if err != nil {
		return nil, 0, fmt.Errorf("acmehub: x509 key pair: %w", err)
	}

	maxAge := parseMaxAge(resp.Header.Get("Cache-Control"))
	return &tlsCert, maxAge, nil
}

func parseMaxAge(cc string) time.Duration {
	for _, part := range strings.Split(cc, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "max-age=") {
			v := strings.TrimPrefix(part, "max-age=")
			sec, err := strconv.Atoi(v)
			if err == nil && sec > 0 {
				return time.Duration(sec) * time.Second
			}
		}
	}
	return 0
}

var (
	_ certmagic.Manager     = (*AcmeHubProvider)(nil)
	_ caddy.Provisioner     = (*AcmeHubProvider)(nil)
	_ caddyfile.Unmarshaler = (*AcmeHubProvider)(nil)
)
