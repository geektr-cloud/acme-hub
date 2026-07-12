package hook

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/geektr-cloud/acmehub-cli/internal/certkit"
	"github.com/geektr-cloud/acmehub-cli/internal/socket"
)

// childFD is the fd number the child sees for the inherited socket end. It is
// always 3 because it is the first (and only) entry in ExtraFiles.
const childFD = 3

// RunExec executes cmd directly (no shell). The command string is split on
// whitespace into argv; complex commands should use RunShell instead. The hook
// can call `acmehub-cli sock ...` itself to retrieve certificate material over
// the inherited socket.
func RunExec(cmdStr string, cert *certkit.Cert) error {
	fields := strings.Fields(cmdStr)
	if len(fields) == 0 {
		return fmt.Errorf("post_exec is empty")
	}
	c := exec.Command(fields[0], fields[1:]...)
	return spawn(c, cert)
}

// RunShell runs script through a discovered POSIX shell (bash -> sh -> ash),
// injecting an `acme()` helper that forwards to `<self> sock "$@"`.
func RunShell(script string, cert *certkit.Cert) error {
	shell, err := findShell()
	if err != nil {
		return err
	}

	self, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve own executable path: %w", err)
	}

	preamble := fmt.Sprintf("acme() { %q sock \"$@\"; }\n", self)
	c := exec.Command(shell, "-c", preamble+script)
	return spawn(c, cert)
}

// findShell locates a usable POSIX shell.
func findShell() (string, error) {
	for _, name := range []string{"bash", "sh", "ash"} {
		if path, err := exec.LookPath(name); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("no POSIX shell found (looked for bash, sh, ash)")
}

// spawn wires up a fresh socketpair serving the given cert snapshot, launches
// the command with the child socket end on fd 3 and ACMEHUB_SOCK_FD=3, streams
// the child's stdout/stderr through, waits, and cleans up.
func spawn(c *exec.Cmd, cert *certkit.Cert) error {
	parentConn, childFile, err := socket.NewPair()
	if err != nil {
		return err
	}
	defer parentConn.Close()
	defer childFile.Close()

	serveErr := make(chan error, 1)
	go func() {
		serveErr <- socket.Serve(parentConn, cert)
	}()

	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	c.Stdin = os.Stdin
	c.ExtraFiles = []*os.File{childFile}
	c.Env = append(os.Environ(),
		fmt.Sprintf("ACMEHUB_SOCK_FD=%d", childFD),
		"ACMEHUB_SOCK_ADDR=",
	)

	if err := c.Start(); err != nil {
		return fmt.Errorf("start hook: %w", err)
	}
	// The parent no longer needs the child's fd once it's been passed on.
	childFile.Close()

	waitErr := c.Wait()

	// Closing the parent conn unblocks the serve loop if the child tree has
	// exited without closing its end.
	parentConn.Close()
	<-serveErr

	if waitErr != nil {
		return fmt.Errorf("hook exited with error: %w", waitErr)
	}
	return nil
}
