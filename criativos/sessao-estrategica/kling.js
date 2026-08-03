#!/usr/bin/env node
/**
 * Gera vídeos de anúncio na API do Kling.
 *
 *   node kling.js image2video --image ./frame.png --prompt "..." --out ./out.mp4
 *   node kling.js text2video  --prompt "..." --aspect-ratio 9:16 --out ./out.mp4
 *
 * Credenciais (painel do Kling → Developer → API keys):
 *   KLING_ACCESS_KEY, KLING_SECRET_KEY
 *
 * Opcional:
 *   KLING_BASE_URL  padrão https://api-singapore.klingai.com
 *
 * Sem dependências — Node 20+.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.KLING_BASE_URL || 'https://api-singapore.klingai.com';

// Prompt negativo padrão dos criativos da Sessão Estratégica. Não inclui "hands":
// citar mãos no negativo faz o modelo inserir mãos fotorrealistas no quadro.
const NEGATIVE_PROMPT = [
  'extra text', 'new text', 'watermark', 'logo change', 'morphing', 'scene change',
  'camera whip', 'face distortion', 'extra fingers', 'subtitles', 'letterboxing',
  'style drift', 'photorealistic render of an illustrated frame', 'blurry', 'low quality',
].join(', ');

const DEFAULTS = {
  model_name: 'kling-v2-6',
  mode: 'pro',
  duration: '5',
  cfg_scale: 0.5,
};

// ── auth ────────────────────────────────────────────────────────────────────
// O Kling autentica com JWT HS256 assinado com a secret key. O token vale 30 min;
// como cada chamada gera um novo, não há cache a invalidar.
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(accessKey, secretKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
  const signature = b64url(
    crypto.createHmac('sha256', secretKey).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

// ── http ────────────────────────────────────────────────────────────────────
async function call(method, endpoint, body) {
  const { KLING_ACCESS_KEY, KLING_SECRET_KEY } = process.env;
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    throw new Error('Faltam KLING_ACCESS_KEY e KLING_SECRET_KEY no ambiente.');
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${makeToken(KLING_ACCESS_KEY, KLING_SECRET_KEY)}`,
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

// A imagem pode ir como URL pública ou base64 puro (sem o prefixo data:).
function readImage(ref) {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (!fs.existsSync(ref)) throw new Error(`Imagem não encontrada: ${ref}`);
  return fs.readFileSync(ref).toString('base64');
}

async function poll(kind, taskId, { intervalMs = 10000, timeoutMs = 900000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    const { data } = await call('GET', `/v1/videos/${kind}/${taskId}`);
    if (data.task_status !== last) {
      last = data.task_status;
      console.log(`  status: ${last}`);
    }
    if (data.task_status === 'succeed') {
      const video = data.task_result?.videos?.[0];
      if (!video?.url) throw new Error('Task concluída sem URL de vídeo.');
      return video;
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
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '').replace(/-/g, '_');
    args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const [kind, ...rest] = process.argv.slice(2);
  if (!['image2video', 'text2video'].includes(kind)) {
    console.error('Uso: node kling.js <image2video|text2video> [opções]\n' +
      '  --prompt <texto>        prompt de movimento\n' +
      '  --prompt-file <arquivo> lê o prompt de um arquivo\n' +
      '  --image <arquivo|url>   frame estático (só image2video)\n' +
      '  --out <arquivo.mp4>     onde salvar\n' +
      '  --model <nome>          padrão kling-v2-6\n' +
      '  --mode <std|pro>        padrão pro\n' +
      '  --duration <5|10>       padrão 5\n' +
      '  --aspect-ratio <16:9|9:16|1:1>  só text2video');
    process.exit(1);
  }

  const args = parseArgs(rest);
  const prompt = args.prompt_file ? fs.readFileSync(args.prompt_file, 'utf8').trim() : args.prompt;
  if (!prompt) throw new Error('Informe --prompt ou --prompt-file.');
  if (prompt.length > 2500) throw new Error(`Prompt com ${prompt.length} caracteres (máx. 2500).`);

  const body = {
    model_name: args.model || DEFAULTS.model_name,
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    mode: args.mode || DEFAULTS.mode,
    duration: args.duration || DEFAULTS.duration,
    cfg_scale: DEFAULTS.cfg_scale,
  };

  if (kind === 'image2video') {
    if (!args.image) throw new Error('image2video exige --image.');
    // A proporção do vídeo vem da imagem: gere o frame já em 4:5 (feed) ou 9:16 (Reels).
    body.image = readImage(args.image);
  } else {
    body.aspect_ratio = args.aspect_ratio || '9:16';
  }

  console.log(`Enviando task ${kind} (${body.model_name}, ${body.mode}, ${body.duration}s)…`);
  const { data } = await call('POST', `/v1/videos/${kind}`, body);
  console.log(`  task_id: ${data.task_id}`);

  const video = await poll(kind, data.task_id);
  const out = args.out || `./out/${kind}-${data.task_id}.mp4`;
  await download(video.url, out);
  console.log(`Pronto: ${out} (${video.duration}s)`);
  console.log('QC obrigatório: assista os últimos 2 segundos antes de subir.');
}

main().catch((err) => {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
});
