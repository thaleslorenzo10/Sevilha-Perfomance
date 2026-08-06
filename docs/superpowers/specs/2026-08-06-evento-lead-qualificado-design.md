# Evento `LeadQualificado` no Meta para escritórios de 10+ colaboradores

Data: 2026-08-06 · Status: aprovado pelo usuário

## Objetivo

Avisar o Meta quando um lead responde que tem 10 ou mais colaboradores — o perfil
que a consultoria quer. Hoje o Meta só recebe o evento `Lead`, sem distinção de
porte, e a qualificação existe apenas no dashboard.

## Expectativa de volume (medida, não estimada)

Aplicando a regra aos dados reais de 2026:

| funil | leads/mês | qualificados/mês | taxa |
|---|---|---|---|
| Respondi (LP) | 82 | 16 | 20% |
| Formulário nativo do Meta | 187 | 24 | 22% |
| **juntos** | | **40** (~10/semana) | |

O Meta pede ~50 conversões por semana por conjunto para otimizar bem. Com
~10/semana, este evento serve para **leitura de CPA qualificado, público
semelhante e sinal agregado** — não como meta de otimização de campanha. A
decisão de construir foi tomada com essa expectativa explícita.

## Decisões (validadas com o usuário)

1. Evento **personalizado** `LeadQualificado` (não um evento padrão do Meta) —
   nome próprio, sem se misturar com o `Lead` que já existe.
2. Vale para **os dois funis**: formulário do Respondi (LP) e formulário
   instantâneo do Meta (FORMS).
3. Destino **só Meta CAPI**. Nada de RD Marketing ou RD CRM nesta entrega.
4. Qualificado = **10 ou mais colaboradores**, a mesma regra que o dashboard já
   usa (`MAIOR_10`).

Fora de escopo: o formulário do site (`/pre-inscricao`, Clube da Performance)
vende para escritórios de **até** 10 pessoas — lá 10+ é o perfil errado e
precisaria de outra regra.

## Arquitetura

### Regra única de qualificação — `lib/porte.js`

`classificarPorte()` sai de `api/sheet-leads.js` para `lib/porte.js`, sem mudança
de comportamento. Ela já trata os 16 formatos de resposta que existem na base
("De 10 a 19", "10 à 19", "Mais de 50", "Acima de 30 colaboradores", "6 a 10",
"Até 5", números soltos, ruído de coluna desalinhada). Dashboard e eventos
passam a ler a mesma função — a regra não pode divergir entre o que o Meta
recebe e o que o painel mostra.

### Envio ao CAPI — `lib/capi.js`

O hash SHA-256, a normalização de e-mail/telefone/nome e o POST no Graph saem de
`api/leads.js` para `lib/capi.js`, expondo
`enviarEvento({ evento, eventId, quando, userData, customData, sourceUrl, actionSource })`.
`api/leads.js` passa a usar o helper mantendo exatamente o payload de hoje.

### Fase 1 — Respondi (`POST /api/respondi`)

O formulário do Respondi é externo (`form.respondi.app/gvz4UKQr`) e os anúncios
apontam direto para ele, então não há como injetar JS na página. O caminho é o
webhook nativo do Respondi, que envia as respostas e as UTMs em JSON.

Fluxo: valida o segredo → extrai respostas → classifica o porte → se for 10+,
envia `LeadQualificado` ao CAPI.

- **Autenticação**: `RESPONDI_WEBHOOK_SECRET`, aceito no header
  `X-Webhook-Secret` ou na query `?token=` (nem todo painel de webhook deixa
  configurar header). Comparação em tempo constante. Sem segredo válido → 401.
  O endpoint é público na internet: sem isso, qualquer um injeta conversão falsa
  no pixel.
- **Formato do payload** (confirmado no workflow n8n que já recebe este webhook,
  node `Code1`): as respostas ficam em `respondent.answers`, chaveadas pelo
  texto da pergunta, e as UTMs em `respondent.respondent_utms`. **Não há id de
  submissão**, então a chave de deduplicação é o hash do contato — sem ela, o
  retry do Respondi viraria uma segunda conversão. Lead qualificado sem e-mail
  nem telefone não gera evento: sem contato não há chave estável nem
  correspondência, e o dashboard também não conta esse lead.
- **Extração resistente a formato**: a leitura percorre o JSON inteiro e
  localiza cada campo pelo conteúdo, em vez de fixar o caminho acima — a mesma
  tática que `extractForms` já usa para o export do Meta:
  - colaboradores: chave contendo "colaborador"
  - e-mail: valor com formato de e-mail
  - telefone: chave de whatsapp/telefone, ou valor com formato de telefone BR
  - `fbclid`, `utm_*`: chave exata, em qualquer nível
  - id da submissão: `id` / `submission_id` / `response_id` na raiz
- **Identificadores enviados**: e-mail e telefone hasheados (94% e 90% de
  preenchimento), `fbc` derivado do fbclid (88%), IP e user-agent se vierem.
- **`event_id`** = id da submissão do Respondi (UUID estável) → retentativa do
  webhook não vira evento duplicado.
- **`action_source`** = `website`; `event_source_url` = URL do formulário.
- **Resposta**: 200 sempre que o payload for válido, inclusive quando o lead não
  é qualificado — webhook que recebe 5xx entra em retry e duplicaria. 401 só
  para segredo inválido, 400 para corpo ilegível.
- **Log sem PII**: registra apenas se cada campo foi encontrado e o porte
  classificado. Nunca e-mail, telefone ou nome.

**Passo manual obrigatório**: alguém com acesso à conta do Respondi (o dono é
bruno@sevilhaperformance.com.br) precisa cadastrar a URL do webhook
(`https://sevilha-perfomance.vercel.app/api/respondi?token=<segredo>`). Sem esse
passo nada dispara. Depois do primeiro disparo real, conferir no log se a
extração encontrou os campos e ajustar a fixture do teste se o formato divergir.

### Fase 2 — Formulário nativo do Meta (`GET /api/forms-qualificados`, cron diário)

Lê a aba de FORMS da planilha [CENTRAL DE EVENTOS] (reusa `readAllTabs`),
seleciona os qualificados, ignora test leads (regra que já existe) e envia
`LeadQualificado` para cada um.

- **Identificador principal**: `user_data.lead_id` = o `id` do export sem o
  prefixo `l:` (ex.: `l:906827909019290` → `906827909019290`). É o identificador
  não-hasheado que o Meta recomenda para eventos vindos de CRM sobre leads de
  formulário instantâneo. O export também traz `email` e `phone_number`, que vão
  hasheados junto para elevar a correspondência.
- **`action_source`** = `system_generated` (evento gerado por sistema, não por
  navegação).
- **Estado em Supabase**: tabela `sevilha_eventos_enviados` (`event_id` como
  chave primária), criada no projeto Lorenzo Media seguindo a convenção
  `<cliente>_<dominio>` e com RLS ligado — só a service key escreve. A janela de
  deduplicação do Meta é de 48h; sem controle próprio, qualquer atraso no sync
  da planilha vira evento duplicado ou lead perdido em silêncio — o pior
  desfecho, pelo mesmo critério já adotado no resto do projeto.
- **Janela de 7 dias**: o CAPI recusa evento com mais de 7 dias, então a
  varredura ignora leads mais antigos e devolve quantos ficaram de fora, em vez
  de tentar e falhar calado. Consequência: o histórico (338 leads qualificados
  desde dez/2025) não tem como ser recuperado por aqui — só passa a valer da
  entrada em produção para a frente.
- **Cron**: entrada em `vercel.json`, diária às 9h UTC (6h de Brasília).

**Dependência não verificável daqui**: o envio com `lead_id` faz parte da
integração de CRM do Meta e pode exigir configuração no Events Manager
vinculando o CRM à conta. Se estiver faltando, o evento é aceito mas não atribui
corretamente. Verificar a qualidade de correspondência no Events Manager depois
do primeiro envio.

### Conversão personalizada

Depois do primeiro evento chegar, criar via API a conversão personalizada
"Lead Qualificado (10+)" sobre o evento `LeadQualificado` nas duas contas Sevilha
(`3048052985232837` e `3451731371506645`, pixel `657178423444244`). Sem ela o
evento chega mas não vira coluna de relatório nem base de público semelhante.

## Testes

Node puro, sem framework, no padrão dos scripts do repositório. Nenhum faz
chamada de rede — o `fetch` é stubado e as asserções olham o payload montado.

- `scripts/test-porte.js` — a regra contra os 16 formatos de resposta reais,
  incluindo os que caem em INDEFINIDO (vazio, ruído `1,20249E+17`).
- `scripts/test-respondi-webhook.js` — fixture de payload do Respondi:
  qualificado dispara; não-qualificado não dispara; segredo ausente/errado → 401;
  resposta de colaboradores em branco não dispara; `event_id` = id da submissão;
  `fbc` montado a partir do fbclid; e-mail e telefone chegam hasheados (nunca em
  claro).

## Riscos aceitos

- Volume de ~40/mês nos dois funis: evento de leitura e público, não de
  otimização.
- O endpoint do Respondi é público; a proteção é o segredo compartilhado.
- A Fase 2 depende da cadência do sync da planilha e da configuração de CRM no
  Events Manager.
- O formato do payload do Respondi foi inferido da documentação pública indireta;
  a extração é defensiva, mas o primeiro disparo real precisa ser conferido.

## Deliberadamente fora

O webhook **não** dispara o evento `Lead` comum. Como o formulário é externo, é
possível que o funil LP hoje não mande nenhum sinal de conversão ao Meta — mas se
o Respondi já tiver o pixel configurado do lado dele, disparar aqui dobraria a
contagem. Checar com o Bruno antes, em separado.
