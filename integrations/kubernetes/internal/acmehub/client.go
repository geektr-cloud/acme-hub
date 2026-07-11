package acmehub

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const issuePath = "/pki/v1/certificates/issue"

// IssueResponse represents the response from acme-hub's issue endpoint.
type IssueResponse struct {
	CommonName  string    `json:"commonName"`
	Sans        []string  `json:"sans"`
	PrivateKey  string    `json:"privateKey"`
	Certificate string    `json:"certificate"`
	Chain       string    `json:"chain"`
	Fullchain   string    `json:"fullchain"`
	NotBefore   time.Time `json:"notBefore"`
	NotAfter    time.Time `json:"notAfter"`
}

// IssueError represents an error response from acme-hub.
type IssueError struct {
	Status int    `json:"status"`
	Err    string `json:"error"`
}

func (e *IssueError) Error() string {
	return fmt.Sprintf("acme-hub returned %d: %s", e.Status, e.Err)
}

// Client is an HTTP client for the acme-hub PKI API.
type Client struct {
	HTTPClient *http.Client
}

// NewClient creates a new acme-hub client with sensible defaults.
func NewClient() *Client {
	return &Client{
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Issue calls the acme-hub issue endpoint and returns the certificate response.
func (c *Client) Issue(ctx context.Context, endpoint, token string, domains []string) (*IssueResponse, error) {
	body, err := json.Marshal(map[string]any{
		"domains": domains,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := strings.TrimRight(endpoint, "/") + issuePath
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		var issueErr IssueError
		if json.Unmarshal(respBody, &issueErr) == nil && issueErr.Status != 0 {
			return nil, &issueErr
		}
		return nil, fmt.Errorf("acme-hub returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result IssueResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// ParseMaxAge extracts the max-age value from the Cache-Control header.
func ParseMaxAge(cc string) time.Duration {
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
