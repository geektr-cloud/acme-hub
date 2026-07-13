package socket

import (
	"errors"
	"io"
	"net"

	"github.com/geektr-cloud/acme-hub/integrations/acmehub-cli/internal/certkit"
)

// Serve reads requests from conn one at a time, dispatches each against cert,
// and writes the response. It processes requests strictly sequentially, which
// is required because the socketpair carries a single interleaved stream shared
// by the whole child process tree. Serve returns nil on clean EOF.
func Serve(conn net.Conn, cert *certkit.Cert) error {
	for {
		argv, err := ReadRequest(conn)
		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, net.ErrClosed) {
				return nil
			}
			return err
		}

		payload, dispErr := certkit.Dispatch(cert, argv)
		if dispErr != nil {
			if werr := WriteResponse(conn, StatusErr, []byte(dispErr.Error())); werr != nil {
				return werr
			}
			continue
		}

		if werr := WriteResponse(conn, StatusOK, payload); werr != nil {
			return werr
		}
	}
}
