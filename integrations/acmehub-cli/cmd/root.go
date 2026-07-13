package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var version = "dev"

var rootCmd = &cobra.Command{
	Use:     "acmehub-cli",
	Short:   "acme-hub certificate fetch agent",
	Long:    "A consumer CLI for acme-hub: fetch certificate material over the /pki/v1 issue endpoint and hand it to user hooks. Private keys stay in memory only.",
	Version: version,
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.AddCommand(agentCmd)
	rootCmd.AddCommand(sockCmd)
	rootCmd.AddCommand(debugCmd)
}

func initConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("/etc/acmehub-cli")
	viper.AddConfigPath(".")
	viper.SetEnvPrefix("ACMEHUB")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			fmt.Fprintln(os.Stderr, "Error reading config:", err)
		}
	}
}

// Config holds the resolved runtime configuration.
type Config struct {
	Endpoint string
	Token    string
	Domains  []string
	PostExec string
	PostRun  string
}

// loadConfig reads endpoint/token/domains/post_exec/post_run from viper,
// normalizes them and validates the post_exec/post_run mutual exclusion.
func loadConfig() (*Config, error) {
	endpoint := strings.TrimRight(viper.GetString("endpoint"), "/")
	token := viper.GetString("token")
	domains := splitDomains(viper.GetString("domains"))
	postExec := viper.GetString("post_exec")
	postRun := viper.GetString("post_run")

	if postExec != "" && postRun != "" {
		return nil, fmt.Errorf("post_exec and post_run are mutually exclusive; set only one")
	}

	return &Config{
		Endpoint: endpoint,
		Token:    token,
		Domains:  domains,
		PostExec: postExec,
		PostRun:  postRun,
	}, nil
}

// splitDomains splits a comma-separated domain list, trimming whitespace and
// dropping empty entries.
func splitDomains(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func Execute() error {
	return rootCmd.Execute()
}
