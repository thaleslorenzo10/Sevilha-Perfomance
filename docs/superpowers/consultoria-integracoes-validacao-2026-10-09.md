# Consultoria: integracoes e qualificacao

## Escopo

Tres formularios: /mentoria, /mentoria-2, /formulario-consultoria.
Banco antes do sucesso; recibos de Sheets, RD Marketing, RD CRM, Lead CAPI e qualificacao.
Consultoria qualifica somente acima de 10 colaboradores, sem requisito de cargo.
Novas faixas: 5 a 10 e 11 a 19. Faixa historica 10 a 19 fica indefinida; outras ofertas conservam a regra anterior.
Pixel LeadQualificado usa ID deterministico do CAPI apos persistencia, independentemente da disponibilidade do servidor Meta.

## Evidencia real

- Supabase: leitura autenticada limit=0 HTTP 200 no recurso correto.
- Google Sheets: conta de servico do runtime autenticou; aba configurada existe, canEdit=true, HTTP 200.
- Submissao real existente na origem direta: banco salvo e Sheets/RD Marketing/CAPI/qualificacao enviados. Nenhuma identidade pessoal e reproduzida neste documento.
- RD CRM: etapa Consultoria -> Novos Leads, usuario e origem confirmados. Negociacao real existente recebeu dados do formulario; vinculo de contato e recibo do banco foram reconciliados por CAS, sem nova negociacao para o lead.
- Causa CRM reproduzida: resposta HTTP 200 com ID criado e errors vazio. Adaptador agora ignora somente arrays/objetos errors vazios, mas preserva falhas HTTP, error e errors nao vazios. Regressao offline cobre essas formas.
- Meta CAPI no runtime de producao: Lead e LeadQualificado test-only, HTTP 200, events_received=1 para cada, API efetiva v24.0. Identidade sintetica example.invalid, sem IP, test_event_code somente nos dois corpos de teste; nunca habilitado globalmente para o trafego real.
- Consulta GET do token CAPI ao dataset retornou erro 100, mas o envio acima foi aceito. Permissao de leitura do objeto nao e equivalente a permissao de envio.
- CAPI fixada v24.0, evitando depender da migracao automatica de v19.0 observada no header da Meta.
- Conversao personalizada criada e relida: 1819649455855852, conta 1676714556216146, pixel 657178423444244. Regra LeadQualificado AND URL das paginas da consultoria no dominio publico. Reexecucao do script detectou o mesmo ativo, sem duplicar.
- Nenhuma campanha, anuncio, orcamento ou automacao de marketing foi alterado.

## Verificacao

- 16 suites offline de formulario, persistencia, CRM, CAPI, porte, dashboard, stats e eventos passaram com exit 0; revisao independente sem novos achados apos as correcoes.
- Next build e typecheck (executado apos build) passaram com exit 0. Raiz estatica/serverless nao possui build/typecheck canonicos.
- Biome passou com cinco avisos existentes; lint final sem rebaixar regras nem aumentar teto de linhas.
- agent-browser local: desktop 1440x900 e mobile 390x844; faixas novas, fluxo completo com cargo operacional, UTMs preservadas e Pixel qualificado mesmo com recibo CAPI falhou (submissao interceptada, nao enviada).
- Formulario local: axe zero violacoes/incomplete; console vazio; sem overflow horizontal.
- Dashboard local renderizou com APIs reais de producao (leituras); aba SE mostra MQL (>10 na consultoria), sem overflow nas duas larguras. As contagens dessas leituras precedem o novo deploy.
- Probe autenticado temporario de runtime usado apenas para leituras e Meta test-only. O ramo de teste CRM escrito depois NAO foi publicado nem executado em producao; endpoint removido do worktree de publicacao antes do deploy final.

## Pendencia de limpeza

Um teste isolado de criacao CRM confirmou HTTP 200, sem contatos, e-mail ou telefone:
negociacao 6ac938cb3ecb36002452ed39, nome [SE] TEST_consultoria_824c87c3-9d03-42e8-8f96-588424792108.
DELETE v1 devolveu 404, mas GET confirmou que a negociacao ainda existe; 404 do DELETE nao e evidencia de exclusao.
A API v1 nao disponibiliza exclusao de negociacoes/contatos. Nao ha perfil autenticado do CRM no agent-browser.
Nenhum novo teste CRM sera criado. A negociacao sintetica fica excluida das metricas por seu prefixo/UUID exatos e precisa ser removida pela interface autenticada do RD CRM.

Referencias: https://developers.rdstation.com/reference/crm-v1-introducao-e-requisitos e https://vercel.com/docs/environment-variables/sensitive-environment-variables.
