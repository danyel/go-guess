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
	handler := TenantSchemaMiddleware(nil)(next)

	for _, path := range []string{"/api/health", "/api/openapi.json"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Fatalf("%s returned %d", path, response.Code)
		}
	}
}

func TestTenantMiddlewareStillRequiresTenantForDataEndpoints(t *testing.T) {
	handler := TenantSchemaMiddleware(nil)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("data endpoint reached without a tenant")
	}))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/jobs", nil))

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", response.Code)
	}
}
