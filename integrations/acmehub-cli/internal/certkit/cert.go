package certkit

import (
	"encoding/json"
	"fmt"
	"time"
)

// Cert holds the certificate material returned by the acme-hub issue endpoint.
type Cert struct {
	CommonName  string
	SANs        []string
	PrivateKey  string
	Certificate string
	Chain       string
	Fullchain   string
	NotBefore   time.Time
	NotAfter    time.Time
}

// issueResponse mirrors the JSON contract of POST /pki/v1/certificates/issue.
type issueResponse struct {
	CommonName  string   `json:"commonName"`
	SANs        []string `json:"sans"`
	PrivateKey  string   `json:"privateKey"`
	Certificate string   `json:"certificate"`
	Chain       string   `json:"chain"`
	Fullchain   string   `json:"fullchain"`
	NotBefore   string   `json:"notBefore"`
	NotAfter    string   `json:"notAfter"`
}

// ParseIssueResponse decodes the issue endpoint JSON body into a Cert,
// parsing the notBefore/notAfter ISO timestamps into time.Time.
func ParseIssueResponse(body []byte) (*Cert, error) {
	var r issueResponse
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("decode issue response: %w", err)
	}

	notBefore, err := time.Parse(time.RFC3339, r.NotBefore)
	if err != nil {
		return nil, fmt.Errorf("parse notBefore %q: %w", r.NotBefore, err)
	}
	notAfter, err := time.Parse(time.RFC3339, r.NotAfter)
	if err != nil {
		return nil, fmt.Errorf("parse notAfter %q: %w", r.NotAfter, err)
	}

	return &Cert{
		CommonName:  r.CommonName,
		SANs:        r.SANs,
		PrivateKey:  r.PrivateKey,
		Certificate: r.Certificate,
		Chain:       r.Chain,
		Fullchain:   r.Fullchain,
		NotBefore:   notBefore,
		NotAfter:    notAfter,
	}, nil
}
