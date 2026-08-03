#!/usr/bin/env bash
# Baixa as fontes usadas em compor.py. Ambas são OFL (redistribuição livre).
set -euo pipefail
dir="${1:-./fonts}"
mkdir -p "$dir"
for f in ofl/anton/Anton-Regular.ttf ofl/poppins/Poppins-Medium.ttf ofl/poppins/Poppins-Bold.ttf \
         ofl/spacemono/SpaceMono-Regular.ttf ofl/spacemono/SpaceMono-Bold.ttf; do
  curl -sSL -o "$dir/$(basename "$f")" "https://raw.githubusercontent.com/google/fonts/main/$f"
  echo "$(basename "$f")"
done
