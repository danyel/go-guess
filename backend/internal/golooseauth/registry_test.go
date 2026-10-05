package golooseauth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danyel/go-guess/backend/internal/config"
)

func tenants() map[string]config.GoLooseTenant {
	return map[string]config.GoLooseTenant{
		"nmbs": {ClientID: "glc_nmbs", ClientSecret: "secret"},
		"ypto": {ClientID: "glc_ypto", ClientSecret: "secret"},
	}
}

func TestNewUsesDevelopmentDomainsByDefault(t *testing.T) {
	registry, err := New(config.GoLooseConfig{AuthDomain: config.DefaultAuthDomain, AppDomain: config.DefaultAppDomain, Tenants: tenants()})
	if err != nil {
		t.Fatal(err)
	}
	if registry.AppDomain() != "guess-dev.urpi.be" {
		t.Fatalf("app domain = %q", registry.AppDomain())
	}
	location := loginRedirect(t, registry, "nmbs.guess-dev.urpi.be")
	if !strings.HasPrefix(location, "https://nmbs.auth-dev.urpi.be/connect/authorize?") {
		t.Fatalf("development login redirect = %q", location)
	}
	if !strings.Contains(location, "redirect_uri=https%3A%2F%2Fnmbs.guess-dev.urpi.be%2Fapi%2Fauth%2Fcallback") {
		t.Fatalf("development callback missing from %q", location)
	}
}

func TestNewUsesProductionDomains(t *testing.T) {
	registry, err := New(config.GoLooseConfig{
		AuthDomain: config.DefaultProdAuthDomain,
		AppDomain:  config.DefaultProdAppDomain,
		Tenants:    tenants(),
	})
	if err != nil {
		t.Fatal(err)
	}
	location := loginRedirect(t, registry, "nmbs.guess.urpi.be")
	if !strings.HasPrefix(location, "https://nmbs.auth.urpi.be/connect/authorize?") {
		t.Fatalf("production login redirect = %q", location)
	}
	if !strings.Contains(location, "redirect_uri=https%3A%2F%2Fnmbs.guess.urpi.be%2Fapi%2Fauth%2Fcallback") {
		t.Fatalf("production callback missing from %q", location)
	}
}

func TestNewRequiresAnAuthDomainWithCredentials(t *testing.T) {
	if _, err := New(config.GoLooseConfig{Tenants: tenants()}); err == nil {
		t.Fatal("expected an error when GO_LOOSE_AUTH_DOMAIN is empty")
	}
}

func TestNewNormalizesConfiguredDomains(t *testing.T) {
	registry, err := New(config.GoLooseConfig{
		AuthDomain: " .Auth-Dev.Urpi.Be. ",
		AppDomain:  ".Guess-Dev.Urpi.Be.",
		Tenants:    map[string]config.GoLooseTenant{"NMBS": {ClientID: "glc_nmbs", ClientSecret: "secret"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if registry.AppDomain() != "guess-dev.urpi.be" {
		t.Fatalf("app domain = %q", registry.AppDomain())
	}
	if location := loginRedirect(t, registry, "nmbs.guess-dev.urpi.be"); !strings.HasPrefix(location, "https://nmbs.auth-dev.urpi.be/connect/authorize?") {
		t.Fatalf("normalized login redirect = %q", location)
	}
}

func TestNewRejectsMultiLabelTenantSlug(t *testing.T) {
	_, err := New(config.GoLooseConfig{
		AuthDomain: config.DefaultAuthDomain,
		AppDomain:  config.DefaultAppDomain,
		Tenants:    map[string]config.GoLooseTenant{"nmbs.eu": {ClientID: "id", ClientSecret: "secret"}},
	})
	if err == nil {
		t.Fatal("expected an error for a tenant slug containing a dot")
	}
}

func TestAppDomainFallsBackToTheDevelopmentDomain(t *testing.T) {
	var missing *Registry
	if missing.AppDomain() != config.DefaultAppDomain {
		t.Fatalf("nil registry app domain = %q", missing.AppDomain())
	}
	empty, err := New(config.GoLooseConfig{})
	if err != nil {
		t.Fatal(err)
	}
	if empty.AppDomain() != config.DefaultAppDomain {
		t.Fatalf("empty registry app domain = %q", empty.AppDomain())
	}
}

func TestForHostResolvesTheTenantOfTheHost(t *testing.T) {
	registry, err := New(config.GoLooseConfig{
		AuthDomain: config.DefaultAuthDomain,
		AppDomain:  config.DefaultAppDomain,
		Tenants:    tenants(),
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		host string
		slug string
		ok   bool
	}{
		{host: "nmbs.guess-dev.urpi.be", slug: "nmbs", ok: true},
		{host: "ypto.guess-dev.urpi.be", slug: "ypto", ok: true},
		{host: "NMBS.Guess-Dev.Urpi.Be:8443", slug: "nmbs", ok: true},
		// The apex host identifies no tenant.
		{host: "guess-dev.urpi.be", slug: "", ok: false},
		// Another environment's domain has no configured Go Loose client here.
		{host: "nmbs.guess.urpi.be", slug: "", ok: false},
		{host: "guess.urpi.be", slug: "", ok: false},
		{host: "localhost:5173", slug: "", ok: false},
		{host: "", slug: "", ok: false},
	} {
		auth, slug, ok := registry.ForHost(tc.host)
		if slug != tc.slug || ok != tc.ok {
			t.Fatalf("ForHost(%q) = %q, %v, want %q, %v", tc.host, slug, ok, tc.slug, tc.ok)
		}
		if ok && auth == nil {
			t.Fatalf("ForHost(%q) returned no client", tc.host)
		}
	}
}

func TestHostPrefersTheForwardedHost(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/auth/session", nil)
	request.Host = "api:8080"
	if Host(request) != "api:8080" {
		t.Fatalf("host = %q", Host(request))
	}
	request.Header.Set("X-Forwarded-Host", "nmbs.guess-dev.urpi.be")
	if Host(request) != "nmbs.guess-dev.urpi.be" {
		t.Fatalf("forwarded host = %q", Host(request))
	}
}

func TestTenantFromHost(t *testing.T) {
	for _, tc := range []struct {
		host string
		want string
	}{
		{host: "nmbs.guess-dev.urpi.be", want: "nmbs"},
		{host: "ypto.guess-dev.urpi.be:443", want: "ypto"},
		{host: "nmbs.guess-dev.urpi.be.", want: "nmbs"},
		{host: "deep.nmbs.guess-dev.urpi.be", want: ""},
		{host: "guess-dev.urpi.be", want: ""},
		{host: "nmbs.evil.test", want: ""},
	} {
		if got := TenantFromHost(tc.host, config.DefaultAppDomain); got != tc.want {
			t.Fatalf("TenantFromHost(%q) = %q, want %q", tc.host, got, tc.want)
		}
	}
}

func loginRedirect(t *testing.T, registry *Registry, host string) string {
	t.Helper()
	auth, _, ok := registry.ForHost(host)
	if !ok {
		t.Fatalf("no Go Loose client for %q", host)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	request.Host = host
	response := httptest.NewRecorder()
	auth.LoginHandler(response, request)
	if response.Code != http.StatusFound {
		t.Fatalf("login for %q = %d, want 302", host, response.Code)
	}
	return response.Header().Get("Location")
}
