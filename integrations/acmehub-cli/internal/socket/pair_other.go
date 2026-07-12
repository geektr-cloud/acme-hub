//go:build !unix

package socket

import (
	"fmt"
	"net"
	"os"
)

// NewPair is unsupported on non-unix platforms. A name-based transport
// (ACMEHUB_SOCK_ADDR, e.g. Windows named pipes) is the intended future path.
func NewPair() (parentConn net.Conn, childFile *os.File, err error) {
	return nil, nil, fmt.Errorf("socketpair transport is not supported on this platform")
}
