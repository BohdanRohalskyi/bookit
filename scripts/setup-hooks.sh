#!/bin/bash

# Setup git hooks for the project
# Run this script after cloning the repository

set -e

ROOT_DIR="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
SCRIPTS_HOOKS_DIR="$ROOT_DIR/scripts/hooks"

echo "Setting up git hooks..."

# Create symlinks for all hooks
for hook in "$SCRIPTS_HOOKS_DIR"/*; do
    if [ -f "$hook" ]; then
        hook_name=$(basename "$hook")
        target="$HOOKS_DIR/$hook_name"

        # Remove existing hook if it's not a symlink to our script
        if [ -e "$target" ] && [ ! -L "$target" ]; then
            echo "Backing up existing $hook_name to $hook_name.bak"
            mv "$target" "$target.bak"
        fi

        # Create symlink
        ln -sf "$hook" "$target"
        chmod +x "$target"
        echo "Installed $hook_name hook"
    fi
done

echo ""
echo "Git hooks installed successfully!"
echo "Hooks will run automatically on git push."
