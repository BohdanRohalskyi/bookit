.PHONY: tools generate build test lint run clean

# Install development tools
tools:
	go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/securego/gosec/v2/cmd/gosec@latest
	go install golang.org/x/vuln/cmd/govulncheck@latest

# Generate code from OpenAPI spec
generate:
	oapi-codegen --config oapi-codegen.yaml openapi/spec.yaml

# Build binary
build:
	go build -o bin/server ./cmd/server

# Run tests
test:
	go test -race -cover ./...

# Run linter
lint:
	golangci-lint run

# Security scan
security:
	gosec ./...
	govulncheck ./...

# Run locally (requires .env file)
run:
	go run ./cmd/server

# Clean build artifacts
clean:
	rm -rf bin/

# Run all CI checks
ci: lint test build
