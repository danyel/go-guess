package middleware

import (
	"context"
	"fmt"
	"net/http"
	"regexp"

	"github.com/danyel/go-guess/backend/internal/golooseauth"
	"github.com/danyel/go-loose/client"
	"gorm.io/gorm"
)

type contextKey string

const TxKey contextKey = "tenant_db_tx"

// Alphanumeric or underscores only to prevent SQL Injection in schema names
var safeSchemaRegex = regexp.MustCompile(`^[a-zA-Z0-9_:-]+$`)

// TenantSchemaMiddleware isolates database connections per request using PostgreSQL schemas
func TenantSchemaMiddleware(db *gorm.DB, appDomain string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/health" || r.URL.Path == "/api/openapi.json" {
				next.ServeHTTP(w, r)
				return
			}
			tenantID := r.Header.Get(client.XTenantId)
			if tenantID == "" {
				tenantID = golooseauth.TenantFromHost(golooseauth.Host(r), appDomain)
			}
			if tenantID == "" || db == nil {
				next.ServeHTTP(w, r)
				return
			}

			// Validate schema name to guarantee safety against SQL injection
			if !safeSchemaRegex.MatchString(tenantID) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error": "Invalid characters in tenant ID"}`))
				return
			}

			// Start a fresh transaction scoped exclusively to this HTTP request
			tx := db.Begin()

			// Set the local search_path for the duration of this transaction block
			if err := tx.Exec(fmt.Sprintf("SET LOCAL search_path TO %s", tenantID)).Error; err != nil {
				tx.Rollback()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error": "Failed to resolve tenant storage isolation"}`))
				return
			}

			// Embed the transaction database instance into the request context
			ctx := context.WithValue(r.Context(), TxKey, tx)

			// Execute the subsequent request handlers
			next.ServeHTTP(w, r.WithContext(ctx))

			// Commit or Rollback based on the transaction error status
			if tx.Error != nil {
				tx.Rollback()
			} else {
				tx.Commit()
			}
		})
	}
}

// GetDB retrieves the transaction-bound tenant GORM DB instance from context
func GetDB(ctx context.Context) *gorm.DB {
	if tx, ok := ctx.Value(TxKey).(*gorm.DB); ok {
		return tx.WithContext(ctx)
	}
	panic("GetDB was invoked outside of TenantSchemaMiddleware")
}
