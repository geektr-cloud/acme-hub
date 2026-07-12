package certkit

import (
	"crypto/ecdsa"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/spf13/pflag"
	pkcs12 "software.sslmate.com/src/go-pkcs12"
)

// RenewRatio is the client-local lifetime fraction at which a certificate is
// considered due for renewal. It is unrelated to the server-side Cache-Control
// max-age; this is only used by renew-at and the daemon scheduler.
const RenewRatio = 0.9

// RenewAt returns the local renewal timestamp: notBefore + RenewRatio*lifetime.
func (c *Cert) RenewAt() time.Time {
	lifetime := c.NotAfter.Sub(c.NotBefore)
	return c.NotBefore.Add(time.Duration(float64(lifetime) * RenewRatio))
}

// Dispatch parses a verb (+ flags) from args and returns the bytes to emit.
// It is shared by the agent socket handler and the standalone sock path.
func Dispatch(c *Cert, args []string) ([]byte, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("no verb given; expected one of: public, private, fullchain, chain, renew-at, until-expire, pkcs12, meta")
	}
	verb, rest := args[0], args[1:]

	switch verb {
	case "public":
		return []byte(c.Certificate), nil
	case "private":
		return []byte(c.PrivateKey), nil
	case "fullchain":
		return []byte(c.Fullchain), nil
	case "chain":
		return []byte(c.Chain), nil
	case "renew-at":
		return []byte(c.RenewAt().Format(time.RFC3339)), nil
	case "until-expire":
		return untilExpire(c, rest)
	case "pkcs12":
		return toPKCS12(c, rest)
	case "meta":
		return meta(c)
	default:
		return nil, fmt.Errorf("unknown verb %q; expected one of: public, private, fullchain, chain, renew-at, until-expire, pkcs12, meta", verb)
	}
}

// untilExpire returns the remaining time until notAfter (true expiry), floored
// to an integer in the requested unit (default day). Already-expired certs
// yield a negative integer.
func untilExpire(c *Cert, args []string) ([]byte, error) {
	fs := pflag.NewFlagSet("until-expire", pflag.ContinueOnError)
	unit := fs.StringP("format", "f", "day", "unit: day|hour|second")
	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	remaining := time.Until(c.NotAfter)

	var perUnit time.Duration
	switch *unit {
	case "day":
		perUnit = 24 * time.Hour
	case "hour":
		perUnit = time.Hour
	case "second":
		perUnit = time.Second
	default:
		return nil, fmt.Errorf("invalid --format %q; expected day|hour|second", *unit)
	}

	n := int64(math.Floor(float64(remaining) / float64(perUnit)))
	return []byte(strconv.FormatInt(n, 10)), nil
}

// toPKCS12 assembles a PKCS#12 archive from the private key + leaf certificate
// + chain (as CA certs).
func toPKCS12(c *Cert, args []string) ([]byte, error) {
	fs := pflag.NewFlagSet("pkcs12", pflag.ContinueOnError)
	password := fs.String("password", "", "encryption password (default empty)")
	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	key, err := parsePrivateKey([]byte(c.PrivateKey))
	if err != nil {
		return nil, err
	}

	leaf, err := parseSingleCert([]byte(c.Certificate))
	if err != nil {
		return nil, fmt.Errorf("parse leaf certificate: %w", err)
	}

	caCerts, err := parseCerts([]byte(c.Chain))
	if err != nil {
		return nil, fmt.Errorf("parse chain: %w", err)
	}

	// Passwordless archives require the dedicated encoder; Modern rejects an
	// empty password.
	enc := pkcs12.Modern
	if *password == "" {
		enc = pkcs12.Passwordless
	}
	out, err := enc.Encode(key, leaf, caCerts, *password)
	if err != nil {
		return nil, fmt.Errorf("encode pkcs12: %w", err)
	}
	return out, nil
}

func meta(c *Cert) ([]byte, error) {
	m := map[string]any{
		"commonName": c.CommonName,
		"sans":       c.SANs,
		"notBefore":  c.NotBefore.Format(time.RFC3339),
		"notAfter":   c.NotAfter.Format(time.RFC3339),
		"renewAt":    c.RenewAt().Format(time.RFC3339),
	}
	b, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// parsePrivateKey parses a PEM-encoded private key (PKCS#8, PKCS#1, or EC).
func parsePrivateKey(pemBytes []byte) (any, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, fmt.Errorf("no PEM block found in private key")
	}

	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	if key, err := x509.ParseECPrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, fmt.Errorf("unsupported private key format")
}

// parseSingleCert parses the first certificate from a PEM bundle.
func parseSingleCert(pemBytes []byte) (*x509.Certificate, error) {
	certs, err := parseCerts(pemBytes)
	if err != nil {
		return nil, err
	}
	if len(certs) == 0 {
		return nil, fmt.Errorf("no certificate found")
	}
	return certs[0], nil
}

// parseCerts parses all certificates from a PEM bundle.
func parseCerts(pemBytes []byte) ([]*x509.Certificate, error) {
	var certs []*x509.Certificate
	rest := pemBytes
	for {
		var block *pem.Block
		block, rest = pem.Decode(rest)
		if block == nil {
			break
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		certs = append(certs, cert)
	}
	return certs, nil
}

// ensure crypto key types are referenced for clarity in supported key set.
var (
	_ = (*ecdsa.PrivateKey)(nil)
	_ = (*rsa.PrivateKey)(nil)
)
