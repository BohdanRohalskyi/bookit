package storage

import (
	"context"
	"fmt"
	"io"

	"cloud.google.com/go/storage"
)

// Client wraps the GCS storage client with a fixed bucket.
type Client struct {
	bucket string
	client *storage.Client
}

// NewClient creates a GCS client using Application Default Credentials.
// Returns nil, nil when bucket is empty (local dev without GCS configured).
func NewClient(ctx context.Context, bucket string) (*Client, error) {
	if bucket == "" {
		return nil, nil
	}
	c, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("storage.NewClient: %w", err)
	}
	return &Client{bucket: bucket, client: c}, nil
}

// UploadFile streams r to GCS under objectName and returns the public URL.
func (c *Client) UploadFile(ctx context.Context, objectName string, r io.Reader, contentType string) (string, error) {
	wc := c.client.Bucket(c.bucket).Object(objectName).NewWriter(ctx)
	wc.ContentType = contentType

	if _, err := io.Copy(wc, r); err != nil {
		_ = wc.Close()
		return "", fmt.Errorf("io.Copy: %w", err)
	}
	if err := wc.Close(); err != nil {
		return "", fmt.Errorf("Writer.Close: %w", err)
	}

	return fmt.Sprintf("https://storage.googleapis.com/%s/%s", c.bucket, objectName), nil
}
