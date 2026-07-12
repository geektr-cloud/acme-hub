package certkit

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"
	"time"
)

// testCert builds a Cert with a known lifetime for deterministic assertions.
func testCert(notBefore, notAfter time.Time) *Cert {
	return &Cert{
		CommonName:  "test.example.com",
		SANs:        []string{"test.example.com", "www.example.com"},
		PrivateKey:  "PRIVATE-KEY-PEM",
		Certificate: "CERT-PEM",
		Chain:       "CHAIN-PEM",
		Fullchain:   "FULLCHAIN-PEM",
		NotBefore:   notBefore,
		NotAfter:    notAfter,
	}
}

func TestDispatchMaterialVerbs(t *testing.T) {
	c := testCert(time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	cases := map[string]string{
		"public":    "CERT-PEM",
		"private":   "PRIVATE-KEY-PEM",
		"fullchain": "FULLCHAIN-PEM",
		"chain":     "CHAIN-PEM",
	}
	for verb, want := range cases {
		got, err := Dispatch(c, []string{verb})
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", verb, err)
		}
		if string(got) != want {
			t.Errorf("%s: got %q, want %q", verb, got, want)
		}
	}
}

func TestDispatchUnknownVerb(t *testing.T) {
	c := testCert(time.Now(), time.Now().Add(time.Hour))
	if _, err := Dispatch(c, []string{"bogus"}); err == nil {
		t.Fatal("expected error for unknown verb")
	}
	if _, err := Dispatch(c, nil); err == nil {
		t.Fatal("expected error for empty args")
	}
}

func TestDispatchRenewAt(t *testing.T) {
	nb := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	na := nb.Add(100 * time.Hour)
	c := testCert(nb, na)

	got, err := Dispatch(c, []string{"renew-at"})
	if err != nil {
		t.Fatal(err)
	}
	// 0.9 * 100h = 90h after notBefore.
	want := nb.Add(90 * time.Hour).Format(time.RFC3339)
	if string(got) != want {
		t.Errorf("renew-at: got %q, want %q", got, want)
	}
}

func TestUntilExpireUnits(t *testing.T) {
	now := time.Now()
	// Expires in exactly 48h + a sliver, so floor(day)=2, floor(hour)=48.
	c := testCert(now.Add(-time.Hour), now.Add(48*time.Hour+30*time.Minute))

	cases := []struct {
		args []string
		want int64
	}{
		{[]string{"until-expire"}, 2},
		{[]string{"until-expire", "-f", "day"}, 2},
		{[]string{"until-expire", "-f", "hour"}, 48},
		{[]string{"until-expire", "--format", "hour"}, 48},
	}
	for _, tc := range cases {
		got, err := Dispatch(c, tc.args)
		if err != nil {
			t.Fatalf("%v: %v", tc.args, err)
		}
		n, err := strconv.ParseInt(string(got), 10, 64)
		if err != nil {
			t.Fatalf("%v: parse %q: %v", tc.args, got, err)
		}
		if n != tc.want {
			t.Errorf("%v: got %d, want %d", tc.args, n, tc.want)
		}
	}
}

func TestUntilExpireExpired(t *testing.T) {
	now := time.Now()
	// Expired 25h ago -> floor(day) = -2 (since -25h/24h = -1.04, floor = -2).
	c := testCert(now.Add(-100*time.Hour), now.Add(-25*time.Hour))
	got, err := Dispatch(c, []string{"until-expire"})
	if err != nil {
		t.Fatal(err)
	}
	n, err := strconv.ParseInt(string(got), 10, 64)
	if err != nil {
		t.Fatal(err)
	}
	if n >= 0 {
		t.Errorf("expected negative remaining for expired cert, got %d", n)
	}
}

func TestUntilExpireBadUnit(t *testing.T) {
	c := testCert(time.Now(), time.Now().Add(time.Hour))
	if _, err := Dispatch(c, []string{"until-expire", "-f", "year"}); err == nil {
		t.Fatal("expected error for invalid unit")
	}
}

func TestMeta(t *testing.T) {
	nb := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	na := nb.Add(100 * time.Hour)
	c := testCert(nb, na)
	got, err := Dispatch(c, []string{"meta"})
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(got, &m); err != nil {
		t.Fatalf("meta output not JSON: %v", err)
	}
	if m["commonName"] != "test.example.com" {
		t.Errorf("meta commonName: got %v", m["commonName"])
	}
	if !strings.Contains(string(got), "renewAt") {
		t.Errorf("meta missing renewAt: %s", got)
	}
}

func TestParseIssueResponse(t *testing.T) {
	body := `{
		"commonName": "test.example.com",
		"sans": ["test.example.com", "www.example.com"],
		"privateKey": "PK",
		"certificate": "CERT",
		"chain": "CHAIN",
		"fullchain": "FULL",
		"notBefore": "2026-01-01T00:00:00Z",
		"notAfter": "2026-04-01T00:00:00Z"
	}`
	c, err := ParseIssueResponse([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if c.CommonName != "test.example.com" {
		t.Errorf("commonName: %s", c.CommonName)
	}
	if !c.NotBefore.Equal(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("notBefore: %v", c.NotBefore)
	}
	if len(c.SANs) != 2 {
		t.Errorf("sans: %v", c.SANs)
	}
}

func TestParseIssueResponseBadTime(t *testing.T) {
	body := `{"notBefore":"nope","notAfter":"2026-04-01T00:00:00Z"}`
	if _, err := ParseIssueResponse([]byte(body)); err == nil {
		t.Fatal("expected error for bad notBefore")
	}
}
