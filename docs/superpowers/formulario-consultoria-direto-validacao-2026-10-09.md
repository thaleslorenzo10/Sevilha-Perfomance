# Formulario direto de consultoria

Rota: `/formulario-consultoria`. Formulario abre imediatamente, sem landing page,
modal ou controle de fechar. Mesmas seis perguntas e contatos no final.
Origem propria preservada em banco, Sheets, CRM/Marketing, CAPI e dashboards SE.
UTMs e evento compartilhado Pixel/CAPI permanecem no contrato existente.

## Verificacao local

- Lint: exit 0; 733 avisos raiz e 2 Next, sem rebaixar regras.
- Biome: exit 0; 5 avisos existentes.
- Next build e typecheck: exit 0. Raiz HTML/serverless sem build/typecheck canonicos.
- Testes: consultoria-leads, consultoria-form-ui, form-passos, sessao-estrategica,
  leads-unificados, dash-cruzamento, eventos-pagina, stats-paginas, pageview,
  leads-capi e lead-qualificado passaram.
- Agent-browser desktop 1440x900/mobile 390x844: primeira pergunta imediata,
  seis etapas, voltar, Escape sem fechar, baixo porte/cargo operacional.
- Submissao de navegador simulada: `pagina=/formulario-consultoria`, UTMs
  preservadas, Pixel Lead com mesmo event ID e foco na confirmacao.
- Axe: zero violacoes desktop/mobile; console/page errors vazios; sem overflow horizontal.
- Nenhum envio de teste de navegador foi feito a integracoes externas.
- Banco real da nova origem: POST201, CAS JSONB, rejeicao de estado obsoleto,
  retry/concorrencia passaram; cleanup DELETE200 removeu exatamente uma linha,
  GET final confirmou zero. Zero chamadas aos destinos externos.
- Revisao independente conferiu fontes/filtros/atribuicao e corrigiu inclusao
  dos visitantes diretos no funil geral SE; nenhum blocker restante encontrado.
- Gitleaks staged com --redact: nenhuma exposicao de segredo encontrada.

## Publicacao autorizada

Usuario autorizou publicar em producao nesta conversa. Deploy deve usar checkout
limpo dos commits da tarefa, sem carregar alteracoes preexistentes do workspace.
Etapa RD CRM SE em production configurada e relida:
`RD_CRM_STAGE_ID_SE=68d152fa949ae20022df32cd` (Consultoria/Novos Leads).
Relatorio SE em production inclui tres origens. Allowlists sensiveis de Sheets e
beacon foram preservadas; codigo acrescenta apenas a nova origem pedida e mantem
todos os outros itens existentes. Nenhum codigo Meta de teste foi propagado.

## Limites

Credenciais locais de Sheets/conversoes Marketing/CAPI continuam pendentes.
Configuracao presente em producao nao comprova entrega real nos destinos.
Nao alterar campanhas nem gerar evento Meta de producao para teste sintetico.
Envios ambiguos exigem readback antes de repetir, conforme entrega anterior.

## Producão conferida

- Publicado do checkout limpo `58c9f66`; build remoto Node24/Python3.12 passou.
- Deploy `dpl_He9NEd9tv8iQZHymGQ8SM3q19NQu`: GET autenticado confirmou READY/production e alias publico.
- Link publico: https://sevilha-perfomance.vercel.app/formulario-consultoria, HTTP200.
- Agent-browser em producao: desktop/mobile renderizados, seis etapas,
  voltar/sucesso e UTMs/event ID conferidos com submissao simulada; axe zero violacoes.
- Endpoint publicado recusou payload incompleto com HTTP400/dados_invalidos,
  sem gravar lead ou acionar destinos. Submissao real externa nao executada.
- `/mentoria` e `/mentoria-2`: modais abrem por CTA visivel, seis etapas e assets v6/v3 corretos.
- URL imutavel do deploy redireciona ao SSO Vercel; aberta via agent-browser,
  pediu login. Nao declarar verificacao do formulario nessa URL protegida.
  Dominio publico foi a superficie de verificacao real de producao.
