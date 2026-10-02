package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTenantMiddlewareAllowsSystemEndpointsWithoutTenant(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := TenantSchemaMiddleware(nil, "guess.dev")(next)

	for _, path := range []string{"/api/health", "/api/openapi.json"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("%s returned %d", path, response.Code)
		}
	}
}

func TestTenantMiddlewareUsesPublicSchemaWithoutTenant(t *testing.T) {
	handler := TenantSchemaMiddleware(nil, "guess.dev")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/jobs", nil))

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Code)
	}
}
