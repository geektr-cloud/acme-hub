package acmehub

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"strings"
	"time"
)

// validateIssueResponse rejects responses that cannot produce a usable TLS
// Secret. The certificate is the authority for SANs; the response's sans field
// is informational only.
func validateIssueResponse(domains []string, resp *IssueResponse) error {
	if strings.TrimSpace(resp.Fullchain) == "" {
		return fmt.Errorf("response fullchain is empty")
	}
	if strings.TrimSpace(resp.PrivateKey) == "" {
		return fmt.Errorf("response privateKey is empty")
	}

	pair, err := tls.X509KeyPair([]byte(resp.Fullchain), []byte(resp.PrivateKey))
	if err != nil {
		return fmt.Errorf("parse certificate/key pair: %w", err)
	}
	if resp.NotBefore.IsZero() || resp.NotAfter.IsZero() || !resp.NotAfter.After(resp.NotBefore) {
		return fmt.Errorf("invalid response validity window")
	}

	leaf, err := x509.ParseCertificate(pair.Certificate[0])
	if err != nil {
		return fmt.Errorf("parse leaf certificate: %w", err)
	}
	if leaf.NotAfter.IsZero() || !leaf.NotAfter.After(leaf.NotBefore) {
		return fmt.Errorf("invalid certificate validity window")
	}
	if !leaf.NotAfter.After(time.Now()) {
		return fmt.Errorf("certificate is already expired")
	}

	for _, domain := range domains {
		domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
		if domain == "" {
			return fmt.Errorf("requested domain is empty")
		}

		if strings.HasPrefix(domain, "*.") {
			if !hasDNSName(leaf.DNSNames, domain) {
				return fmt.Errorf("certificate does not contain wildcard SAN %q", domain)
			}
			continue
		}

		if err := leaf.VerifyHostname(domain); err != nil {
			return fmt.Errorf("certificate does not cover %q: %w", domain, err)
		}
	}

	return nil
}

func hasDNSName(names []string, want string) bool {
	for _, name := range names {
		if strings.EqualFold(strings.TrimSuffix(name, "."), want) {
			return true
		}
	}
	return false
}
