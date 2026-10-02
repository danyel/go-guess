package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danyel/go-loose/client"
)

func TestGoLooseMiddlewareUsesTenantFromRequest(t *testing.T) {
	const apiKey = "gl_test_key_that_is_long_enough_for_client"
	var gotTenant, gotApplication, gotKey string
	authorization := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get(client.DefaultHeader)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read authorization body: %v", err)
		}
		var payload map[string]string
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Errorf("decode authorization body: %v", err)
		}
		gotTenant = payload["tenant"]
		gotApplication = payload["application"]
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"allowed":true,"tenant_slug":"ypto","application_slug":"guess","api_key_name":"guess"}`))
	}))
	defer authorization.Close()
	t.Setenv("GO_LOOSE_BASE_URL", authorization.URL)

	var principalTenant string
	handler := GoLooseMiddleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		principal, ok := client.PrincipalFromContext(r.Context())
		if !ok {
			t.Fatal("missing Go Loose principal")
		}
		principalTenant = principal.TenantSlug
		if r.Header.Get(client.DefaultHeader) != "" {
			t.Fatal("API key was forwarded to the application")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	request.Header.Set(client.XTenantId, "ypto")
	request.Header.Set(client.DefaultHeader, apiKey)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if gotTenant != "ypto" || gotApplication != "guess" || gotKey != apiKey || principalTenant != "ypto" {
		t.Fatalf("tenant=%q application=%q key=%q principal=%q", gotTenant, gotApplication, gotKey, principalTenant)
	}
}

func TestGoLooseMiddlewareRejectsMissingTenantAndKey(t *testing.T) {
	t.Setenv("GO_LOOSE_BASE_URL", "http://go-loose.test")
	handler := GoLooseMiddleware()(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("handler reached without authorization")
	}))

	missingTenant := httptest.NewRecorder()
	handler.ServeHTTP(missingTenant, httptest.NewRequest(http.MethodGet, "/api/jobs", nil))
	if missingTenant.Code != http.StatusBadRequest {
		t.Fatalf("missing tenant status = %d", missingTenant.Code)
	}

	missingKey := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	missingKey.Header.Set(client.XTenantId, "nmbs")
	missingKeyResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingKeyResponse, missingKey)
	if missingKeyResponse.Code != http.StatusUnauthorized {
		t.Fatalf("missing key status = %d", missingKeyResponse.Code)
	}
}

func TestGoLooseMiddlewareRejectsUnsafeTenantInHost(t *testing.T) {
	t.Setenv("GO_LOOSE_BASE_URL", "https://%s.auth.dev")
	handler := GoLooseMiddleware()(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("handler reached for unsafe tenant")
	}))
	request := httptest.NewRequest(http.MethodGet, "/api/jobs", nil)
	request.Header.Set(client.XTenantId, "nmbs.evil.example")
	request.Header.Set(client.DefaultHeader, "gl_test_key")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
}
