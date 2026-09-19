package service

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/ledongthuc/pdf"
)

func extractCVText(filename string, content []byte) (text string, err error) {
	if len(content) == 0 {
		return "", nil
	}
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".pdf":
		defer func() {
			if recovered := recover(); recovered != nil {
				text = ""
				err = fmt.Errorf("unreadable PDF")
			}
		}()
		reader, err := pdf.NewReader(bytes.NewReader(content), int64(len(content)))
		if err != nil {
			return "", fmt.Errorf("read PDF: %w", err)
		}
		plainText, err := reader.GetPlainText()
		if err != nil {
			return "", fmt.Errorf("extract PDF text: %w", err)
		}
		value, err := io.ReadAll(plainText)
		if err != nil {
			return "", fmt.Errorf("read PDF text: %w", err)
		}
		return string(value), nil
	case ".docx":
		return extractDOCX(content)
	default:
		return string(content), nil
	}
}

func extractDOCX(content []byte) (string, error) {
	archive, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return "", fmt.Errorf("open DOCX: %w", err)
	}
	for _, file := range archive.File {
		if file.Name != "word/document.xml" {
			continue
		}
		stream, err := file.Open()
		if err != nil {
			return "", fmt.Errorf("open DOCX document: %w", err)
		}
		defer stream.Close()
		decoder := xml.NewDecoder(stream)
		var text strings.Builder
		for {
			token, err := decoder.Token()
			if err == io.EOF {
				return text.String(), nil
			}
			if err != nil {
				return "", fmt.Errorf("parse DOCX document: %w", err)
			}
			if chars, ok := token.(xml.CharData); ok {
				text.Write(chars)
				text.WriteByte(' ')
			}
		}
	}
	return "", fmt.Errorf("DOCX document body is missing")
}
