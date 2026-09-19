package security

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidToken = errors.New("invalid token")

type Claims struct {
	UserID uint   `json:"userId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type ITokenManager interface {
	Issue(uint, string, string) (string, error)
	Parse(string) (Claims, error)
}

type TokenManager struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewTokenManager(secret string, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), ttl: ttl, now: time.Now}
}

func (m *TokenManager) Issue(userID uint, email, role string) (string, error) {
	now := m.now()
	claims := Claims{
		UserID: userID, Email: email, Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: fmt.Sprint(userID), IssuedAt: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

func (m *TokenManager) Parse(raw string) (Claims, error) {
	token, err := jwt.ParseWithClaims(raw, &Claims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return Claims{}, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return Claims{}, ErrInvalidToken
	}
	return *claims, nil
}

func HashPassword(password string) (string, error) {
	value, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(value), nil
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
