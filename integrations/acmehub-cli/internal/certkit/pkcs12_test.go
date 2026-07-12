package certkit

import (
	"testing"
	"time"

	pkcs12 "software.sslmate.com/src/go-pkcs12"
)

// Real ECDSA P-256 key + matching self-signed cert (test fixtures, never used
// in production).
const testKeyPEM = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIJIkgr5n+v4sV39p5anoNLKfZxPtreNMW/NQQfKUeu1RoAoGCCqGSM49
AwEHoUQDQgAEz0kiy72Wj1kiPP7E6sEzzQM4MA/PedzoDXt0JLfHS/hvaA3mJ2VO
Ac6gF2WOnOz8g/rDMJR7UxwDoJnAXbkpng==
-----END EC PRIVATE KEY-----`

const testCertPEM = `-----BEGIN CERTIFICATE-----
MIIBuTCCAWCgAwIBAgIUUzLnRv8RiYF9YgqaBRli4cjIfUYwCgYIKoZIzj0EAwIw
GzEZMBcGA1UEAwwQdGVzdC5leGFtcGxlLmNvbTAeFw0yNjA3MTIxMTQ4NTVaFw0y
NjA4MTExMTQ4NTVaMBsxGTAXBgNVBAMMEHRlc3QuZXhhbXBsZS5jb20wWTATBgcq
hkjOPQIBBggqhkjOPQMBBwNCAATPSSLLvZaPWSI8/sTqwTPNAzgwD8953OgNe3Qk
t8dL+G9oDeYnZU4BzqAXZY6c7PyD+sMwlHtTHAOgmcBduSmeo4GBMH8wHQYDVR0O
BBYEFKjkkZtV6Pch+ckdMePaoxnsMqrjMB8GA1UdIwQYMBaAFKjkkZtV6Pch+ckd
MePaoxnsMqrjMA8GA1UdEwEB/wQFMAMBAf8wLAYDVR0RBCUwI4IQdGVzdC5leGFt
cGxlLmNvbYIPd3d3LmV4YW1wbGUuY29tMAoGCCqGSM49BAMCA0cAMEQCIAaz0VcN
v0rVMTZB08mlDV+D6S4vFKo065YX1qaAKZ66AiB+Jcw3uaaE0qy7hsFO8LV7wf4z
cLKusH6Lj/S/w5dKLQ==
-----END CERTIFICATE-----`

func pkcs12TestCert() *Cert {
	return &Cert{
		CommonName:  "test.example.com",
		PrivateKey:  testKeyPEM,
		Certificate: testCertPEM,
		Chain:       "",
		NotBefore:   time.Now().Add(-time.Hour),
		NotAfter:    time.Now().Add(time.Hour),
	}
}

func TestPKCS12Passwordless(t *testing.T) {
	c := pkcs12TestCert()
	out, err := Dispatch(c, []string{"pkcs12"})
	if err != nil {
		t.Fatalf("pkcs12: %v", err)
	}
	if len(out) == 0 {
		t.Fatal("empty pkcs12 output")
	}
	// Passwordless archives decode with an empty password.
	if _, _, err := pkcs12.Decode(out, ""); err != nil {
		t.Fatalf("decode passwordless pkcs12: %v", err)
	}
}

func TestPKCS12WithPassword(t *testing.T) {
	c := pkcs12TestCert()
	out, err := Dispatch(c, []string{"pkcs12", "--password", "s3cret"})
	if err != nil {
		t.Fatalf("pkcs12: %v", err)
	}
	if _, _, err := pkcs12.Decode(out, "s3cret"); err != nil {
		t.Fatalf("decode encrypted pkcs12: %v", err)
	}
}
