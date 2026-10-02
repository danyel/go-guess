package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Address     string
	DatabaseURL string
	JWTSecret   string
	TokenTTL    time.Duration
	MaxUploadMB int64
	FrontendURL string
	RabbitMQURL string
	GoLoose     GoLooseConfig
}

type GoLooseConfig struct {
	AuthDomain string
	AppDomain  string
	CAFile     string
	Tenants    map[string]GoLooseTenant
}

type GoLooseTenant struct {
	ClientID     string
	ClientSecret string
}

func Load() (Config, error) {
	ttl, err := time.ParseDuration(env("TOKEN_TTL", "8h"))
	if err != nil {
		return Config{}, fmt.Errorf("parse TOKEN_TTL: %w", err)
	}
	maxUploadMB, err := strconv.ParseInt(env("MAX_UPLOAD_MB", "10"), 10, 64)
	if err != nil || maxUploadMB < 1 {
		return Config{}, fmt.Errorf("MAX_UPLOAD_MB must be a positive integer")
	}
	cfg := Config{
		Address:     env("ADDRESS", ":8080"),
		DatabaseURL: env("DATABASE_URL", "postgres://go_guess:go_guess@localhost:5432/?sslmode=disable"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		TokenTTL:    ttl,
		MaxUploadMB: maxUploadMB,
		FrontendURL: env("FRONTEND_URL", "http://localhost:5173"),
		RabbitMQURL: env("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		GoLoose:     loadGoLoose(),
	}
	if len(cfg.JWTSecret) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET must contain at least 32 characters")
	}
	return cfg, nil
}

func loadGoLoose() GoLooseConfig {
	cfg := GoLooseConfig{
		AuthDomain: env("GO_LOOSE_AUTH_DOMAIN", "auth.dev"),
		AppDomain:  env("GO_LOOSE_APP_DOMAIN", "guess.dev"),
		CAFile:     os.Getenv("GO_LOOSE_CA_FILE"),
		Tenants:    map[string]GoLooseTenant{},
	}
	add := func(slug, idEnv, secretEnv string) {
		id, secret := os.Getenv(idEnv), os.Getenv(secretEnv)
		if id == "" || secret == "" {
			return
		}
		cfg.Tenants[slug] = GoLooseTenant{ClientID: id, ClientSecret: secret}
	}
	add("nmbs", "GO_LOOSE_NMBS_CLIENT_ID", "GO_LOOSE_NMBS_CLIENT_SECRET")
	add("ypto", "GO_LOOSE_YPTO_CLIENT_ID", "GO_LOOSE_YPTO_CLIENT_SECRET")
	return cfg
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
