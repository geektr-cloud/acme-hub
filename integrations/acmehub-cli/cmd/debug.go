package cmd

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/geektr-cloud/acmehub-cli/internal/client"
)

var (
	debugPort     int
	debugHTTPPort string
)

var debugCmd = &cobra.Command{
	Use:   "debug",
	Short: "Fetch a real certificate from acme-hub and serve it over HTTPS returning \"Hello HTTPS\"",
	Long: "Fetch certificate material from acme-hub and start an HTTPS server using the\n" +
		"real fullchain + private key. Every request returns \"Hello HTTPS\". Useful for\n" +
		"verifying the certificate chain, TLS handshakes, and upstream SNI proxy chains\n" +
		"against a live certificate.",
	RunE: func(cmd *cobra.Command, args []string) error {
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

		tlsCert, err := tls.X509KeyPair([]byte(cert.Fullchain), []byte(cert.PrivateKey))
		if err != nil {
			return fmt.Errorf("build TLS certificate: %w", err)
		}

		log.Printf("fetched certificate: commonName=%s notAfter=%s", cert.CommonName, cert.NotAfter.Format("2006-01-02T15:04:05Z07:00"))

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte("Hello HTTPS"))
		})

		if debugHTTPPort != "" {
			go func() {
				addr := ":" + debugHTTPPort
				log.Printf("starting HTTP server on %s", addr)
				if err := http.ListenAndServe(addr, handler); err != nil {
					log.Printf("HTTP server error: %v", err)
				}
			}()
		}

		srv := &http.Server{
			Addr:      fmt.Sprintf(":%d", debugPort),
			Handler:   handler,
			TLSConfig: &tls.Config{Certificates: []tls.Certificate{tlsCert}},
		}
		log.Printf("starting HTTPS server on :%d", debugPort)
		// Certificates are supplied via TLSConfig, so cert/key file args are empty.
		return srv.ListenAndServeTLS("", "")
	},
}

func init() {
	debugCmd.Flags().IntVarP(&debugPort, "port", "p", 443, "HTTPS listen port")
	debugCmd.Flags().StringVar(&debugHTTPPort, "http-port", "", "optional plain HTTP listen port")
}
