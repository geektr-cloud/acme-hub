package acmehub

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/caddyserver/caddy/v2"
	"gopkg.in/yaml.v3"
)

type ProfileConfig struct {
	Endpoint string `yaml:"endpoint"`
	Token    string `yaml:"token"`
}

type profileNotFound struct {
	profile string
}

func (e *profileNotFound) Error() string {
	return "acmehub: no config found for profile " + e.profile
}

func resolveProfile(profile string) (ProfileConfig, error) {
	if profile == "" || profile == "default" {
		return resolveDefaultProfile()
	}
	return resolveNamedProfile(profile)
}

func resolveDefaultProfile() (ProfileConfig, error) {
	// 1. env no label: CADDY_ACMEHUB_ENDPOINT / CADDY_ACMEHUB_TOKEN
	if cfg := fromEnv(""); cfg.ok() {
		return cfg, nil
	}
	// 2. env with DEFAULT label: CADDY_ACMEHUB_DEFAULT_ENDPOINT / _TOKEN
	if cfg := fromEnv("DEFAULT"); cfg.ok() {
		return cfg, nil
	}
	// 3. yaml top-level bare endpoint/token
	if cfg, err := fromYaml(""); err == nil && cfg.ok() {
		return cfg, nil
	}
	// 4. yaml "default" section
	if cfg, err := fromYaml("default"); err == nil && cfg.ok() {
		return cfg, nil
	}
	return ProfileConfig{}, fmt.Errorf("acmehub: no config found for default profile")
}

func resolveNamedProfile(profile string) (ProfileConfig, error) {
	upper := strings.ToUpper(profile)
	// 1. env CADDY_ACMEHUB_<UPPER>_ENDPOINT / _TOKEN
	if cfg := fromEnv(upper); cfg.ok() {
		return cfg, nil
	}
	// 2. yaml <profile>.endpoint / <profile>.token
	if cfg, err := fromYaml(profile); err == nil && cfg.ok() {
		return cfg, nil
	}
	return ProfileConfig{}, fmt.Errorf("acmehub: no config found for profile %q", profile)
}

func fromEnv(label string) ProfileConfig {
	prefix := "CADDY_ACMEHUB_"
	if label != "" {
		prefix = "CADDY_ACMEHUB_" + label + "_"
	}
	return ProfileConfig{
		Endpoint: os.Getenv(prefix + "ENDPOINT"),
		Token:    os.Getenv(prefix + "TOKEN"),
	}
}

func (c ProfileConfig) ok() bool {
	return c.Endpoint != "" && c.Token != ""
}

func fromYaml(profile string) (ProfileConfig, error) {
	path := filepath.Join(caddy.AppDataDir(), "acmehub.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		return ProfileConfig{}, err
	}

	// Try parsing as map[string]ProfileConfig first (nested profiles)
	var profiles map[string]ProfileConfig
	if err := yaml.Unmarshal(data, &profiles); err == nil && len(profiles) > 0 {
		if profile == "" {
			// Look for top-level bare fields by trying "default" key
			if cfg, ok := profiles["default"]; ok {
				return cfg, nil
			}
			return ProfileConfig{}, &profileNotFound{profile: "(top-level)"}
		}
		if cfg, ok := profiles[profile]; ok {
			return cfg, nil
		}
		return ProfileConfig{}, &profileNotFound{profile: profile}
	}

	// Try parsing as single ProfileConfig (top-level bare fields)
	var single ProfileConfig
	if err := yaml.Unmarshal(data, &single); err == nil && single.ok() {
		if profile == "" || profile == "default" {
			return single, nil
		}
		return ProfileConfig{}, &profileNotFound{profile: profile}
	}

	return ProfileConfig{}, fmt.Errorf("acmehub: failed to parse acmehub.yaml")
}
