# Service Account para a [CENTRAL DE EVENTOS]

## Por que trocar

O export do formulário instantâneo não cabe numa aba só. Quando uma enche,
alguém cria a seguinte — hoje são "Leads Forms" (21/12/2025 a 06/04/2026) e
"Leads Forms 2" (06/04 em diante).

No modo CSV, cada aba precisa do seu gid em `LEADS_SHEET_GID_FORMS`. Quem cria
a aba nova é quem opera a planilha; quem lembra de atualizar a variável é outra
pessoa. Foi exatamente o que falhou entre abr e ago/2026: só a aba nova estava
listada, e o dashboard passou a ler 773 dos 1.564 leads. Sem erro — a leitura
respondia 200 com metade dos números.

A Service Account é o único caminho que **enumera as abas**. Com ela
configurada e `LEADS_SHEET_GID_FORMS` vazio, toda aba com título `Leads Forms*`
entra sozinha, inclusive a que ainda não existe.

Só vale para a Central. A planilha do Respondi (LP) é do cliente e continua
sendo lida por CSV público — não precisa compartilhar nada com a conta de
serviço lá.

## Passo a passo

**1. Projeto no Google Cloud** — <https://console.cloud.google.com>. Pode ser um
projeto existente ou um novo (`Sevilha Performance`, por exemplo).

**2. Habilitar a API** — *APIs e serviços → Biblioteca* → procure
**Google Sheets API** → *Ativar*. Sem isso o token sai, mas toda leitura volta
403.

**3. Criar a conta de serviço** — *APIs e serviços → Credenciais → Criar
credenciais → Conta de serviço*. Nome à escolha (`leitor-planilhas`).

Na etapa de papéis (*roles*), **não conceda nenhum**. A permissão desta conta
não vem do projeto, vem do compartilhamento da planilha no passo 5. Papel de
projeto aqui só aumentaria o alcance do segredo sem necessidade.

**4. Gerar a chave** — abra a conta criada → aba *Chaves* → *Adicionar chave →
Criar nova chave → JSON*. O arquivo baixa uma vez só; o Google não mostra de
novo.

Dentro dele interessam dois campos:

```json
{
  "client_email": "leitor-planilhas@projeto.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
}
```

**5. Compartilhar a planilha** — abra a
[CENTRAL DE EVENTOS](https://docs.google.com/spreadsheets/d/1cedv5kfJhdwcySI1KcqQM4jS_LjIPnUhdYv1aU-SMxg)
→ *Compartilhar* → cole o `client_email` → permissão **Leitor** → enviar.
Desmarque "Notificar" (é uma conta de máquina, ninguém lê o e-mail).

Este é o passo que dá acesso. Sem ele, a autenticação funciona e a leitura
volta 403.

**6. Variáveis no Vercel** — *Project → Settings → Environment Variables*,
marcando Production, Preview e Development:

| Variável | Valor |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | o `client_email` do JSON |
| `GOOGLE_PRIVATE_KEY` | o `private_key` **inteiro**, com o `-----BEGIN` e o `-----END` |
| `LEADS_SHEET_GID_FORMS` | **apague o valor** |

Sobre a chave: o campo do JSON traz as quebras de linha escritas como `\n`.
Pode colar assim mesmo — `lib/sheets.js` converte. Colar com quebras de linha
de verdade também funciona. O que não funciona é colar só um pedaço, e é o
engano mais comum; se acontecer, o erro diz qual dos dois problemas é.

Sobre o gid: **precisa ficar vazio**. Com ele preenchido, a Service Account lê
só as abas listadas e a descoberta por título não roda — ou seja, o problema
que motivou a troca continuaria de pé.

`LEADS_SHEET_ID` continua como está.

**7. Redeploy.** Variável nova só vale para deploy feito **depois** de salvá-la.
*Deployments → ⋯ → Redeploy* no último.

## Conferir

```
node scripts/verificar-planilha.js
```

Com um `.env` na raiz ele carrega as variáveis sozinho. A saída esperada:

```
  modo ................ Service Account
  gids configurados ... (nenhum)

  abas lidas: 2
    · Leads Forms           gid 123456789     793 leads  2025-12-21 → 2026-04-06
    · Leads Forms 2         gid 1331027312    773 leads  2026-04-06 → 2026-08-11

  total de leads de FORMS: 1566
```

O script reclama sozinho dos dois enganos que importam: gid preenchido junto
com a Service Account, e buraco grande de dias sem lead (que costuma ser aba
que ninguém listou).

## Enquanto não trocar

O modo CSV continua funcionando, e desde a correção `LEADS_SHEET_GID_FORMS`
aceita vários gids separados por vírgula. Para voltar a ler tudo hoje, pegue o
gid da aba "Leads Forms" — clique nela e olhe o fim da URL, depois de `#gid=`:

```
LEADS_SHEET_GID_FORMS=<gid da "Leads Forms">,1331027312
```

Isso resolve o presente. A próxima aba vai precisar do mesmo cuidado — que é o
motivo de o caminho acima existir.
