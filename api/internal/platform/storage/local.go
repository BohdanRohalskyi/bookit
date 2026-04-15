package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// LocalClient stores uploaded files on the local filesystem.
// Intended for local development only — use GCSClient in production.
type LocalClient struct {
	baseDir string // absolute path to the uploads root directory
	baseURL string // public base URL used to build file URLs, e.g. http://localhost:8080
}

// NewLocalClient creates a LocalClient that stores files under baseDir and
// serves them from baseURL/uploads/<objectName>.
func NewLocalClient(baseDir, baseURL string) *LocalClient {
	return &LocalClient{baseDir: baseDir, baseURL: baseURL}
}

// UploadFile writes r to baseDir/objectName and returns the public URL.
// Directories are created as needed.
func (c *LocalClient) UploadFile(_ context.Context, objectName string, r io.Reader, _ string) (string, error) {
	// filepath.FromSlash converts forward slashes to OS path separators.
	// objectName is constructed by service layer code, not from raw user input.
	dest := filepath.Join(c.baseDir, filepath.FromSlash(objectName)) //nolint:gosec // G304: controlled path

	if err := os.MkdirAll(filepath.Dir(dest), 0o750); err != nil {
		return "", fmt.Errorf("local storage mkdir: %w", err)
	}

	f, err := os.Create(dest) //nolint:gosec // G304: controlled path
	if err != nil {
		return "", fmt.Errorf("local storage create: %w", err)
	}

	if _, err := io.Copy(f, r); err != nil {
		_ = f.Close() //nolint:errcheck // secondary error; write error takes precedence
		return "", fmt.Errorf("local storage write: %w", err)
	}

	if err := f.Close(); err != nil {
		return "", fmt.Errorf("local storage close: %w", err)
	}

	return fmt.Sprintf("%s/uploads/%s", c.baseURL, objectName), nil
}
