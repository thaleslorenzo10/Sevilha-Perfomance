# Automação — criativo semanal no n8n

Workflow: **[SEVILHA] Criativos semanais - Sessão Estratégica**
`https://n8neditor.lorenzomedia.space/workflow/OgAORXEWgYPM6PCa`

Toda segunda 8h: sorteia uma peça, gera o plate no Kling, compõe a tipografia,
salva no Drive e manda no grupo do WhatsApp. **Para aí.** Ninguém publica nada
sem alguém olhar.

## Por que para na aprovação

Na sessão em que estas peças foram criadas, o aproveitamento foi perto de 1 em 4.
Foram reprovados: plate com texto embaralhado, headline atravessando a ampulheta,
cadeira que sumiu no recorte, metáfora de margem que não comunicava e três rostos
que não eram o Vicente. Automação que publica sozinha subiria os quatro.

## Desenho

```
Schedule (seg 8h)
   ↓
Acervo do Meta               copy de anúncios vizinhos (opcional — ver abaixo)
   ↓
GET /api/compor              fatos da oferta + eixos visuais + layouts
   ↓
Data Table: histórico        as 12 últimas peças, com ângulo e eixos usados
   ↓
Code: montar briefing        junta as três fontes
   ↓
Claude: escrever conceito    headline, subhead, layout e prompt de plate INÉDITOS
   ↓
Precisa de plate?
   ├─ sim  → Kling images/generations → espera 90s → consulta task
   │           ├─ succeed → POST /api/compor (plate_url) → PNG
   │           └─ falhou  → avisa no grupo e encerra
   └─ não  → POST /api/compor (nativo) → PNG      (não passa pelo Kling)
   ↓
Drive: sobe na pasta de criativos
   ↓
Evolution: manda a imagem no grupo com o checklist de revisão
```

Data Table: registrar        para a próxima execução não repetir

## Por que ele deixou de repetir

A primeira versão sorteava entre 9 prompts fixos. Aleatório não é novo: era o
mesmo anúncio com outra semente.

Pior, os 9 prompts repetiam a mesma fórmula — objeto à direita, spotlight de
cima, dois terços escuros à esquerda — trocando só o substantivo. Era essa a
causa da mesmice visual, não o modelo.

Agora são três mudanças que só funcionam juntas:

**Eixos.** `EIXOS` no `compor.py` quebra a composição em enquadramento (6), luz
(6) e meio (5). São 180 combinações onde havia uma.

**Layouts.** São cinco no briefing (`compor`, `oferta`, `antes-depois`,
`blocos`, `nativo`), não um. `blocos` entrou com a ref F e é o mais diferente
dos outros: blocos opacos empilhados e corpo em monoespaçada, sem scrim.

**Gerador.** Um nó do Claude escreve headline, subhead, layout e prompt de plate
a cada execução, em vez de escolher de uma lista.

**Memória.** A tabela `Sevilha — histórico de criativos` guarda ângulo e eixos de
cada peça. O gerador recebe as 12 últimas e é instruído a não repetir nenhuma.
Sem a memória, o gerador voltaria a convergir sozinho.

## O Acervo do Meta é opcional de propósito

O nó consulta `ads_archive` procurando anúncios de "sessão estratégica" no
Brasil, para dar ao gerador ângulos de nichos vizinhos. **Esse endpoint pode
recusar o token** — o acesso do Acervo a anúncios não-políticos é restrito.

Por isso o nó está com `onError: continueRegularOutput` e o Code node trata a
ausência. Se a API recusar, o fluxo segue com os fatos e o histórico, e a única
perda é ângulo externo.

Do Acervo vem **ângulo e estrutura de argumento, nunca frase literal nem claim
de concorrente** — está escrito na regra 7 do prompt do gerador.

## Travas contra o que a máquina inventa

Ficam no serviço, não só no prompt, porque prompt se ignora:

- **Headline acima de 17 caracteres por linha é recusada.** Sem isso o autofit
  encolheria o corpo até a peça perder o soco, e a arte sairia "funcionando".
- **Âncora de preço "de/por" é recusada sempre.** Não existe preço praticado
  para a Sessão Estratégica; anunciar um seria propaganda enganosa.
- **Item de checklist que afirma duração ou entregável é recusado.** No layout
  `blocos` cada linha do checklist é um claim publicado, e duração da sessão,
  entregável e quem conduz ainda são `[SLOT]`. O gerador preenche esses buracos
  sozinho se deixarem — "60 minutos", "plano de ação em PDF".

Nos três casos o serviço devolve 400 com o motivo, e o gerador pode reescrever.

Os quatro formatos nativos pulam o Kling inteiro — a UI é desenhada, não gerada.
São mais baratos e não têm o risco de texto embaralhado.

## Por que existe o serviço em `api/compor.py`

A tipografia das peças é desenhada em Pillow. O Code node do n8n é JavaScript e
não tem PIL. Então o n8n orquestra e chama o endpoint para a única etapa que
precisa de Python.

O endpoint também serve o catálogo (`GET`), para o workflow não guardar cópia dos
prompts: prompt editado neste repositório vale na automação sem mexer no n8n.

Os parâmetros de recorte de cada peça vivem em `PRESETS`, no `compor.py` — a
automação pede a peça, não a geometria.

## Antes de tudo: publicar o serviço

`api/compor.py` está na branch `claude/sevilha-ad-prompt-kling-3a6rc4`. A Vercel só
publica em produção o que está na branch de produção — enquanto não houver merge,
`https://sevilha-perfomance.vercel.app/api/compor` responde 404 e todo o resto do
fluxo falha no primeiro nó.

Merge, ou apontar os três nós para a URL de preview da branch.

## O que falta configurar

### 1. Variável de ambiente na Vercel

```
COMPOR_TOKEN=<gere um token aleatório longo>
```

O endpoint **falha fechado**: sem a variável, responde 401 para tudo. Depois de
salvar, é preciso redeploy — variável nova só vale para deploy feito depois.

### 2. Credenciais no n8n

| Credencial | Tipo | Conteúdo |
|---|---|---|
| `Compor Sevilha (x-compor-token)` | Header Auth | Nome `x-compor-token`, valor = `COMPOR_TOKEN` |
| `Kling API (Authorization Bearer)` | Header Auth | Nome `Authorization`, valor `Bearer <KLING_API_KEY>` |
| `Evolution API (apikey)` | Header Auth | Nome `apikey`, valor da sua instância |
| `Meta Graph (Authorization Bearer)` | Header Auth | Nome `Authorization`, valor `Bearer <META_ACCESS_TOKEN>` — só para o Acervo, opcional |
| Anthropic | API key | Do nó `Claude`. Já estava na instância e foi religada sozinha |
| Google Drive | OAuth2 | Selecionar no nó `Subir no Drive` |

**Toda atualização do workflow pela API derruba as credenciais dos nós de HTTP.**
Não é bug da instância: o SDK recria os nós e o auto-assign pula Header Auth de
propósito, porque existem várias e ele não tem como adivinhar qual. Depois de
qualquer mudança estrutural, são 9 cliques de reconexão.

### 3. URLs — já preenchidas

| Nó | URL |
|---|---|
| Catálogo, Compor (x2) | `https://sevilha-perfomance.vercel.app/api/compor` |
| Evolution — enviar criativo | `https://lm-evolution-api.dfp2bq.easypanel.host/message/sendMedia/teste` |
| Evolution — avisar falha | `https://lm-evolution-api.dfp2bq.easypanel.host/message/sendText/teste` |

Note que a URL da Evolution **não leva `/manager/`**. Aquele caminho é a interface
de administração; a API responde na raiz do host.

### 4. Destino do envio — já preenchido

Fica na primeira linha do nó `Sortear peca da semana`:

```javascript
const DESTINO = '5521996842535';
```

Número solto é conversa 1:1 — modo teste. Para mandar no grupo, troque por
`<id-do-grupo>@g.us`. O id sai de `GET /group/fetchAllGroups/teste` na Evolution
e é diferente de número de telefone. Só essa linha muda.

Não usei `$vars` de propósito: variáveis de instância no n8n são recurso pago, e
o fluxo quebraria silenciosamente se não estivesse disponível.

### 5. Reconferir a credencial do Google Drive

A atualização do workflow recriou os nós e a credencial do Drive saiu junto.
Abrir o nó `Subir no Drive` e reselecionar a conta.

### 6. Ativar

O workflow nasce desativado, de propósito. Rode manualmente uma vez antes.

## Riscos que valem estar escritos

**Evolution API é não-oficial.** A Cloud API da Meta não envia para grupo — só
1:1. Evolution roda um WhatsApp Web headless, o que significa que o número pode
ser banido. Use um número dedicado, nunca o comercial principal.

**Marcação de IA.** Todo criativo que sair daqui é gerado por IA. Meta e TikTok
exigem a marcação na subida — a automação não faz isso por você.

**Conceito 1.** A pessoa da peça é sintética e não é o Vicente. Se ele cair no
sorteio, a regra de não nomear ninguém continua valendo.

## Custo por execução

Uma peça por semana: uma geração de imagem no Kling (n=1) + uma invocação
serverless. Os formatos nativos não gastam Kling. Ordem de grandeza: centavos.
Se quiser mais variação, subir `n` no nó do Kling multiplica só essa parte.
