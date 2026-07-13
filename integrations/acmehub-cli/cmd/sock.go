package cmd

import (
	"context"
	"fmt"
	"net"
	"os"
	"strconv"

	"github.com/spf13/cobra"

	"github.com/geektr-cloud/acme-hub/integrations/acmehub-cli/internal/certkit"
	"github.com/geektr-cloud/acme-hub/integrations/acmehub-cli/internal/client"
	"github.com/geektr-cloud/acme-hub/integrations/acmehub-cli/internal/socket"
)

var sockCmd = &cobra.Command{
	Use:   "sock [verb] [flags...]",
	Short: "Retrieve certificate material (proxy over inherited fd, or standalone fetch)",
	Long: "Retrieve a piece of certificate material.\n\n" +
		"When ACMEHUB_SOCK_FD is set (inside an agent post_run/post_exec hook), sock\n" +
		"acts as a thin proxy over the inherited socket and serves the cert snapshot\n" +
		"held by the agent. Otherwise it runs standalone: it fetches a fresh\n" +
		"certificate from acme-hub and dispatches locally.\n\n" +
		"Verbs: public, private, fullchain, chain, renew-at, until-expire, pkcs12, meta.\n\n" +
		"Note: over-socket calls must be sequential; concurrent calls on the shared\n" +
		"stream are not supported.",
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		if fdStr := os.Getenv("ACMEHUB_SOCK_FD"); fdStr != "" {
			return runSockProxy(fdStr, args)
		}
		return runSockStandalone(args)
	},
}

// runSockProxy forwards argv over the inherited socket fd and relays the
// response. It never imports certkit logic; it is a pure byte pipe.
func runSockProxy(fdStr string, args []string) error {
	fd, err := strconv.Atoi(fdStr)
	if err != nil {
		return fmt.Errorf("invalid ACMEHUB_SOCK_FD %q: %w", fdStr, err)
	}

	f := os.NewFile(uintptr(fd), "acmehub-sock")
	if f == nil {
		return fmt.Errorf("failed to open ACMEHUB_SOCK_FD %d", fd)
	}
	defer f.Close()

	conn, err := net.FileConn(f)
	if err != nil {
		return fmt.Errorf("wrap socket fd: %w", err)
	}
	defer conn.Close()

	if err := socket.WriteRequest(conn, args); err != nil {
		return fmt.Errorf("write request: %w", err)
	}

	status, payload, err := socket.ReadResponse(conn)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if status == socket.StatusErr {
		fmt.Fprintln(os.Stderr, string(payload))
		os.Exit(1)
	}

	if _, err := os.Stdout.Write(payload); err != nil {
		return err
	}
	return nil
}

// runSockStandalone fetches a fresh cert and dispatches locally.
func runSockStandalone(args []string) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	if len(cfg.Domains) == 0 {
		return fmt.Errorf("no domains configured (set ACMEHUB_DOMAINS)")
	}

	cert, err := client.Fetch(context.Background(), client.Config{
		Endpoint: cfg.Endpoint,
		Token:    cfg.Token,
	}, cfg.Domains)
	if err != nil {
		return err
	}

	payload, err := certkit.Dispatch(cert, args)
	if err != nil {
		return err
	}

	if _, err := os.Stdout.Write(payload); err != nil {
		return err
	}
	return nil
}
