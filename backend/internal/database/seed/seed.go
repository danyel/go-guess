package seed

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
)

//go:embed *.sql
var files embed.FS

func Apply(ctx context.Context, db *sql.DB, environment string) error {
	if _, err := apply(ctx, db, "common.sql"); err != nil {
		return err
	}
	switch environment {
	case "", "production":
		return nil
	case "development", "test":
		_, err := apply(ctx, db, environment+".sql")
		return err
	default:
		return fmt.Errorf("unsupported APP_ENV %q", environment)
	}
}

func apply(ctx context.Context, db *sql.DB, filename string) (sql.Result, error) {
	content, err := files.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("read seed %s: %w", filename, err)
	}
	result, err := db.ExecContext(ctx, string(content))
	if err != nil {
		return nil, fmt.Errorf("apply seed %s: %w", filename, err)
	}
	return result, nil
}
