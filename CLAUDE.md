# Sevilha Performance — site, páginas de captura e dashboards

> Site e páginas de conversão da Sevilha Performance, com funções serverless de leads, métricas e imagens.
> Memória de projeto do Claude Code. Manter curto e de sinal alto.

## Diretrizes de comportamento

1. **Pensar antes de codar** — declare suposições. Havendo mais de uma leitura razoável do pedido, apresente-as em vez de escolher calado. Se existe caminho mais simples, diga. Se algo está genuinamente ambíguo, pare e pergunte.
2. **Simplicidade primeiro** — o mínimo de código que resolve. Sem feature especulativa, sem abstração para uso único, sem configurabilidade não pedida, sem tratamento de erro para cenário impossível.
3. **Mudança cirúrgica** — toque só no que o pedido exige. Siga o estilo existente. Não refatore nem reformate código vizinho que não fazia parte do pedido.
4. **Execução orientada a objetivo** — transforme tarefa em meta verificável ("corrigir o bug" vira "escrever o teste que reproduz, depois fazer passar"). Em trabalho de vários passos, declare o plano com uma verificação por passo e repita até cada passo estar verificado.
5. **Orquestrador, não implementador** — a sessão principal planeja, decide e coordena; não implementa. Implementação e análise delegáveis vão para subagente especialista, despachados em paralelo quando os escopos não se cruzam (ver skill `parallel-subagent-driven-development`).

## Stack

HTML estático · funções serverless Node e Python em `api/` (Vercel) · `@vercel/og` para imagem · Pillow

## Comandos canônicos

Use exatamente estes comandos — não adivinhe.

- **Install:** `npm install` (só `@vercel/og`) e `pip install -r requirements.txt`
- **Lint:** não há — não invente um
- **Typecheck:** não se aplica
- **Test:** não há suíte automatizada — verificar no navegador e pelas rotas de `api/`
- **Build:** não há — páginas estáticas
- **Run/Dev:** `vercel dev` (as rotas de `api/` não sobem em servidor estático)

## Roteamento de especialistas

Quando o trabalho for delegável, despache o especialista que casa com a tarefa, nunca um agente genérico.

| Agente | Quando usar |
|---|---|
| `orchestrator` | Coordena tarefa multi-domínio ou que precise de execução paralela de subagentes. |
| `code-reviewer` | Revisa mudança de código: bug, segurança, tratamento de erro, cobertura. Use depois de editar qualquer fonte. |
| `security-reviewer` | OWASP Top 10, segredo hardcoded, autenticação quebrada, CVE de dependência. Use antes de qualquer merge que toque auth, entrada de usuário ou segredo. |
| `test-engineer` | Escreve teste unitário e de integração com disciplina de TDD e casos de borda. Use depois de implementar lógica nova. |
| `backend-specialist` | Endpoint, lógica de servidor, persistência. |
| `frontend-specialist` | Componente de UI, layout, performance de front. |

## Convenções

- Existem várias páginas de captura irmãs (`mentoria`, `mentoria-2`, `pre-inscricao-2`, `pre-inscricao-3`, `clube-da-performance`): mudança numa **não** se propaga para as outras — decida explicitamente quais atualizar.
- `vercel.json` declara cron (`/api/eventos-qualificados`, 9h) e dezenas de rewrites — mexer em rota exige conferir esse arquivo.
- Mudança visual só está pronta depois de conferida no navegador (agent-browser).

## Referência do fluxo

Playbook completo, prompts e templates espelhados em `~/.claude/vct-reference/`
(fonte: `soumatheusgomes/vibe-coding-toolkit`). Fluxo padrão:
brainstorm → plano → implementação em ondas paralelas → revisão multi-agente →
commit (um por task, feito pelo orquestrador, nunca pelo subagente).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
