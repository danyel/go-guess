package handler

import (
	"errors"
	"fmt"
	"net/http"

	goloose "github.com/danyel/go-loose/client"

	"github.com/danyel/go-guess/backend/internal/config"
	"github.com/danyel/go-guess/backend/internal/golooseauth"
	webmapper "github.com/danyel/go-guess/backend/internal/web/mapper"
	webmodel "github.com/danyel/go-guess/backend/internal/web/model"
)

var (
	errMissingSession = errors.New("missing Go Loose session")
	errTenantMismatch = errors.New("Go Loose session does not match this tenant")
	errLoginDisabled  = errors.New("Go Loose browser login is not enabled")
	errNoTenantHost   = errors.New("this host does not identify a configured tenant")
)

func (h *Handler) SetBrowserAuth(auth *golooseauth.Registry) {
	h.browser = auth
}

func (h *Handler) AppDomain() string {
	if h.browser == nil {
		return "guess.dev"
	}
	return h.browser.AppDomain()
}

func (h *Handler) BeginExternalLogin(w http.ResponseWriter, r *http.Request) {
	auth, slug, ok := h.externalAuthWithSlug(r)
	if !ok {
		writeExternalAuthError(w, h, slug)
		return
	}
	auth.LoginHandler(w, r)
}

func (h *Handler) CompleteExternalLogin(w http.ResponseWriter, r *http.Request) {
	auth, slug, ok := h.externalAuthWithSlug(r)
	if !ok {
		writeExternalAuthError(w, h, slug)
		return
	}
	auth.CallbackHandler(w, r)
}

func (h *Handler) ExternalLogout(w http.ResponseWriter, r *http.Request) {
	auth, slug, ok := h.externalAuthWithSlug(r)
	if !ok {
		writeExternalAuthError(w, h, slug)
		return
	}
	auth.LogoutHandler(w, r)
}

func (h *Handler) ExternalSession(w http.ResponseWriter, r *http.Request) {
	auth, slug, ok := h.externalAuthWithSlug(r)
	if !ok {
		writeExternalAuthError(w, h, slug)
		return
	}
	if _, err := r.Cookie(golooseauth.SessionCookie); err != nil {
		writeError(w, http.StatusUnauthorized, errMissingSession)
		return
	}
	auth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := goloose.UserFromContext(r.Context())
		if !ok || user.TenantSlug != slug {
			writeError(w, http.StatusForbidden, errTenantMismatch)
			return
		}
		token, local, err := h.auth.EstablishExternalSession(r.Context(), user.Email, user.DisplayName)
		if err != nil {
			internalError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, webmodel.LoginResponse{Token: token, User: webmapper.UserToWeb(local)})
	})).ServeHTTP(w, r)
}

func (h *Handler) externalAuth(r *http.Request) (*goloose.BrowserAuth, bool) {
	auth, _, ok := h.externalAuthWithSlug(r)
	return auth, ok
}

func (h *Handler) externalAuthWithSlug(r *http.Request) (*goloose.BrowserAuth, string, bool) {
	if h.browser == nil {
		return nil, "", false
	}
	return h.browser.ForHost(r.Host)
}

func writeExternalAuthError(w http.ResponseWriter, h *Handler, slug string) {
	if h.browser == nil {
		writeError(w, http.StatusNotFound, errLoginDisabled)
		return
	}
	if slug == "" {
		writeError(w, http.StatusNotFound, errNoTenantHost)
		return
	}
	idEnv, secretEnv := config.GoLooseCredentialEnv(slug)
	writeError(w, http.StatusServiceUnavailable,
		fmt.Errorf("Go Loose login is not configured for tenant %q: set %s and %s, then restart the API", slug, idEnv, secretEnv))
}
