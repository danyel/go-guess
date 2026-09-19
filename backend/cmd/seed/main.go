package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/danyel/go-guess/backend/internal/database"
	"github.com/danyel/go-guess/backend/internal/database/seed"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}
	db, err := database.Open(databaseURL)
	if err != nil {
		slog.Error("connect database", "error", err)
		os.Exit(1)
	}
	sqlDB, err := db.DB()
	if err != nil {
		slog.Error("get database connection", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()
	if err := seed.Apply(context.Background(), sqlDB, os.Getenv("APP_ENV")); err != nil {
		slog.Error("seed database", "error", err)
		os.Exit(1)
	}
}
