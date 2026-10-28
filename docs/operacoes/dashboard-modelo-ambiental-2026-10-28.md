# Dashboard Sevilha no modelo Ambiental — 28/10/2026

Dashboard principal: https://sevilha-perfomance.vercel.app/dashboard.
Design system Lorenzo com marca Sevilha; navegação visão geral, perpétuos e
lançamentos, com cada funil separado e análises históricas preservadas.

- Sessão Estratégica: formulário nativo Meta e páginas do site em dois perpétuos.
- Aula: edições06/10 e27/10 como lançamentos independentes.
- Café: edição11/11 como lançamento.
- Perpétuos usam o mês; lançamentos usam o acumulado da respectiva edição.

`GET /api/stats?modo=operacao` aceita funil, since, until e edicao para
lançamentos. O filtro de origem/edição precede a deduplicação. Site inclui
/mentoria, /mentoria-2 e /formulario-consultoria. Dois registros de teste
identificados na auditoria anterior são excluídos somente por seus IDs, sem
apagar registros. Faixas antigas10–19 não comprovam qualificação>10.
Cada fonte falha independentemente e ausência de dado não é zero.

Aula mantém pedidos e gravação separados; a Central identifica receita como
valor cobrado, com acréscimos e antes de taxas. Pagamentos importados com data
aproximada mantêm ressalva; total comercial não equivale a receita atribuída.
Mídia é vinculada por campaign_id, inclusive filhos e diário; os nomes não
servem como identidade. Histórico06/10 fica no dashboard/debriefing e não
gera mensagem retroativa. Cadência e destino WhatsApp preservados.

## Validação

Sete testes de escopo/fonte/identidade, script de interface e suítes legadas
leads-unificados, eventos-dashboard e meta-agregados passaram. Arquivos
alterados sem erro de lint; o lint completo ainda contém26 erros em arquivos
não alterados. Central:112 testes sem skips, tipos, build e lint sem erros.
Interface local1440×900 e390×844 conferida com dados sintéticos; sem overflow
ou erro JS. Isto não substitui a conferência de dados em produção.

Publicação usa os arquivos revisados sobre o snapshot real da Vercel, pois
origin/main é anterior à versão pública. Hashes de todos os demais arquivos
serão conferidos. Fontes sem detalhe específico por funil permanecem
indisponíveis; a organização e o inventário seguem o modelo, sem afirmar
paridade de todas as interações com o Ambiental.
