package handler

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/danyel/go-guess/backend/internal/config"
	"github.com/danyel/go-guess/backend/internal/golooseauth"
	servicemodel "github.com/danyel/go-guess/backend/internal/service/model"
	webmapper "github.com/danyel/go-guess/backend/internal/web/mapper"
	goloose "github.com/danyel/go-loose/client"
)

func TestFrontendURLForTenantRequest(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "http://ypto.guess.local:5173")
	request.Header.Set(goloose.XTenantId, "ypto")

	if value := handler.frontendURLForRequest(request); value != "http://ypto.guess.local:5173" {
		t.Fatalf("unexpected frontend URL %q", value)
	}
}

func TestFrontendURLRejectsDifferentTenantOrigin(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "http://nmbs.guess.local:5173")
	request.Header.Set(goloose.XTenantId, "ypto")

	if value := handler.frontendURLForRequest(request); value != handler.frontendURL {
		t.Fatalf("expected configured frontend URL, got %q", value)
	}
}

func TestFrontendURLAcceptsDevTenantOrigin(t *testing.T) {
	handler := &Handler{frontendURL: "http://localhost:5173"}
	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "https://ypto."+config.DefaultAppDomain)
	request.Header.Set(goloose.XTenantId, "ypto")

	if value := handler.frontendURLForRequest(request); value != "https://ypto."+config.DefaultAppDomain {
		t.Fatalf("expected tenant dev origin, got %q", value)
	}
}

func TestFrontendURLAcceptsConfiguredProductionDomain(t *testing.T) {
	browser, err := golooseauth.New(config.GoLooseConfig{
		AuthDomain: config.DefaultProdAuthDomain,
		AppDomain:  config.DefaultProdAppDomain,
		Tenants: map[string]config.GoLooseTenant{
			"nmbs": {ClientID: "glc_nmbs", ClientSecret: "secret"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	handler := &Handler{frontendURL: "https://nmbs.guess.urpi.be"}
	handler.SetBrowserAuth(browser)

	request := httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "https://nmbs."+config.DefaultProdAppDomain)
	request.Header.Set(goloose.XTenantId, "nmbs")
	if value := handler.frontendURLForRequest(request); value != "https://nmbs."+config.DefaultProdAppDomain {
		t.Fatalf("expected tenant production origin, got %q", value)
	}

	// The development domain is not the configured app domain in production.
	request = httptest.NewRequest("GET", "/api/jobs/2/invitations", nil)
	request.Header.Set("Origin", "https://nmbs."+config.DefaultAppDomain)
	request.Header.Set(goloose.XTenantId, "nmbs")
	if value := handler.frontendURLForRequest(request); value != handler.frontendURL {
		t.Fatalf("expected configured frontend URL, got %q", value)
	}
}

// TestExternalIdentityCarriesThePicture pins that the picture Go Loose serves is
// handed to the service and ends up in the session payload. The URL is resolved on
// every sign-in rather than stored, so it must survive the whole way through
// rather than being dropped at the first boundary.
func TestExternalIdentityCarriesThePicture(t *testing.T) {
	identity := externalIdentity(goloose.User{
		Email:       "ada@example.test",
		DisplayName: "Ada Lovelace",
		AvatarURL:   "https://auth.example.test/api/v1/avatars/kZ3abc",
		Role:        "developer",
	})
	if identity.Email != "ada@example.test" {
		t.Errorf("email = %q", identity.Email)
	}
	if identity.DisplayName != "Ada Lovelace" {
		t.Errorf("display name = %q", identity.DisplayName)
	}
	if identity.AvatarURL != "https://auth.example.test/api/v1/avatars/kZ3abc" {
		t.Errorf("avatar URL = %q", identity.AvatarURL)
	}

	// A person without a picture yields an empty URL rather than a broken one, so
	// the frontend can fall back to initials.
	without := externalIdentity(goloose.User{Email: "bob@example.test"})
	if without.AvatarURL != "" {
		t.Errorf("avatar URL = %q, want empty", without.AvatarURL)
	}
}

// TestUserToWebIncludesTheAvatar pins the JSON field name the frontend reads.
func TestUserToWebIncludesTheAvatar(t *testing.T) {
	encoded, err := json.Marshal(webmapper.UserToWeb(servicemodel.User{
		ID: 7, Email: "ada@example.test", DisplayName: "Ada", Role: "interviewer",
		AvatarURL: "https://auth.example.test/api/v1/avatars/kZ3abc",
	}))
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["avatarUrl"] != "https://auth.example.test/api/v1/avatars/kZ3abc" {
		t.Errorf("avatarUrl = %v, payload %s", payload["avatarUrl"], encoded)
	}
}
