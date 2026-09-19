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
		DatabaseURL: env("DATABASE_URL", "postgres://go_guess:go_guess@localhost:5432/go_guess?sslmode=disable"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		TokenTTL:    ttl,
		MaxUploadMB: maxUploadMB,
		FrontendURL: env("FRONTEND_URL", "http://localhost:5173"),
	}
	if len(cfg.JWTSecret) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET must contain at least 32 characters")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
