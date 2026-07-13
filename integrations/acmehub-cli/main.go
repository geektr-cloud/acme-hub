package main

import (
	"os"

	"github.com/geektr-cloud/acme-hub/integrations/acmehub-cli/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
