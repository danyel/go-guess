package openapi

import (
	"encoding/json"
	"net/http"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/danyel/go-loose/client"
)

type Operation struct {
	Summary             string
	Request             any
	Response            any
	SuccessStatus       int
	Protected           bool
	RequestContentType  string
	ResponseContentType string
	QueryParameters     []string
	NoTenant            bool
}

type Builder struct {
	paths   map[string]any
	schemas map[string]any
}

type ParticipantForm struct {
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	Birthday    string `json:"birthday,omitempty"`
	Email       string `json:"email"`
	ContactInfo string `json:"contactInfo"`
	Photo       []byte `json:"photo,omitempty" openapi:"binary"`
	CV          []byte `json:"cv,omitempty" openapi:"binary"`
}

type CVForm struct {
	CV []byte `json:"cv" openapi:"binary"`
}

func New() *Builder {
	return &Builder{paths: make(map[string]any), schemas: make(map[string]any)}
}

func (b *Builder) Add(method, path string, operation Operation) {
	method = strings.ToLower(method)
	status := operation.SuccessStatus
	if status == 0 {
		status = http.StatusOK
	}
	contentType := operation.ResponseContentType
	if contentType == "" {
		contentType = "application/json"
	}
	success := map[string]any{"description": http.StatusText(status)}
	if operation.Response != nil {
		responseFormat := ""
		if contentType == "application/octet-stream" {
			responseFormat = "binary"
		}
		success["content"] = map[string]any{
			contentType: map[string]any{"schema": b.schema(reflect.TypeOf(operation.Response), responseFormat)},
		}
	}
	responses := map[string]any{
		strconv.Itoa(status): success,
		"default": map[string]any{
			"description": "Error response",
			"content": map[string]any{
				"application/json": map[string]any{
					"schema": b.schema(reflect.TypeOf(errorResponse{}), ""),
				},
			},
		},
	}

	value := map[string]any{
		"operationId": operationID(method, path),
		"summary":     operation.Summary,
		"tags":        []string{tagFor(path)},
		"parameters":  b.parameters(path, operation.QueryParameters, !operation.NoTenant),
		"responses":   responses,
	}
	if operation.Protected {
		value["security"] = []map[string][]string{{
			"apiKeyAuth": {},
			"bearerAuth": {},
		}}
	}
	if operation.Request != nil {
		requestContentType := operation.RequestContentType
		if requestContentType == "" {
			requestContentType = "application/json"
		}
		value["requestBody"] = map[string]any{
			"required": true,
			"content": map[string]any{
				requestContentType: map[string]any{
					"schema": b.schema(reflect.TypeOf(operation.Request), ""),
				},
			},
		}
	}
	pathItem, _ := b.paths[path].(map[string]any)
	if pathItem == nil {
		pathItem = make(map[string]any)
		b.paths[path] = pathItem
	}
	pathItem[method] = value
}

func (b *Builder) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(b.Document())
}

func (b *Builder) Document() map[string]any {
	return map[string]any{
		"openapi": "3.0.3",
		"info": map[string]any{
			"title":   "Go Guess API",
			"version": "1.0.0",
		},
		"servers": []map[string]string{{"url": "/"}},
		"paths":   b.paths,
		"components": map[string]any{
			"securitySchemes": map[string]any{
				"apiKeyAuth": map[string]any{"type": "apiKey", "in": "header", "name": client.DefaultHeader},
				"bearerAuth": map[string]any{"type": "http", "scheme": "bearer", "bearerFormat": "JWT"},
			},
			"schemas": b.schemas,
		},
	}
}

func (b *Builder) parameters(path string, queries []string, tenantRequired bool) []map[string]any {
	result := make([]map[string]any, 0)
	if tenantRequired {
		result = append(result, map[string]any{
			"name": client.XTenantId, "in": "header", "required": true,
			"schema": map[string]any{"type": "string"},
		})
	}
	for _, match := range regexp.MustCompile(`\{([^}]+)\}`).FindAllStringSubmatch(path, -1) {
		name := match[1]
		kind := "integer"
		if name == "token" {
			kind = "string"
		}
		result = append(result, map[string]any{
			"name": name, "in": "path", "required": true,
			"schema": map[string]any{"type": kind},
		})
	}
	for _, name := range queries {
		result = append(result, map[string]any{
			"name": name, "in": "query", "required": false,
			"schema": map[string]any{"type": "string"},
		})
	}
	return result
}

func (b *Builder) schema(value reflect.Type, format string) map[string]any {
	for value.Kind() == reflect.Pointer {
		value = value.Elem()
	}
	if format == "binary" {
		return map[string]any{"type": "string", "format": "binary"}
	}
	if value == reflect.TypeOf(time.Time{}) {
		return map[string]any{"type": "string", "format": "date-time"}
	}
	switch value.Kind() {
	case reflect.Struct:
		name := value.Name()
		if _, exists := b.schemas[name]; !exists {
			b.schemas[name] = map[string]any{}
			properties := make(map[string]any)
			required := make([]string, 0)
			for index := range value.NumField() {
				field := value.Field(index)
				tag := strings.Split(field.Tag.Get("json"), ",")
				if tag[0] == "-" || tag[0] == "" {
					continue
				}
				properties[tag[0]] = b.schema(field.Type, field.Tag.Get("openapi"))
				if !contains(tag[1:], "omitempty") {
					required = append(required, tag[0])
				}
			}
			sort.Strings(required)
			component := map[string]any{"type": "object", "properties": properties}
			if len(required) > 0 {
				component["required"] = required
			}
			b.schemas[name] = component
		}
		return map[string]any{"$ref": "#/components/schemas/" + name}
	case reflect.Slice, reflect.Array:
		if value.Elem().Kind() == reflect.Uint8 {
			return map[string]any{"type": "string", "format": "byte"}
		}
		return map[string]any{"type": "array", "items": b.schema(value.Elem(), "")}
	case reflect.Map:
		return map[string]any{"type": "object", "additionalProperties": b.schema(value.Elem(), "")}
	case reflect.Bool:
		return map[string]any{"type": "boolean"}
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return map[string]any{"type": "integer"}
	case reflect.Float32, reflect.Float64:
		return map[string]any{"type": "number"}
	default:
		return map[string]any{"type": "string"}
	}
}

type errorResponse struct {
	Error string `json:"error"`
}

func contains(values []string, expected string) bool {
	for _, value := range values {
		if value == expected {
			return true
		}
	}
	return false
}

func operationID(method, path string) string {
	value := strings.NewReplacer("/", "_", "{", "", "}", "", "-", "_").Replace(path)
	return method + strings.Trim(value, "_")
}

func tagFor(path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/api/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return "system"
	}
	return parts[0]
}
