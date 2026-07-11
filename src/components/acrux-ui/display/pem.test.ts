import { describe, it, expect } from "vitest";
import { parsePemBody, pemToBytes, pemFingerprint } from "./pem";

// ---------- test fixtures (generated with openssl, see pem.test.ts comments) ----------

const RSA_2048 = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCR6WNKuN0GIobK
rnXxNkr3d6kFnGRypqrpxvtEmHrFGCHVRfEooAT9dPKhYMUDD/KYOAVfCmxyNcRz
0CHUb70HORioW5W0P64pRYI8CPiRtis8Yy/Uj/uXgK5E4pB1UwuWxcBfnLynMyuz
AJo8pzZo+/qSJW8c+OTjQB7y/3bLNUr9EwAquIaQJ8XEJ3ZKij8V6rV4bTMjx82U
oLwLFjj0o5h5woKzybTEotT3Hi+pQjdzOvJLuJzgwom6dqME+En2uQcyRPDVjXYn
dRFXQmkB22eDPSv9qFrYM6aMvpCkFm2SKfQ7/OY1dl0hKhdpiv+wYU6SiioKJtNc
a9Z5xBYrAgMBAAECggEAFupM9jy/NYnxml441qecsW3BBUkQ+3KScAGYj6bUzSRj
l9+Sprsu3XFi85ZDip4UDvTpXwo/itZH4ppi3b6otLwyU6qCgdroasHoWK5d/2BZ
PPQk3GC6dgo3FElyv4JJ1SV8d2ehty6Ro9yp3HG0WVuNeCtZ3nZ2V/xHgAk/6lzZ
AtU9YyYOhv+AFZ+wDwlsK440E3t8GM9PSJepln0NklVLovpt7E9kvkVo7wv8wMk4
i+DVL9Fr/TdhrIX75YcpG/4piq6FEHIBdvnVizk7y1vZJ5KBwzaoKTNMBfr7JK26
m3TxJ6r6g9unQKILUoaAjMoQ8fq/5hhiliT7J62RWQKBgQDKe3PgeA3atCprs6sh
WbhlSLZ2/jxbXIFHU+TX222flM8XObv2GZe1o2sGYsxGfj3te+j8assu2FvbDAli
HylKHuBa1l8TTZAh2bbDpUs9IMjyytiDxwsWlVwBg1v8166cKAplyvzWPWbo9gcG
RuDTxAl8Vr0U0z1H/Gq34PY1GQKBgQC4ejQOBDAIftqdhyU/q002kGTd0XeA7cfI
zTcOLfnn3+06l8+1No+KaVtYOYmRZhCOI5vOJB4luZ7oySxWnG7wPonAhaHlKv1Y
D1S09tr6XkOg5VJBbB31wTITUHhzGYA/hTh50cNoAlp3aEDzy+0ji99LuNrnDhbo
ReL3dMIp4wKBgQDD919a7FZcSOqVejox+Oeh/xG5cK1xrsHgCq38y/346MjVLadg
s7xEq3i1oYEa6Kt+4OHJCoLDP9sG0Utzj70iY2e4AqnZwMOyP0fHan67FrPlZ7TN
NSLiJIP7Yurwdr4jnA0UH7U8lAi5hwOda5PE4IJduIUfVqKEvSN7+1nOYQKBgC0a
9A9ZRsVM/vb1TE48/CwTMhZqWOXVPbwDMSruYuQnBEIHTGnqZT5adFMl/lTmt7WJ
T1cfzZ87u3b/eS/UH+vt3pCMHAGEeV1Gold85B3DXpXAfFQys0CbdDr0uf6qhYkC
ccSXXUfZC3WWsArsGZdPY9GH6T4FW+R+8fe/PJoxAoGBALE0+UWl4r1v93hPbCI9
xGstLPKqjnWeIB8I8U3ZZPSAZL4dGUHcpP6DwrygW7/9RjfWCn8pZPc5kAAv5oKa
HW2rKQtMQEWVrsT1L5bpS5IC8VfzVsHPDx5spL+Ag/SjVQN5Gw7C+xkeYEcPcgU9
2bpYJQSZxvBYAedvkvGIaf8b
-----END PRIVATE KEY-----`;

const EC_P256 = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIPcotpVcOkxQehlNQaA/zWCsA/xSozz+0n/uEClpbijKoAoGCCqGSM49
AwEHoUQDQgAECuNqUhfcG/XW9pjvtq/BDcAPAw/Oadw1f5oaJ+4WJWl7yhE00vZs
PN4fuKuxnxLnX7ETwixogRSBfadK6Ph2ig==
-----END EC PRIVATE KEY-----`;

const CERT_SELFSIGNED = `-----BEGIN CERTIFICATE-----
MIIBizCCATGgAwIBAgIUNZGiRw47SFB2kJ+EXBi5PxS1CBIwCgYIKoZIzj0EAwIw
GzEZMBcGA1UEAwwQdGVzdC5leGFtcGxlLmNvbTAeFw0yNjA3MTEwODM3NTRaFw0z
NjA3MDgwODM3NTRaMBsxGTAXBgNVBAMMEHRlc3QuZXhhbXBsZS5jb20wWTATBgcq
hkjOPQIBBggqhkjOPQMBBwNCAARbOxZNI4WF8MA3ISPnHj9e1oLecNWGXcM50hHf
MZOWTQSVUBqqZUU+BIGBanKBfxN3dfQ19szmDsYmE0jFk7jio1MwUTAdBgNVHQ4E
FgQUAxjJPej1yrBceA1r9FkzE0zcHawwHwYDVR0jBBgwFoAUAxjJPej1yrBceA1r
9FkzE0zcHawwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiBfWrUq
9voz+OeqetNGYI+RpH89EeYN6DKwZJ/GsczergIhAKuCxHq4UVMA7KTi85vR3rCA
gBBqMGtuJFRaF4ongtDM
-----END CERTIFICATE-----`;

const X25519 = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VuBCIEIEjqVFUQk5v2JeZx1R6C/pZZ5dS3Z05QJa0IC9k4+C9O
-----END PRIVATE KEY-----`;

// Expected fingerprints in all three encodings.
// hex: SHA256 of the decoded DER bytes, colon-separated.
// hex16: last 16 hex chars, space-separated every 4.
// base64: standard base64 of the raw hash.
const EXPECTED = {
  rsa2048: {
    hex: "30:88:6d:9a:b1:ca:d3:38:9e:01:18:59:ca:a1:f4:d5:2b:f9:0a:9f:03:04:2b:34:4e:7d:c1:83:82:49:df:de",
    hex16: "4e7d c183 8249 dfde",
    base64: "MIhtmrHK0zieARhZyqH01Sv5Cp8DBCs0Tn3Bg4JJ394=",
  },
  ecP256: {
    hex: "87:4b:9f:60:f3:b7:8d:5a:5f:7f:b4:65:28:77:1b:95:a0:fb:3d:89:26:0c:0e:22:5f:da:27:9f:ea:1f:99:37",
    hex16: "5fda 279f ea1f 9937",
    base64: "h0ufYPO3jVpff7RlKHcblaD7PYkmDA4iX9onn+ofmTc=",
  },
  cert: {
    hex: "34:9b:72:7e:f4:c6:8c:04:92:71:f0:cd:33:1d:ae:11:1f:da:24:df:be:08:7a:80:cc:46:89:97:12:c7:80:b1",
    hex16: "cc46 8997 12c7 80b1",
    base64: "NJtyfvTGjASScfDNMx2uER/aJN++CHqAzEaJlxLHgLE=",
  },
  x25519: {
    hex: "be:78:74:50:98:ed:c3:bf:9b:c5:6d:e9:00:a9:64:5a:e8:39:1e:3c:b8:91:92:e0:c2:a8:9d:ae:b1:ac:38:76",
    hex16: "c2a8 9dae b1ac 3876",
    base64: "vnh0UJjtw7+bxW3pAKlkWug5Hjy4kZLgwqidrrGsOHY=",
  },
};

// ---------- parsePemBody ----------

describe("parsePemBody", () => {
  it("strips headers, footers, and whitespace from RSA key", () => {
    const body = parsePemBody(RSA_2048);
    expect(body).not.toContain("-----");
    expect(body).not.toContain("\n");
    expect(body).not.toContain("\r");
    expect(body.length).toBeGreaterThan(0);
    // valid base64
    expect(body).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("strips EC key PEM block", () => {
    const body = parsePemBody(EC_P256);
    expect(body).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("strips certificate PEM block", () => {
    const body = parsePemBody(CERT_SELFSIGNED);
    expect(body).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("returns empty string for input with no PEM block", () => {
    expect(parsePemBody("not a pem")).toBe("");
    expect(parsePemBody("")).toBe("");
  });

  it("handles multiple PEM blocks (keeps all bodies concatenated)", () => {
    const multi = EC_P256 + "\n" + EC_P256;
    const body = parsePemBody(multi);
    // should be two base64 blocks concatenated
    expect(body).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

// ---------- pemToBytes ----------

describe("pemToBytes", () => {
  it("returns empty array for empty string", () => {
    expect(pemToBytes("")).toEqual(new Uint8Array(0));
  });

  it("returns empty array for non-PEM text", () => {
    expect(pemToBytes("hello world")).toEqual(new Uint8Array(0));
  });

  it("decodes RSA 2048 key to correct byte length", () => {
    const bytes = pemToBytes(RSA_2048);
    // RSA 2048 private key in PKCS#8 DER is ~1218 bytes
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.length).toBeLessThan(1500);
  });

  it("decodes EC P256 key to 121 bytes", () => {
    const bytes = pemToBytes(EC_P256);
    expect(bytes.length).toBe(121);
  });

  it("decodes X25519 key to ~48 bytes", () => {
    const bytes = pemToBytes(X25519);
    expect(bytes.length).toBe(48);
  });

  it("decodes certificate to >200 bytes", () => {
    const bytes = pemToBytes(CERT_SELFSIGNED);
    expect(bytes.length).toBeGreaterThan(200);
  });
});

// ---------- pemFingerprint ----------

describe("pemFingerprint", () => {
  it("returns empty string for empty input", async () => {
    expect(await pemFingerprint("")).toBe("");
    expect(await pemFingerprint("", "hex")).toBe("");
    expect(await pemFingerprint("", "hex16")).toBe("");
  });

  it("returns empty string for non-PEM text", async () => {
    expect(await pemFingerprint("not a pem")).toBe("");
  });

  // -- base64 (default) --

  describe("encode: base64", () => {
    it("RSA 2048", async () => {
      expect(await pemFingerprint(RSA_2048)).toBe(EXPECTED.rsa2048.base64);
    });

    it("EC P256", async () => {
      expect(await pemFingerprint(EC_P256)).toBe(EXPECTED.ecP256.base64);
    });

    it("certificate", async () => {
      expect(await pemFingerprint(CERT_SELFSIGNED)).toBe(EXPECTED.cert.base64);
    });

    it("X25519", async () => {
      expect(await pemFingerprint(X25519)).toBe(EXPECTED.x25519.base64);
    });
  });

  // -- hex --

  describe("encode: hex", () => {
    it("RSA 2048", async () => {
      expect(await pemFingerprint(RSA_2048, "hex")).toBe(EXPECTED.rsa2048.hex);
    });

    it("EC P256", async () => {
      expect(await pemFingerprint(EC_P256, "hex")).toBe(EXPECTED.ecP256.hex);
    });

    it("certificate", async () => {
      expect(await pemFingerprint(CERT_SELFSIGNED, "hex")).toBe(EXPECTED.cert.hex);
    });

    it("X25519", async () => {
      expect(await pemFingerprint(X25519, "hex")).toBe(EXPECTED.x25519.hex);
    });
  });

  // -- hex16 --

  describe("encode: hex16", () => {
    it("RSA 2048", async () => {
      expect(await pemFingerprint(RSA_2048, "hex16")).toBe(EXPECTED.rsa2048.hex16);
    });

    it("EC P256", async () => {
      expect(await pemFingerprint(EC_P256, "hex16")).toBe(EXPECTED.ecP256.hex16);
    });

    it("certificate", async () => {
      expect(await pemFingerprint(CERT_SELFSIGNED, "hex16")).toBe(EXPECTED.cert.hex16);
    });

    it("X25519", async () => {
      expect(await pemFingerprint(X25519, "hex16")).toBe(EXPECTED.x25519.hex16);
    });
  });

  // -- general --

  it("is deterministic", async () => {
    expect(await pemFingerprint(RSA_2048)).toBe(await pemFingerprint(RSA_2048));
  });

  it("different keys → different fingerprints", async () => {
    expect(await pemFingerprint(RSA_2048)).not.toBe(await pemFingerprint(EC_P256));
  });
});
