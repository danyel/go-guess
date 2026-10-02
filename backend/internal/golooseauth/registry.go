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
		appDomain: strings.TrimPrefix(strings.ToLower(cfg.AppDomain), "."),
		bySlug:    map[string]*goloose.BrowserAuth{},
	}
	if registry.appDomain == "" {
		registry.appDomain = "guess.dev"
	}
	if len(cfg.Tenants) == 0 {
		return registry, nil
	}
	authDomain := strings.TrimPrefix(strings.ToLower(cfg.AuthDomain), ".")
	if authDomain == "" {
		return nil, fmt.Errorf("GO_LOOSE_AUTH_DOMAIN is required when client credentials are configured")
	}
	httpClient, err := client(cfg.CAFile)
	if err != nil {
		return nil, err
	}
	for slug, tenant := range cfg.Tenants {
		slug = strings.ToLower(strings.TrimSpace(slug))
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
		return "guess.dev"
	}
	return r.appDomain
}

func (r *Registry) ForHost(host string) (*goloose.BrowserAuth, string, bool) {
	if r == nil {
		return nil, "", false
	}
	slug := TenantFromHost(host, r.appDomain)
	auth, ok := r.bySlug[slug]
	return auth, slug, ok
}

func TenantFromHost(host, appDomain string) string {
	hostname := strings.ToLower(host)
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		hostname = strings.ToLower(parsed)
	}
	appDomain = strings.TrimPrefix(strings.ToLower(appDomain), ".")
	if appDomain == "" {
		appDomain = "guess.dev"
	}
	suffix := "." + appDomain
	if !strings.HasSuffix(hostname, suffix) {
		return ""
	}
	slug := strings.TrimSuffix(hostname, suffix)
	if slug == "" || strings.Contains(slug, ".") {
		return ""
	}
	return slug
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
