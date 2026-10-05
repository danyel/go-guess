package middleware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/danyel/go-guess/backend/internal/config"
	"github.com/danyel/go-loose/client"
)

const guessApplication = "guess"

// defaultBaseURLPattern is the Go Loose identity domain used when
// GO_LOOSE_BASE_URL is unset.
func defaultBaseURLPattern() string {
	return "https://%s." + config.DefaultAuthDomain
}

// A tenant used in the Go Loose host must be one DNS label.
var safeTenantLabel = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62})?$`)

// GoLooseMiddleware authorizes a request with Go Loose. The tenant is taken
// from the X-Tenant-Id header, not from process configuration.
//
// GO_LOOSE_BASE_URL may contain one %s placeholder for that tenant. The
// default is the development identity domain, https://%s.auth-dev.urpi.be.
// A URL without %s is used as-is.
func GoLooseMiddleware() func(http.Handler) http.Handler {
	pattern := os.Getenv("GO_LOOSE_BASE_URL")
	if pattern == "" {
		pattern = defaultBaseURLPattern()
	}
	httpClient := &http.Client{Timeout: 2 * time.Second}
	var (
		mu      sync.Mutex
		clients = map[string]*client.Client{}
	)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID := strings.TrimSpace(r.Header.Get(client.XTenantId))
			if tenantID == "" {
				writeGoLooseError(w, http.StatusBadRequest, "Missing X-Tenant-Id header")
				return
			}
			baseURL, err := goLooseBaseURL(pattern, tenantID)
			if err != nil {
				writeGoLooseError(w, http.StatusBadRequest, "Invalid characters in tenant ID")
				return
			}
			access, err := goLooseClient(&mu, clients, httpClient, baseURL, tenantID)
			if err != nil {
				slog.Error("configure go-loose client", "error", err)
				writeGoLooseError(w, http.StatusInternalServerError, "authorization unavailable")
				return
			}
			access.Middleware(next).ServeHTTP(w, r)
		})
	}
}

func goLooseBaseURL(pattern, tenantID string) (string, error) {
	if !strings.Contains(pattern, "%s") {
		return pattern, nil
	}
	if !safeTenantLabel.MatchString(tenantID) {
		return "", fmt.Errorf("invalid tenant %q", tenantID)
	}
	return fmt.Sprintf(pattern, tenantID), nil
}

func goLooseClient(
	mu *sync.Mutex,
	clients map[string]*client.Client,
	httpClient *http.Client,
	baseURL, tenantID string,
) (*client.Client, error) {
	key := tenantID + "\x00" + baseURL
	mu.Lock()
	defer mu.Unlock()
	if existing, ok := clients[key]; ok {
		return existing, nil
	}
	created, err := client.New(client.Config{
		BaseURL:     baseURL,
		Tenant:      tenantID,
		Application: guessApplication,
		HTTPClient:  httpClient,
	})
	if err != nil {
		return nil, err
	}
	clients[key] = created
	return created, nil
}

func writeGoLooseError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
