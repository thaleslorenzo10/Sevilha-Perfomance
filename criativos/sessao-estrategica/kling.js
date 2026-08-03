#!/usr/bin/env node
/**
 * CLI da API do Kling — imagem e vídeo.
 *
 *   node kling.js image        --prompt "..." --aspect-ratio 3:4 --out ./plate.png
 *   node kling.js image2video  --image ./plate.png --prompt "..." --out ./out.mp4
 *   node kling.js text2video   --prompt "..." --aspect-ratio 9:16 --out ./out.mp4
 *
 * Credenciais — duas formas, nessa ordem de prioridade:
 *   KLING_API_KEY                      chave única, enviada como Bearer
 *   KLING_ACCESS_KEY + KLING_SECRET_KEY  par AK/SK, assinado em JWT HS256
 *
 * Opcional:
 *   KLING_BASE_URL   padrão https://api-singapore.klingai.com
 *
 * Sem dependências — Node 20+.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.KLING_BASE_URL || 'https://api-singapore.klingai.com';

// Prompt negativo dos criativos da Sessão Estratégica.
//
// `text` e `letters` entram de propósito: o plate tem que sair limpo, porque a
// tipografia é composta depois (compor.py). Modelo generativo não renderiza a
// headline condensada em PT-BR de forma confiável.
//
// `hands` NUNCA entra: citar mãos no negativo é armadilha de atenção e faz o
// modelo inserir mãos fotorrealistas no quadro.
const NEGATIVE_PROMPT = [
  'text', 'letters', 'words', 'watermark', 'logo', 'subtitles', 'extra text',
  'morphing', 'scene change', 'camera whip', 'face distortion', 'extra fingers',
  'letterboxing', 'style drift', 'blurry', 'low quality', 'cartoon', 'illustration',
].join(', ');

const DEFAULTS = {
  image: { model_name: 'kling-v2', n: 1, aspect_ratio: '3:4' },
  video: { model_name: 'kling-v2-6', mode: 'pro', duration: '5', cfg_scale: 0.5 },
};

// Kling entrega 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9 — não tem 4:5.
// Para feed do Meta: gere em 3:4 e recorte para 1080x1350 na composição.
const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'];

// ── auth ────────────────────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function authToken() {
  if (process.env.KLING_API_KEY) return process.env.KLING_API_KEY;

  const { KLING_ACCESS_KEY: ak, KLING_SECRET_KEY: sk } = process.env;
  if (!ak || !sk) {
    throw new Error('Defina KLING_API_KEY, ou KLING_ACCESS_KEY + KLING_SECRET_KEY.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 }));
  const sig = b64url(crypto.createHmac('sha256', sk).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

// ── http ────────────────────────────────────────────────────────────────────
async function call(method, endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Resposta não-JSON do Kling (${res.status}): ${text.slice(0, 400)}`);
  }
  // O Kling devolve HTTP 200 com code != 0 em erro de negócio — checar os dois.
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(`Kling ${res.status} code=${json.code}: ${json.message || text.slice(0, 400)}`);
  }
  return json;
}

// Imagem de referência: URL pública ou base64 puro (sem o prefixo data:).
function readImage(ref) {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (!fs.existsSync(ref)) throw new Error(`Imagem não encontrada: ${ref}`);
  return fs.readFileSync(ref).toString('base64');
}

async function poll(endpoint, taskId, { intervalMs = 8000, timeoutMs = 900000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    const { data } = await call('GET', `${endpoint}/${taskId}`);
    if (data.task_status !== last) {
      last = data.task_status;
      console.log(`  status: ${last}`);
    }
    if (data.task_status === 'succeed') {
      const assets = data.task_result?.images || data.task_result?.videos || [];
      if (!assets.length) throw new Error('Task concluída sem asset no resultado.');
      return assets;
    }
    if (data.task_status === 'failed') {
      throw new Error(`Geração falhou: ${data.task_status_msg || 'sem detalhe'}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout aguardando a task ${taskId}.`);
}

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou (${res.status}).`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// ── cli ─────────────────────────────────────────────────────────────────────
const USAGE = `Uso: node kling.js <image|image2video|text2video> [opções]

  --prompt <texto>          prompt
  --prompt-file <arquivo>   lê o prompt de um arquivo
  --out <arquivo>           onde salvar (.png para image, .mp4 para vídeo)
  --model <nome>            padrão kling-v2 (image) / kling-v2-6 (vídeo)
  --aspect-ratio <r>        ${ASPECT_RATIOS.join(' | ')}

  image:
  --n <1-9>                 quantas variações gerar (padrão 1)
  --ref <arquivo|url>       imagem de referência
  --ref-type <subject|face> o que herdar da referência (padrão subject)
  --fidelity <0-1>          aderência à referência (padrão 0.5)

  image2video / text2video:
  --image <arquivo|url>     frame inicial (obrigatório no image2video)
  --mode <std|pro>          padrão pro
  --duration <5|10>         padrão 5`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '').replace(/-/g, '_')] = argv[i + 1];
  }
  return args;
}

async function main() {
  const [kind, ...rest] = process.argv.slice(2);
  if (!['image', 'image2video', 'text2video'].includes(kind)) {
    console.error(USAGE);
    process.exit(1);
  }

  const args = parseArgs(rest);
  const prompt = args.prompt_file ? fs.readFileSync(args.prompt_file, 'utf8').trim() : args.prompt;
  if (!prompt) throw new Error('Informe --prompt ou --prompt-file.');
  if (prompt.length > 2500) throw new Error(`Prompt com ${prompt.length} caracteres (máx. 2500).`);
  if (args.aspect_ratio && !ASPECT_RATIOS.includes(args.aspect_ratio)) {
    throw new Error(`aspect_ratio inválido: ${args.aspect_ratio}. Use ${ASPECT_RATIOS.join(', ')}.`);
  }

  const isImage = kind === 'image';
  const endpoint = isImage ? '/v1/images/generations' : `/v1/videos/${kind}`;
  const body = { prompt, negative_prompt: NEGATIVE_PROMPT };

  if (isImage) {
    Object.assign(body, DEFAULTS.image, {
      model_name: args.model || DEFAULTS.image.model_name,
      n: Number(args.n || DEFAULTS.image.n),
      aspect_ratio: args.aspect_ratio || DEFAULTS.image.aspect_ratio,
    });
    if (args.ref) {
      body.image = readImage(args.ref);
      body.image_reference = args.ref_type || 'subject';
      body.image_fidelity = Number(args.fidelity ?? 0.5);
    }
  } else {
    Object.assign(body, DEFAULTS.video, {
      model_name: args.model || DEFAULTS.video.model_name,
      mode: args.mode || DEFAULTS.video.mode,
      duration: args.duration || DEFAULTS.video.duration,
    });
    if (kind === 'image2video') {
      if (!args.image) throw new Error('image2video exige --image.');
      // A proporção do vídeo vem da imagem: gere o plate já no formato final.
      body.image = readImage(args.image);
    } else {
      body.aspect_ratio = args.aspect_ratio || '9:16';
    }
  }

  console.log(`Enviando task ${kind} (${body.model_name})…`);
  const { data } = await call('POST', endpoint, body);
  console.log(`  task_id: ${data.task_id}`);

  const assets = await poll(endpoint, data.task_id);
  const out = args.out || `./out/${kind}-${data.task_id}${isImage ? '.png' : '.mp4'}`;
  const ext = path.extname(out);
  const stem = out.slice(0, -ext.length);

  for (const [i, asset] of assets.entries()) {
    const dest = assets.length > 1 ? `${stem}-${i + 1}${ext}` : out;
    await download(asset.url, dest);
    console.log(`Pronto: ${dest}`);
  }

  if (!isImage) console.log('QC obrigatório: assista os últimos 2 segundos antes de subir.');
}

main().catch((err) => {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
});
