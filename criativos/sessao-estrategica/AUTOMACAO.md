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
GET /api/compor              catálogo: peças + prompt de plate de cada uma
   ↓
Code: sortear peça           rotação automática, sem lista para manter
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
| Google Drive | OAuth2 | Já foi atribuída automaticamente |

### 3. Placeholders nos nós

- URL do serviço, em três nós: `https://SEU-DOMINIO.vercel.app/api/compor`
- URL da Evolution, em dois nós: `https://SUA-EVOLUTION/message/sendMedia/SUA-INSTANCIA`
  e `.../sendText/SUA-INSTANCIA`

### 4. Variável do workflow

```
GRUPO_CRIATIVOS = <id do grupo>@g.us
```

O id do grupo termina em `@g.us` — é diferente de número de telefone. Pega em
`GET /group/fetchAllGroups/<instancia>` na Evolution.

### 5. Ativar

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
