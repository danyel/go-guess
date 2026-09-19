package service

import (
	"archive/zip"
	"bytes"
	"testing"
)

func TestExtractCVTextFromDOCX(t *testing.T) {
	var content bytes.Buffer
	archive := zip.NewWriter(&content)
	document, err := archive.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := document.Write([]byte(`<w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>Go and PostgreSQL</w:t></w:r></w:p></w:body></w:document>`)); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}

	text, err := extractCVText("candidate.docx", content.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if text != "Go and PostgreSQL " {
		t.Fatalf("unexpected extracted text %q", text)
	}
}
