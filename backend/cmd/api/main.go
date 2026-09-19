package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/danyel/go-guess/backend/internal/config"
	"github.com/danyel/go-guess/backend/internal/database"
	"github.com/danyel/go-guess/backend/internal/database/repository"
	"github.com/danyel/go-guess/backend/internal/eventbus"
	"github.com/danyel/go-guess/backend/internal/security"
	"github.com/danyel/go-guess/backend/internal/service"
	"github.com/danyel/go-guess/backend/internal/web/handler"
	"github.com/danyel/go-guess/backend/internal/web/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load configuration", "error", err)
		os.Exit(1)
	}
	db, err := database.Open(cfg.DatabaseURL)
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

	store := repository.New(db)
	bus, err := eventbus.NewAMQPBus(cfg.RabbitMQURL)
	if err != nil {
		slog.Error("connect event bus", "error", err)
		os.Exit(1)
	}
	defer bus.Close()
	tokens := security.NewTokenManager(cfg.JWTSecret, cfg.TokenTTL)
	invitations := service.NewInvitationService(store, cfg.FrontendURL)
	interviews := service.NewScheduledInterviewService(store, bus)
	api := router.New(
		handler.New(
			service.NewAuthService(store, tokens),
			service.NewJobService(store),
			service.NewQuestionService(store),
			service.NewParticipantService(store),
			invitations,
			service.NewUserService(store),
			interviews,
			cfg.MaxUploadMB,
			cfg.FrontendURL,
		),
		tokens,
		cfg.FrontendURL,
	)
	server := &http.Server{
		Addr: cfg.Address, Handler: api, ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}

	go func() {
		slog.Info("API listening", "address", cfg.Address)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("serve API", "error", err)
			os.Exit(1)
		}
	}()

	stop, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	<-stop.Done()
	ctx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	if err := server.Shutdown(ctx); err != nil {
		slog.Error("shutdown API", "error", err)
	}
}
