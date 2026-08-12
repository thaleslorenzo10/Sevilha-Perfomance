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
  "type": "service_account",
  "client_email": "leitor-planilhas@projeto.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
}
```

**Não procure por `GOOGLE_PRIVATE_KEY` no console do Google — não existe.** Esse
é o nome da variável aqui no projeto; o valor dela é o conteúdo do campo
`private_key` deste JSON. O mesmo vale para `GOOGLE_SERVICE_ACCOUNT_EMAIL`, que
recebe o `client_email`.

Para não errar no recorte:

```
node scripts/chave-service-account.js ~/Downloads/projeto-abc123.json
```

Ele imprime os dois valores prontos para colar e testa a chave antes — se ela
não assinar aqui, também não assinaria no Vercel, e é melhor descobrir agora do
que depois do deploy.

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

Sobre a chave: `lib/sheets.js` normaliza o recorte antes de usar, então todos
estes chegam funcionando — com `\n` literais (o valor cru do JSON), com quebras
de linha de verdade, com as aspas do JSON em volta, achatada numa linha só, com
CRLF do Windows ou com espaço sobrando nas pontas.

O que continua não funcionando é colar **só um pedaço** da chave. Se acontecer,
o erro diz se o valor nem parece um PEM ou se está cortado no meio.

> Se a produção devolver `error:1E08010C:DECODER routines::unsupported` sem mais
> nada, é a versão antiga do código: ela só aceitava dois dos recortes acima.
> Recolar a chave sem as aspas resolve na hora; publicar esta versão resolve de
> vez.

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

## A planilha do Respondi (LP)

Vale o mesmo caminho, com uma diferença que muda quem executa: a planilha é do
cliente — dona é `bruno@sevilhaperformance.com.br`. Quem compartilha com a
conta de serviço é ele, ou alguém com permissão de compartilhar.

Aqui o motivo principal não é aba faltando (a integração do Respondi cria uma
aba só). É que a leitura por CSV **exige que a planilha continue aberta a quem
tem o link** — e dentro dela estão nome, e-mail e telefone de mais de mil
leads. Qualquer pessoa com o endereço lê tudo. Compartilhar com a conta de
serviço é o que permite fechar o acesso público sem parar o dashboard nem o
LeadQualificado.

O código tenta a conta de serviço primeiro e cai para o CSV se ela não
alcançar, então dá para fazer na ordem confortável:

1. compartilhar a planilha com o `client_email` como **Leitor**;
2. conferir com `node scripts/verificar-planilha.js` — a seção do Respondi
   passa a dizer `modo ... Service Account`;
3. só então trocar o acesso geral da planilha de "qualquer pessoa com o link"
   para "restrito".

Enquanto o passo 1 não acontece, a leitura segue pelo CSV e o log avisa a cada
execução. Se o passo 3 for feito antes do 1, a leitura de LP para.

`LEADS_SHEET_LP_GID` também aceita lista de gids, para o caso de a planilha
ganhar uma segunda aba algum dia.

## Enquanto não trocar

O modo CSV continua funcionando, e desde a correção `LEADS_SHEET_GID_FORMS`
aceita vários gids separados por vírgula. Para voltar a ler tudo hoje, pegue o
gid da aba "Leads Forms" — clique nela e olhe o fim da URL, depois de `#gid=`:

```
LEADS_SHEET_GID_FORMS=<gid da "Leads Forms">,1331027312
```

Isso resolve o presente. A próxima aba vai precisar do mesmo cuidado — que é o
motivo de o caminho acima existir.
