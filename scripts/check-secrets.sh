#!/bin/bash
# CI check: verify Gemini API key has not leaked into the client bundle.
# Run after every `next build`: bash scripts/check-secrets.sh
set -e

if [ ! -d ".next/static" ]; then
  echo "ERROR: .next/static not found — run 'pnpm build' before this script"
  exit 1
fi

echo "Checking client bundle for GEMINI_API_KEY..."
if grep -r "GEMINI_API_KEY" .next/static/ 2>/dev/null; then
  echo "FAIL: GEMINI_API_KEY found in client bundle"
  exit 1
fi

echo "Checking client bundle for Google AI key pattern (AIza)..."
if grep -r "AIza" .next/static/ 2>/dev/null; then
  echo "WARNING: Possible API key pattern (AIza) found in client bundle"
  exit 1
fi

echo "PASS: No API key found in client bundle"
