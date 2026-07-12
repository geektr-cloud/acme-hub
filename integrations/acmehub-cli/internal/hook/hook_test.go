package hook

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/geektr-cloud/acmehub-cli/internal/certkit"
)

// buildCLI compiles the acmehub-cli binary into a temp dir so the injected
// `acme()` helper (which shells out to `<self> sock ...`) has a real binary to
// call. os.Executable() during `go test` points at the test binary, which does
// not have the sock subcommand, so we override PATH-independent behavior by
// building the real CLI and pointing the hook's self path at it.
func buildCLI(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	bin := filepath.Join(dir, "acmehub-cli")
	// The module root is two levels up from internal/hook.
	cmd := exec.Command("go", "build", "-o", bin, "github.com/geektr-cloud/acmehub-cli")
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("build cli: %v", err)
	}
	return bin
}

func fakeCert() *certkit.Cert {
	return &certkit.Cert{
		CommonName:  "test.example.com",
		Certificate: "CERT-PEM-CONTENT",
		PrivateKey:  "PRIVATE-PEM-CONTENT",
		Fullchain:   "FULLCHAIN-PEM",
		Chain:       "CHAIN-PEM",
		NotBefore:   time.Now().Add(-time.Hour),
		NotAfter:    time.Now().Add(time.Hour),
	}
}

// spawnWithSelf is like spawn but overrides the self path used in the preamble.
func runShellWith(t *testing.T, self, script string, cert *certkit.Cert) {
	t.Helper()
	preamble := "acme() { \"" + self + "\" sock \"$@\"; }\n"
	c := exec.Command("sh", "-c", preamble+script)
	if err := spawn(c, cert); err != nil {
		t.Fatalf("spawn: %v", err)
	}
}

func TestHookEndToEnd(t *testing.T) {
	if _, err := exec.LookPath("sh"); err != nil {
		t.Skip("sh not available")
	}

	bin := buildCLI(t)
	out := filepath.Join(t.TempDir(), "out.txt")
	cert := fakeCert()

	// Sequential retrieval of two verbs on the same inherited socket.
	script := "acme public > " + out + "; echo '---' >> " + out + "; acme private >> " + out
	runShellWith(t, bin, script, cert)

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	got := string(data)
	if !strings.Contains(got, "CERT-PEM-CONTENT") {
		t.Errorf("missing public cert in output: %q", got)
	}
	if !strings.Contains(got, "PRIVATE-PEM-CONTENT") {
		t.Errorf("missing private key in output: %q", got)
	}
	// Ordering: public before private.
	if strings.Index(got, "CERT-PEM-CONTENT") > strings.Index(got, "PRIVATE-PEM-CONTENT") {
		t.Errorf("expected public before private: %q", got)
	}
}

func TestFindShell(t *testing.T) {
	if _, err := findShell(); err != nil {
		t.Skipf("no shell available: %v", err)
	}
}
