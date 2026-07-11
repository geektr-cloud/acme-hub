package acmehub

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestIssue_Success(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		json.NewDecoder(r.Body).Decode(&body)
		domains, ok := body["domains"].([]any)
		if !ok || len(domains) != 1 || domains[0].(string) != "example.com" {
			t.Errorf("unexpected domains: %v", body["domains"])
		}

		w.Header().Set("Cache-Control", "max-age=3600")
		json.NewEncoder(w).Encode(map[string]any{
			"commonName":  "example.com",
			"sans":        []string{"example.com"},
			"privateKey":  "KEY",
			"certificate": "CERT",
			"chain":       "CHAIN",
			"fullchain":   "FULLCHAIN",
			"notBefore":   now.Format(time.RFC3339),
			"notAfter":    now.Add(90 * 24 * time.Hour).Format(time.RFC3339),
		})
	}))
	defer server.Close()

	client := NewClient()
	resp, err := client.Issue(context.Background(), server.URL, "test-token", []string{"example.com"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.CommonName != "example.com" {
		t.Errorf("expected commonName example.com, got %s", resp.CommonName)
	}
	if resp.Fullchain != "FULLCHAIN" {
		t.Errorf("expected fullchain FULLCHAIN, got %s", resp.Fullchain)
	}
	if !resp.NotBefore.Equal(now) {
		t.Errorf("notBefore mismatch: got %v, want %v", resp.NotBefore, now)
	}
}

func TestIssue_ErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPreconditionFailed)
		json.NewEncoder(w).Encode(map[string]any{
			"status": 412,
			"error":  "domain not registered",
		})
	}))
	defer server.Close()

	client := NewClient()
	_, err := client.Issue(context.Background(), server.URL, "token", []string{"bad.com"})
	if err == nil {
		t.Fatal("expected error")
	}

	issueErr, ok := err.(*IssueError)
	if !ok {
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
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := NewClient()
	_, err := client.Issue(context.Background(), server.URL, "token", []string{"example.com"})
	if err == nil {
		t.Fatal("expected error")
	}
	if issueErr, ok := err.(*IssueError); ok {
		t.Fatalf("should not be *IssueError for non-JSON body, got: %v", issueErr)
	}
}

func TestIssue_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("{invalid"))
	}))
	defer server.Close()

	client := NewClient()
	_, err := client.Issue(context.Background(), server.URL, "token", []string{"example.com"})
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
