package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/danyel/go-loose/client"
)

func TestFrontendURLForTenantRequest(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "http://ypto.guess.local:5173")
	request.Header.Set(client.XTenantId, "ypto")

	if value := handler.frontendURLForRequest(request); value != "http://ypto.guess.local:5173" {
		t.Fatalf("unexpected frontend URL %q", value)
	}
}

func TestFrontendURLRejectsDifferentTenantOrigin(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "http://nmbs.guess.local:5173")
	request.Header.Set(client.XTenantId, "ypto")

	if value := handler.frontendURLForRequest(request); value != handler.frontendURL {
		t.Fatalf("expected configured frontend URL, got %q", value)
	}
}

func TestFrontendURLAcceptsDevTenantOrigin(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "https://ypto.guess.dev")
	request.Header.Set(client.XTenantId, "ypto")

	if value := handler.frontendURLForRequest(request); value != "https://ypto.guess.dev" {
		t.Fatalf("expected tenant dev origin, got %q", value)
	}
}
