package socket

import (
	"net"
	"testing"
	"time"

	"github.com/geektr-cloud/acmehub-cli/internal/certkit"
)

func TestServeSequentialRequests(t *testing.T) {
	server, client := net.Pipe()
	defer client.Close()

	cert := &certkit.Cert{
		Certificate: "CERT-PEM",
		PrivateKey:  "PRIVATE-KEY-PEM",
		NotBefore:   time.Now().Add(-time.Hour),
		NotAfter:    time.Now().Add(time.Hour),
	}

	done := make(chan error, 1)
	go func() {
		done <- Serve(server, cert)
	}()

	// Simulate `acme public; acme private` on the same connection.
	call := func(argv []string) (byte, string) {
		if err := WriteRequest(client, argv); err != nil {
			t.Fatalf("write %v: %v", argv, err)
		}
		status, payload, err := ReadResponse(client)
		if err != nil {
			t.Fatalf("read %v: %v", argv, err)
		}
		return status, string(payload)
	}

	if status, out := call([]string{"public"}); status != StatusOK || out != "CERT-PEM" {
		t.Errorf("public: status=%d out=%q", status, out)
	}
	if status, out := call([]string{"private"}); status != StatusOK || out != "PRIVATE-KEY-PEM" {
		t.Errorf("private: status=%d out=%q", status, out)
	}

	// Unknown verb -> error response, connection stays open.
	if status, _ := call([]string{"bogus"}); status != StatusErr {
		t.Errorf("bogus: expected error status, got %d", status)
	}

	// Closing the client ends the serve loop cleanly.
	client.Close()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("Serve returned error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Serve did not return after client close")
	}
}
