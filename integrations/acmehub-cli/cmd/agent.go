package cmd

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/geektr-cloud/acmehub-cli/internal/backoff"
	"github.com/geektr-cloud/acmehub-cli/internal/certkit"
	"github.com/geektr-cloud/acmehub-cli/internal/client"
	"github.com/geektr-cloud/acmehub-cli/internal/hook"
)

var (
	agentDaemon  bool
	agentDomains []string
)

var agentCmd = &cobra.Command{
	Use:   "agent",
	Short: "Fetch a certificate and run a post hook (optionally as a renewing daemon)",
	Long: "Fetch certificate material from acme-hub and hand it to a post hook.\n\n" +
		"Single-shot (default): fetch once, run post_exec or post_run, exit.\n" +
		"Daemon (-d): fetch, run the hook, then sleep until the local renewal time\n" +
		"(notBefore + 0.9*lifetime) and repeat. Fetch failures retry with 36s->3h\n" +
		"exponential backoff. SIGTERM/SIGINT trigger a graceful exit.",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := loadConfig()
		if err != nil {
			return err
		}

		domains := cfg.Domains
		if len(agentDomains) > 0 {
			domains = agentDomains
		}
		if len(domains) == 0 {
			return fmt.Errorf("no domains configured (set ACMEHUB_DOMAINS or --domains)")
		}

		if cfg.PostExec == "" && cfg.PostRun == "" {
			return fmt.Errorf("no post hook configured (set post_exec or post_run)")
		}

		if agentDaemon {
			return runDaemon(cfg, domains)
		}
		return runOnce(cfg, domains)
	},
}

func init() {
	agentCmd.Flags().BoolVarP(&agentDaemon, "daemon", "d", false, "run continuously, refetching before expiry")
	agentCmd.Flags().StringSliceVar(&agentDomains, "domains", nil, "override configured domains (comma-separated)")
	_ = viper.BindPFlag("agent_daemon", agentCmd.Flags().Lookup("daemon"))
}

// fetchAndRun fetches a cert and runs the configured hook.
func fetchAndRun(ctx context.Context, cfg *Config, domains []string) (*certkit.Cert, error) {
	cert, err := client.Fetch(ctx, client.Config{
		Endpoint: cfg.Endpoint,
		Token:    cfg.Token,
	}, domains)
	if err != nil {
		return nil, err
	}

	log.Printf("fetched certificate: commonName=%s notAfter=%s", cert.CommonName, cert.NotAfter.Format(time.RFC3339))

	if err := runHook(cfg, cert); err != nil {
		return cert, err
	}
	return cert, nil
}

func runHook(cfg *Config, cert *certkit.Cert) error {
	if cfg.PostExec != "" {
		return hook.RunExec(cfg.PostExec, cert)
	}
	return hook.RunShell(cfg.PostRun, cert)
}

// runOnce performs a single fetch + hook run.
func runOnce(cfg *Config, domains []string) error {
	_, err := fetchAndRun(context.Background(), cfg, domains)
	return err
}

// runDaemon loops fetch + hook, sleeping until the local renewal time and
// retrying failures with exponential backoff. It exits gracefully on signal.
func runDaemon(cfg *Config, domains []string) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	log.Printf("daemon started: endpoint=%s domains=%v", cfg.Endpoint, domains)

	var lastFingerprint string
	attempt := 0

	for {
		cert, err := fetchAndRun(ctx, cfg, domains)
		if err != nil {
			if ctx.Err() != nil {
				log.Printf("daemon shutting down: %v", ctx.Err())
				return nil
			}
			delay := backoff.Delay(attempt)
			log.Printf("cycle failed (attempt %d), retrying in %s: %v", attempt+1, delay, err)
			if !sleepCtx(ctx, delay) {
				log.Printf("daemon shutting down")
				return nil
			}
			attempt++
			continue
		}
		attempt = 0

		fp := fingerprint(cert)
		if fp == lastFingerprint {
			log.Printf("warning: fetched certificate is unchanged since last cycle (commonName=%s)", cert.CommonName)
		}
		lastFingerprint = fp

		next := cert.RenewAt()
		wait := time.Until(next)
		if wait < 0 {
			wait = 0
		}
		log.Printf("next fetch at %s (in %s)", next.Format(time.RFC3339), wait.Round(time.Second))

		if !sleepCtx(ctx, wait) {
			log.Printf("daemon shutting down")
			return nil
		}
	}
}

// sleepCtx waits for d or until ctx is cancelled. It returns true if the full
// duration elapsed, false if cancelled.
func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}

// fingerprint returns the sha256 hex of the leaf certificate PEM.
func fingerprint(cert *certkit.Cert) string {
	sum := sha256.Sum256([]byte(cert.Certificate))
	return hex.EncodeToString(sum[:])
}
