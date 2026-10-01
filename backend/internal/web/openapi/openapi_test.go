package openapi

import (
	"net/http"
	"testing"
)

type exampleRequest struct {
	Name string `json:"name"`
}

type exampleResponse struct {
	ID uint `json:"id"`
}

func TestBuilderCreatesTypedOperationFromRouteRegistration(t *testing.T) {
	builder := New()
	builder.Add(http.MethodPost, "/api/examples/{id}", Operation{
		Summary: "Create an example", Request: exampleRequest{}, Response: exampleResponse{},
		SuccessStatus: http.StatusCreated, Protected: true,
	})

	document := builder.Document()
	paths := document["paths"].(map[string]any)
	path := paths["/api/examples/{id}"].(map[string]any)
	operation := path["post"].(map[string]any)
	if operation["operationId"] != "postapi_examples_id" {
		t.Fatalf("unexpected operation ID: %v", operation["operationId"])
	}
	if _, ok := operation["security"]; !ok {
		t.Fatal("protected operation does not declare bearer security")
	}
	responses := operation["responses"].(map[string]any)
	if _, ok := responses["201"]; !ok {
		t.Fatalf("missing 201 response: %#v", responses)
	}
	components := document["components"].(map[string]any)
	schemas := components["schemas"].(map[string]any)
	if _, ok := schemas["exampleRequest"]; !ok {
		t.Fatalf("request schema was not generated: %#v", schemas)
	}
	if _, ok := schemas["exampleResponse"]; !ok {
		t.Fatalf("response schema was not generated: %#v", schemas)
	}
}

func TestBuilderDescribesMultipartBinaryFields(t *testing.T) {
	builder := New()
	builder.Add(http.MethodPut, "/api/participants/{id}/cv", Operation{
		Summary: "Replace a CV", Request: CVForm{}, Response: map[string]string{},
		RequestContentType: "multipart/form-data",
	})

	document := builder.Document()
	components := document["components"].(map[string]any)
	schemas := components["schemas"].(map[string]any)
	cv := schemas["CVForm"].(map[string]any)
	properties := cv["properties"].(map[string]any)
	field := properties["cv"].(map[string]any)
	if field["type"] != "string" || field["format"] != "binary" {
		t.Fatalf("unexpected CV field schema: %#v", field)
	}
}

func TestBuilderCanExposeSystemOperationsWithoutTenantHeader(t *testing.T) {
	builder := New()
	builder.Add(http.MethodGet, "/api/openapi.json", Operation{
		Summary: "Get contract", Response: map[string]any{}, NoTenant: true,
	})

	document := builder.Document()
	paths := document["paths"].(map[string]any)
	path := paths["/api/openapi.json"].(map[string]any)
	operation := path["get"].(map[string]any)
	parameters := operation["parameters"].([]map[string]any)
	if len(parameters) != 0 {
		t.Fatalf("system operation unexpectedly requires parameters: %#v", parameters)
	}
}
