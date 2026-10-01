package handler

import (
	"net/http/httptest"
	"testing"
)

func TestFrontendURLForTenantRequest(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "http://ypto.guess.local:5173")
	request.Header.Set("X-Tenant-Id", "ypto")

	if value := handler.frontendURLForRequest(request); value != "http://ypto.guess.local:5173" {
		t.Fatalf("unexpected frontend URL %q", value)
	}
}

func TestFrontendURLRejectsDifferentTenantOrigin(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "http://nmbs.guess.local:5173")
	request.Header.Set("X-Tenant-Id", "ypto")

	if value := handler.frontendURLForRequest(request); value != handler.frontendURL {
		t.Fatalf("expected configured frontend URL, got %q", value)
	}
}
