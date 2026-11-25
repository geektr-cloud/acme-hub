package acmehub

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/geektr-cloud/acme-hub/integrations/kubernetes/internal/testutil"
)

func testHTTPClient(server *httptest.Server) *Client {
	c := NewClient()
	c.HTTPClient = server.Client()
	c.HTTPClient.Timeout = defaultTimeout
	return c
}

func TestNewClientTimeout(t *testing.T) {
	if got := NewClient().HTTPClient.Timeout; got != defaultTimeout {
		t.Fatalf("timeout = %v, want %v", got, defaultTimeout)
	}
}

func TestParseProxy(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr bool
	}{
		{name: "empty", raw: "", want: ""},
		{name: "http", raw: "http://proxy.example:8080", want: "http://proxy.example:8080"},
		{name: "https", raw: "https://user:pass@proxy.example:8443", want: "https://user:pass@proxy.example:8443"},
		{name: "socks5", raw: "socks5://proxy.example:1080", want: "socks5://proxy.example:1080"},
		{name: "unsupported scheme", raw: "ftp://proxy.example", wantErr: true},
		{name: "missing host", raw: "http://", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseProxy(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseProxy() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if tt.want == "" {
				if got != nil {
					t.Fatalf("ParseProxy() = %v, want nil", got)
				}
				return
			}
			if got == nil || got.String() != tt.want {
				t.Fatalf("ParseProxy() = %v, want %s", got, tt.want)
			}
		})
	}
}

func TestParseEndpoint(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		wantErr bool
	}{
		{name: "https", raw: "https://acme.example.com"},
		{name: "http", raw: "http://acme.example.com", wantErr: true},
		{name: "empty", raw: "", wantErr: true},
		{name: "missing host", raw: "https://", wantErr: true},
		{name: "userinfo", raw: "https://user:pass@acme.example.com", wantErr: true},
		{name: "query", raw: "https://acme.example.com?x=1", wantErr: true},
		{name: "fragment", raw: "https://acme.example.com#x", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := ParseEndpoint(tt.raw); (err != nil) != tt.wantErr {
				t.Fatalf("ParseEndpoint(%q) error = %v, wantErr %v", tt.raw, err, tt.wantErr)
			}
		})
	}
}

func TestNewClientWithProxy(t *testing.T) {
	proxy, err := url.Parse("http://proxy.example:8080")
	if err != nil {
		t.Fatal(err)
	}
	c := NewClientWithProxy(proxy)
	transport, ok := c.HTTPClient.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport = %T, want *http.Transport", c.HTTPClient.Transport)
	}
	req, err := http.NewRequest(http.MethodGet, "https://acme.geektr.cloud/", nil)
	if err != nil {
		t.Fatal(err)
	}
	got, err := transport.Proxy(req)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.String() != proxy.String() {
		t.Fatalf("proxy = %v, want %s", got, proxy)
	}
}

func TestIssue_Success(t *testing.T) {
	fullchain, privateKey, notBefore, notAfter, err := testutil.Certificate([]string{"example.com"})
	if err != nil {
		t.Fatal(err)
	}

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != issuePath {
			t.Errorf("expected %s, got %s", issuePath, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("unexpected auth header: %s", r.Header.Get("Authorization"))
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode body: %v", err)
		}
		domains, ok := body["domains"].([]any)
		if !ok || len(domains) != 1 || domains[0] != "example.com" {
			t.Errorf("unexpected domains: %v", body["domains"])
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"commonName":  "example.com",
			"sans":        []string{"example.com"},
			"privateKey":  privateKey,
			"certificate": fullchain,
			"chain":       fullchain,
			"fullchain":   fullchain,
			"notBefore":   notBefore.Format(time.RFC3339),
			"notAfter":    notAfter.Format(time.RFC3339),
		}); err != nil {
			t.Errorf("encode response: %v", err)
		}
	}))
	defer server.Close()

	resp, err := testHTTPClient(server).Issue(
		context.Background(),
		server.URL,
		"test-token",
		[]string{"example.com"},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.CommonName != "example.com" {
		t.Errorf("expected commonName example.com, got %s", resp.CommonName)
	}
	if resp.Fullchain != fullchain {
		t.Errorf("fullchain mismatch")
	}
	if !resp.NotBefore.Equal(notBefore) {
		t.Errorf("notBefore mismatch: got %v, want %v", resp.NotBefore, notBefore)
	}
	if !resp.NotAfter.Equal(notAfter) {
		t.Errorf("notAfter mismatch: got %v, want %v", resp.NotAfter, notAfter)
	}
}

func TestIssue_InvalidResponse(t *testing.T) {
	validChain, validKey, notBefore, notAfter, err := testutil.Certificate([]string{"wrong.example.com"})
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		domains []string
		body    map[string]any
	}{
		{
			name:    "empty fullchain",
			domains: []string{"example.com"},
			body: map[string]any{
				"privateKey": validKey,
				"fullchain":  "",
				"notBefore":  notBefore.Format(time.RFC3339),
				"notAfter":   notAfter.Format(time.RFC3339),
			},
		},
		{
			name:    "invalid key",
			domains: []string{"example.com"},
			body: map[string]any{
				"privateKey": "not-a-key",
				"fullchain":  validChain,
				"notBefore":  notBefore.Format(time.RFC3339),
				"notAfter":   notAfter.Format(time.RFC3339),
			},
		},
		{
			name:    "missing validity",
			domains: []string{"example.com"},
			body: map[string]any{
				"privateKey": validKey,
				"fullchain":  validChain,
			},
		},
		{
			name:    "wrong sans",
			domains: []string{"example.com"},
			body: map[string]any{
				"privateKey": validKey,
				"fullchain":  validChain,
				"notBefore":  notBefore.Format(time.RFC3339),
				"notAfter":   notAfter.Format(time.RFC3339),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(w).Encode(tt.body); err != nil {
					t.Errorf("encode response: %v", err)
				}
			}))
			defer server.Close()

			if _, err := testHTTPClient(server).Issue(
				context.Background(),
				server.URL,
				"token",
				tt.domains,
			); err == nil {
				t.Fatal("expected response validation error")
			}
		})
	}
}

func TestIssue_ErrorResponse(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPreconditionFailed)
		if err := json.NewEncoder(w).Encode(map[string]any{
			"status": 412,
			"error":  "domain not registered",
		}); err != nil {
			t.Errorf("encode response: %v", err)
		}
	}))
	defer server.Close()

	_, err := testHTTPClient(server).Issue(
		context.Background(),
		server.URL,
		"token",
		[]string{"bad.com"},
	)
	if err == nil {
		t.Fatal("expected error")
	}

	var issueErr *IssueError
	if !errors.As(err, &issueErr) {
		t.Fatalf("expected *IssueError, got %T: %v", err, err)
	}
	if issueErr.Status != 412 {
		t.Errorf("expected status 412, got %d", issueErr.Status)
	}
	if issueErr.Err != "domain not registered" {
		t.Errorf("unexpected error message: %s", issueErr.Err)
	}
}

func TestIssue_NonJSONError(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		if _, err := w.Write([]byte("internal error")); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()

	_, err := testHTTPClient(server).Issue(
		context.Background(),
		server.URL,
		"token",
		[]string{"example.com"},
	)
	if err == nil {
		t.Fatal("expected error")
	}
	var issueErr *IssueError
	if errors.As(err, &issueErr) {
		t.Fatalf("should not be *IssueError for non-JSON body, got: %v", issueErr)
	}
}

func TestIssue_MalformedJSON(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte("{invalid")); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	defer server.Close()

	_, err := testHTTPClient(server).Issue(
		context.Background(),
		server.URL,
		"token",
		[]string{"example.com"},
	)
	if err == nil {
		t.Fatal("expected error for malformed JSON")
	}
}

func TestParseMaxAge(t *testing.T) {
	tests := []struct {
		input string
		want  time.Duration
	}{
		{"max-age=3600", 3600 * time.Second},
		{"public, max-age=3600", 3600 * time.Second},
		{"no-cache", 0},
		{"max-age=abc", 0},
		{"max-age=0", 0},
		{"max-age=-1", 0},
		{"", 0},
	}
	for _, tt := range tests {
		got := ParseMaxAge(tt.input)
		if got != tt.want {
			t.Errorf("ParseMaxAge(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}
