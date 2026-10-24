package client

import (
	"net/http"
	"net/url"
	"testing"
)

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

func TestNewHTTPClientWithProxy(t *testing.T) {
	proxy, err := url.Parse("http://proxy.example:8080")
	if err != nil {
		t.Fatal(err)
	}
	c := newHTTPClient(proxy)
	transport, ok := c.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport = %T, want *http.Transport", c.Transport)
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
