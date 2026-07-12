//go:build unix

package socket

import (
	"fmt"
	"net"
	"os"
	"syscall"
)

// NewPair creates a connected AF_UNIX SOCK_STREAM socket pair. It returns a
// net.Conn for the parent (serve loop) side and an *os.File for the child side,
// intended to be passed via exec.Cmd.ExtraFiles so it lands on fd 3 in the
// child. The caller owns both ends and must close them.
func NewPair() (parentConn net.Conn, childFile *os.File, err error) {
	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, nil, fmt.Errorf("socketpair: %w", err)
	}

	parentFile := os.NewFile(uintptr(fds[0]), "acmehub-sock-parent")
	if parentFile == nil {
		syscall.Close(fds[0])
		syscall.Close(fds[1])
		return nil, nil, fmt.Errorf("failed to wrap parent fd")
	}

	conn, err := net.FileConn(parentFile)
	// FileConn dups the fd; close our copy regardless of outcome.
	parentFile.Close()
	if err != nil {
		syscall.Close(fds[1])
		return nil, nil, fmt.Errorf("FileConn: %w", err)
	}

	childFile = os.NewFile(uintptr(fds[1]), "acmehub-sock-child")
	if childFile == nil {
		conn.Close()
		syscall.Close(fds[1])
		return nil, nil, fmt.Errorf("failed to wrap child fd")
	}

	return conn, childFile, nil
}
