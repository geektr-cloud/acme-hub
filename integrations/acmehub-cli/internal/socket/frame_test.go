package socket

import (
	"bytes"
	"testing"
)

func TestRequestRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	argv := []string{"pkcs12", "--password", ""}
	if err := WriteRequest(&buf, argv); err != nil {
		t.Fatal(err)
	}
	got, err := ReadRequest(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(argv) {
		t.Fatalf("len mismatch: got %v want %v", got, argv)
	}
	for i := range argv {
		if got[i] != argv[i] {
			t.Errorf("arg %d: got %q want %q", i, got[i], argv[i])
		}
	}
}

func TestResponseRoundTripBinary(t *testing.T) {
	var buf bytes.Buffer
	// Payload with an embedded NUL byte to prove binary safety.
	payload := []byte{0x00, 0x01, 0xff, 0x00, 'a', 'b'}
	if err := WriteResponse(&buf, StatusOK, payload); err != nil {
		t.Fatal(err)
	}
	status, got, err := ReadResponse(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusOK {
		t.Errorf("status: got %d want %d", status, StatusOK)
	}
	if !bytes.Equal(got, payload) {
		t.Errorf("payload mismatch: got %v want %v", got, payload)
	}
}

func TestResponseError(t *testing.T) {
	var buf bytes.Buffer
	if err := WriteResponse(&buf, StatusErr, []byte("boom")); err != nil {
		t.Fatal(err)
	}
	status, got, err := ReadResponse(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusErr {
		t.Errorf("status: got %d want %d", status, StatusErr)
	}
	if string(got) != "boom" {
		t.Errorf("payload: got %q", got)
	}
}

func TestEmptyPayload(t *testing.T) {
	var buf bytes.Buffer
	if err := WriteResponse(&buf, StatusOK, []byte{}); err != nil {
		t.Fatal(err)
	}
	status, got, err := ReadResponse(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusOK || len(got) != 0 {
		t.Errorf("got status=%d len=%d", status, len(got))
	}
}
