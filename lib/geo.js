'use strict';

/**
 * Localização aproximada a partir do IP, pela MaxMind (GeoIP2 Precision City).
 *
 * Serve para preencher `ct`, `st` e `zp` do user_data do CAPI em eventos que
 * têm o IP de quem converteu. Duas ressalvas que decidem se isso ajuda ou
 * atrapalha, e por isso estão em código e não só em documentação:
 *
 * 1. A Meta já recebe `client_ip_address` e geolocaliza por conta própria. O
 *    ganho real destes campos está nos eventos que saem DEPOIS, sem IP nenhum
 *    (CRM, varredura): por isso o resultado é gravado no lead e reaproveitado.
 *
 * 2. Operadora móvel roteia por poucos gateways — o IP de um lead do interior
 *    resolve na capital. Hash de cidade errada nunca casa com ninguém e ainda
 *    conta como parâmetro enviado, o que faz a nota de correspondência subir
 *    sem a correspondência melhorar. Daí o corte por `accuracy_radius`: abaixo
 *    de uma precisão mínima a resposta é descartada em vez de virar palpite.
 *
 * Nada aqui pode derrubar o lead: erro, timeout e falta de credencial devolvem
 * `null` e o evento segue sem os campos.
 */

const ENDPOINT = 'https://geoip.maxmind.com/geoip/v2.1/city/';

// Acima disto a resposta é "algum lugar nesta região" e não identifica ninguém.
// Ajuste pelo que a medição mostrar (scripts/geo-dispersao.js), não pelo gosto.
const RAIO_MAX_KM_PADRAO = 100;

const TIMEOUT_MS = 1500;

// Cache por instância da função. Duas submissões do mesmo IP (retry do
// formulário, casal no mesmo escritório) não pagam duas consultas — a MaxMind
// cobra por consulta. ponytail: Map simples com teto; se um dia precisar
// sobreviver entre instâncias, é Supabase, não estrutura mais esperta aqui.
const cache = new Map();
const CACHE_MAX = 500;

/** IP privado, reservado ou local não tem localização — nem gasta consulta. */
function ehPublico(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const v = ip.trim();
  if (!v || v === '::1' || v === '127.0.0.1') return false;
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(v)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return false;
  if (/^(fc|fd|fe80)/i.test(v)) return false;
  return true;
}

/**
 * Devolve `{ cidade, estado, cep, pais, raioKm }` ou `null`.
 *
 * Os nomes vêm no locale que a MaxMind tiver; `en` é o único garantido. A
 * normalização para o hash (minúsculo, sem espaço, sem pontuação) é feita em
 * lib/capi.js — aqui sai o valor legível, que é o que vale a pena guardar.
 */
async function localizarPorIp(ip) {
  const conta  = process.env.MAXMIND_ACCOUNT_ID;
  const chave  = process.env.MAXMIND_LICENSE_KEY;
  if (!conta || !chave) return null;
  if (!ehPublico(ip)) return null;

  if (cache.has(ip)) return cache.get(ip);

  const raioMax = Number(process.env.MAXMIND_RAIO_MAX_KM || RAIO_MAX_KM_PADRAO);
  const auth = Buffer.from(`${conta}:${chave}`).toString('base64');

  let resultado = null;
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(ip), {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await res.json();

    if (!res.ok) {
      // IP fora da base e IP reservado são rotina, não defeito de configuração.
      // Credencial e crédito não são — esses precisam aparecer no log.
      const codigo = json?.code || `HTTP ${res.status}`;
      const rotina = codigo === 'IP_ADDRESS_NOT_FOUND' || codigo === 'IP_ADDRESS_RESERVED';
      if (!rotina) console.error(`[geo] MaxMind recusou — ${codigo}: ${json?.error || ''}`);
      return guardar(ip, null);
    }

    const raioKm = json?.location?.accuracy_radius ?? null;
    if (raioKm !== null && raioKm > raioMax) {
      console.log(`[geo] descartado — raio de ${raioKm}km acima do limite de ${raioMax}km`);
      return guardar(ip, null);
    }

    const nomes = json?.city?.names || {};
    resultado = {
      cidade: nomes['pt-BR'] || nomes.en || null,
      estado: json?.subdivisions?.[0]?.iso_code || null,
      cep:    json?.postal?.code || null,
      pais:   json?.country?.iso_code ? String(json.country.iso_code).toLowerCase() : null,
      raioKm,
    };
    // Resposta sem nenhum dos três campos não vale guardar como localização.
    if (!resultado.cidade && !resultado.estado && !resultado.cep) resultado = null;
  } catch (err) {
    console.warn(`[geo] consulta falhou (${err.name === 'TimeoutError' ? 'timeout' : err.message}) — evento segue sem localização`);
    resultado = null;
  }

  return guardar(ip, resultado);
}

function guardar(ip, valor) {
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(ip, valor);
  return valor;
}

module.exports = { localizarPorIp, ehPublico, RAIO_MAX_KM_PADRAO };
