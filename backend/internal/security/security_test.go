package security

import (
	"testing"
	"time"
)

func TestTokenRoundTrip(t *testing.T) {
	manager := NewTokenManager("01234567890123456789012345678901", time.Hour)
	raw, err := manager.Issue(42, "interviewer@example.com", "interviewer")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := manager.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if claims.UserID != 42 || claims.Email != "interviewer@example.com" || claims.Role != "interviewer" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
}

func TestRejectsTokenSignedWithAnotherSecret(t *testing.T) {
	issuer := NewTokenManager("01234567890123456789012345678901", time.Hour)
	verifier := NewTokenManager("abcdefghijklmnopqrstuvwxyz123456", time.Hour)
	raw, err := issuer.Issue(1, "user@example.com", "interviewer")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := verifier.Parse(raw); err == nil {
		t.Fatal("expected token validation to fail")
	}
}
