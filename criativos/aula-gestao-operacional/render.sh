#!/usr/bin/env bash
# Renderiza cada HTML em PNG 1080×1350 via agent-browser (sessão nomeada) e monta o preview.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix criativos)"
trap 'agent-browser close >/dev/null 2>&1 || true' EXIT
for peca in margem oito-por-cento tentou-de-tudo; do
  agent-browser open "file://$PWD/$peca.html"
  agent-browser set viewport 1080 1350
  agent-browser wait --load networkidle
  agent-browser wait 1500   # Poppins/Inter do Google Fonts
  agent-browser screenshot "out/$peca-4x5.png"
  # Se a captura vier cortada (~y580), trocar por: screenshot --full + ffmpeg -vf crop=1080:1350:0:0
  sips -g pixelWidth -g pixelHeight "out/$peca-4x5.png" | tail -2 | tr '\n' ' '; echo " $peca"
done
ffmpeg -y -loglevel error -i out/margem-4x5.png -i out/oito-por-cento-4x5.png -i out/tentou-de-tudo-4x5.png \
  -filter_complex "[0]scale=540:-1[a];[1]scale=540:-1[b];[2]scale=540:-1[c];[a][b][c]hstack=3" out/preview.png
echo "preview: out/preview.png"
