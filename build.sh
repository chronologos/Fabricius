#!/bin/bash
# Install pnpm if not available
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi

pnpm install
pnpm run bundle
