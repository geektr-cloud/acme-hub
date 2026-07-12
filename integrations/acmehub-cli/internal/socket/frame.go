package socket

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

// Frame limits guard against absurd allocations from a corrupt stream.
const maxFrame = 8 << 20 // 8 MiB

// Status byte values for responses.
const (
	StatusOK  byte = 0
	StatusErr byte = 1
)

// WriteRequest writes a length-prefixed JSON-encoded argv slice.
func WriteRequest(w io.Writer, argv []string) error {
	payload, err := json.Marshal(argv)
	if err != nil {
		return err
	}
	return writeLenPrefixed(w, payload)
}

// ReadRequest reads a length-prefixed JSON argv slice.
func ReadRequest(r io.Reader) ([]string, error) {
	payload, err := readLenPrefixed(r)
	if err != nil {
		return nil, err
	}
	var argv []string
	if err := json.Unmarshal(payload, &argv); err != nil {
		return nil, fmt.Errorf("decode request argv: %w", err)
	}
	return argv, nil
}

// WriteResponse writes a status byte followed by a length-prefixed payload.
func WriteResponse(w io.Writer, status byte, payload []byte) error {
	if _, err := w.Write([]byte{status}); err != nil {
		return err
	}
	return writeLenPrefixed(w, payload)
}

// ReadResponse reads a status byte and the following length-prefixed payload.
func ReadResponse(r io.Reader) (status byte, payload []byte, err error) {
	var sb [1]byte
	if _, err = io.ReadFull(r, sb[:]); err != nil {
		return 0, nil, err
	}
	payload, err = readLenPrefixed(r)
	if err != nil {
		return 0, nil, err
	}
	return sb[0], payload, nil
}

func writeLenPrefixed(w io.Writer, payload []byte) error {
	var lenBuf [4]byte
	binary.BigEndian.PutUint32(lenBuf[:], uint32(len(payload)))
	if _, err := w.Write(lenBuf[:]); err != nil {
		return err
	}
	if len(payload) > 0 {
		if _, err := w.Write(payload); err != nil {
			return err
		}
	}
	return nil
}

func readLenPrefixed(r io.Reader) ([]byte, error) {
	var lenBuf [4]byte
	if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
		return nil, err
	}
	n := binary.BigEndian.Uint32(lenBuf[:])
	if n > maxFrame {
		return nil, fmt.Errorf("frame too large: %d bytes", n)
	}
	if n == 0 {
		return []byte{}, nil
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}
