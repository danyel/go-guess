package openapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danyel/go-guess/backend/internal/web/handler"
	"github.com/danyel/go-guess/backend/internal/web/router"
)

func TestRuntimeContractContainsRegisteredTypedRoutes(t *testing.T) {
	api := router.New(
		handler.New(nil, nil, nil, nil, nil, nil, nil, nil, 10, "http://localhost:5173"),
		nil,
		"http://localhost:5173",
	)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/openapi.json", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}

	var document map[string]any
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		t.Fatal(err)
	}
	if document["openapi"] != "3.0.3" {
		t.Fatalf("unexpected OpenAPI version: %v", document["openapi"])
	}
	paths := document["paths"].(map[string]any)
	if len(paths) < 30 {
		t.Fatalf("contract contains only %d paths", len(paths))
	}
	jobs := paths["/api/jobs"].(map[string]any)
	createJob := jobs["post"].(map[string]any)
	if _, ok := createJob["requestBody"]; !ok {
		t.Fatal("create-job request schema is missing")
	}
	if _, ok := createJob["security"]; !ok {
		t.Fatal("create-job bearer security is missing")
	}
	contract := paths["/api/openapi.json"].(map[string]any)["get"].(map[string]any)
	if parameters := contract["parameters"].([]any); len(parameters) != 0 {
		t.Fatalf("contract endpoint unexpectedly requires parameters: %#v", parameters)
	}
}
