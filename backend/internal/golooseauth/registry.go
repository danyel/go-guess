package golooseauth

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	goloose "github.com/danyel/go-loose/client"

	"github.com/danyel/go-guess/backend/internal/config"
)

const SessionCookie = "go_loose_user_session"

type Registry struct {
	appDomain string
	bySlug    map[string]*goloose.BrowserAuth
}

func New(cfg config.GoLooseConfig) (*Registry, error) {
	registry := &Registry{
		appDomain: domain(cfg.AppDomain),
		bySlug:    map[string]*goloose.BrowserAuth{},
	}
	if len(cfg.Tenants) == 0 {
		return registry, nil
	}
	authDomain := domain(cfg.AuthDomain)
	if authDomain == "" {
		return nil, fmt.Errorf("GO_LOOSE_AUTH_DOMAIN is required when client credentials are configured")
	}
	httpClient, err := client(cfg.CAFile)
	if err != nil {
		return nil, err
	}
	for slug, tenant := range cfg.Tenants {
		slug = domain(slug)
		if slug == "" || strings.Contains(slug, ".") {
			return nil, fmt.Errorf("invalid Go Loose tenant slug %q", slug)
		}
		auth, err := goloose.NewBrowserAuth(goloose.BrowserAuthConfig{
			BaseURL:        "https://" + slug + "." + authDomain,
			ClientID:       tenant.ClientID,
			ClientSecret:   tenant.ClientSecret,
			RedirectURL:    "https://" + slug + "." + registry.appDomain + "/api/auth/callback",
			AfterLoginURL:  "/",
			AfterLogoutURL: "/",
			LoginPath:      "/api/auth/login",
			CookieName:     SessionCookie,
			CookieSecure:   true,
			HTTPClient:     httpClient,
		})
		if err != nil {
			return nil, fmt.Errorf("configure %s Go Loose login: %w", slug, err)
		}
		registry.bySlug[slug] = auth
	}
	return registry, nil
}

func (r *Registry) AppDomain() string {
	if r == nil || r.appDomain == "" {
		return config.DefaultAppDomain
	}
	return r.appDomain
}

// ForHost resolves the Go Loose client of the tenant that owns host. Ingress
// proxies may replace the request Host, so X-Forwarded-Host wins when present.
func (r *Registry) ForHost(host string) (*goloose.BrowserAuth, string, bool) {
	if r == nil {
		return nil, "", false
	}
	slug := TenantFromHost(host, r.appDomain)
	auth, ok := r.bySlug[slug]
	return auth, slug, ok
}

// Host returns the host that identifies the tenant of a request, preferring the
// proxy-supplied X-Forwarded-Host over the request Host.
func Host(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-Host")); forwarded != "" {
		return forwarded
	}
	return r.Host
}

func TenantFromHost(host, appDomain string) string {
	hostname := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		hostname = strings.ToLower(strings.TrimSuffix(parsed, "."))
	}
	suffix := "." + domain(appDomain)
	if !strings.HasSuffix(hostname, suffix) {
		return ""
	}
	slug := strings.TrimSuffix(hostname, suffix)
	if slug == "" || strings.Contains(slug, ".") {
		return ""
	}
	return slug
}

// domain normalizes a configured host suffix or tenant slug.
func domain(value string) string {
	return strings.Trim(strings.ToLower(strings.TrimSpace(value)), ".")
}

func client(caFile string) (*http.Client, error) {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if caFile != "" {
		pem, err := os.ReadFile(caFile)
		if err != nil {
			return nil, fmt.Errorf("read Go Loose CA: %w", err)
		}
		pool, err := x509.SystemCertPool()
		if err != nil || pool == nil {
			pool = x509.NewCertPool()
		}
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("parse Go Loose CA %s", caFile)
		}
		transport.TLSClientConfig = &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
	}
	return &http.Client{Timeout: 5 * time.Second, Transport: transport}, nil
}
