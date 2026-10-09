# Formulario Consultoria Direto

> For agentic workers: use superpowers:subagent-driven-development.

Goal: campanha pode apontar direto a `/formulario-consultoria`, com seis perguntas,
contatos no final e atribuicao independente das LPs. Plano auto-aprovado conforme
instrucao do usuario. Nao mudar campanhas nem publicar sem autorizacao aplicavel.

1. Frontend: criar `formulario-consultoria/index.html` e CSS minimo de pagina;
   reutilizar `form-steps.js`, tracking e CSS existentes. Modo standalone sem fechar,
   overlay ou foco preso. Testar navegacao/sucesso/validacao nas tres paginas.
2. Backend: reconhecer origem como oferta SE no endpoint/CAS, Sheets, dashboard,
   beacon e tracking; preservar UTMs/pagina e isolamento de funil. Testes focados
   da terceira origem, sem envios externos.
3. Coordenador: integrar, revisar diff, agent-browser desktop/mobile, lint/Biome,
   typecheck/testes/build, commit somente arquivos da tarefa. Entregar link local;
   nao declarar URL publica antes de deploy/readback. Credenciais externas seguem
   pendentes conforme entrega anterior.

Review focus: filtros CAS em nova pagina, allowlists de env antigas, pagina/UTMs
na submissao, Enter/voltar, Escape/Tab em pagina sem modal e assets renderizados.
