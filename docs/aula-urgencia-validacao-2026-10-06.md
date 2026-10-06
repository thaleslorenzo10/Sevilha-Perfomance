# Aula — urgência em 06/10/2026

Página: https://sevilha-perfomance.vercel.app/aula-gestao-operacional/

Fonte publicada: b94fdf6ae28d3fc3a1d2d817f6a83f213fa4722d, branch codex/se-captacao-google-20261005.
Deploy produção: dpl_31zZ9tfXbHgsb11tLbFB5skg7vn4 — READY, alias público confirmado.

Avisos no hero e junto aos dois CTAs: aula hoje às 19h30 no Zoom, Brasília; lote vira hoje às 16h com contagem regressiva. A virada some às 16h; o aviso da aula some às 19h30. Preço, estoque, checkout, formulários e integrações preservados.

Verificação:
- Teste Node offline passou às 15:59:59, 16h, 19h30, dia seguinte, configurações inválidas, troca de aba e fusos Honolulu/Tóquio.
- ESLint dos arquivos alterados: zero erros, dois avisos preexistentes no HTML.
- Lint global: zero erros, 781 avisos na raiz e dois no clube. Biome: zero erros, cinco avisos.
- Typecheck e build do clube passaram. Página estática da raiz não tem build próprio.
- Agent-browser local: 390 e 1440 px, screenshots inspecionados, sem overflow; modal abre/fecha; console sem erros; axe zero violações e zero incomplete. Nenhum formulário enviado. Stats local simulado, sem alegação de validação da integração real.
- Produção: agent-browser em 390 e 1440 px, screenshots inspecionados, sem overflow; console sem erros; axe zero violações e zero incomplete. Endpoint real /api/stats?modo=aula respondeu 200; recursos 200/304, sem submissões.
- HTML/CSS/JS públicos coincidem byte a byte com fonte validada.

Preview: dpl_8fFoZGmZQYZQFputRacQ7yrYXGtQ — READY. Proteção SSO limita conferência do aplicativo; não foi contornada.
