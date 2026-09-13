'use strict';

/**
 * Chave comum de posicionamento entre o lado do lead — utm_source={{placement}}
 * ("Instagram_Stories") ou a coluna platform do export ("ig"/"fb") — e o lado
 * do gasto — breakdown publisher_platform + platform_position do Meta
 * ("instagram" + "instagram_stories"). Sem isto a tabela "Fonte" da aba Origem
 * teria gasto numa linha e lead em outra com o mesmo significado.
 *
 * ponytail: heurística por prefixo. Posição que o Meta nomeia diferente do
 * macro vira linha própria em vez de sumir; refinar o mapa quando aparecer.
 */

const { norm } = require('./texto');

const PLATAFORMAS = {
  instagram: 'instagram', ig: 'instagram',
  facebook: 'facebook', fb: 'facebook',
  messenger: 'messenger', msg: 'messenger',
  audience: 'audience_network', audience_network: 'audience_network', an: 'audience_network',
};
const RE_PREFIXO = /^(instagram|facebook|messenger|audience_network|an|ig|fb)_/;
const RE_DISPOSITIVO = /^(mobile|desktop)_/;

function chavePosicionamento(plataforma, posicao) {
  const p = norm(plataforma).replace(/[\s-]+/g, '_');
  const plat = PLATAFORMAS[p] || PLATAFORMAS[p.split('_')[0]] || (p || 'desconhecido');
  let pos = norm(posicao).replace(/[\s-]+/g, '_').replace(RE_PREFIXO, '').replace(RE_DISPOSITIVO, '');
  if (!pos) pos = 'geral';
  return `${plat}:${pos}`;
}

/** "Instagram_Stories" → 'instagram:stories'; "ig" → 'instagram:geral'; vazio → null. */
function chaveDoMacro(valor) {
  const s = String(valor || '').trim();
  if (!s) return null;
  // Normaliza e trata plataformas de dois tokens (Audience_Network).
  const normalized = norm(s).replace(/[\s-]+/g, '_');
  const tokens = normalized.split('_');
  let plat, pos;
  // Tenta dois tokens se houver.
  if (tokens.length >= 2 && PLATAFORMAS[tokens[0] + '_' + tokens[1]]) {
    plat = tokens[0] + '_' + tokens[1];
    pos = tokens.slice(2).join('_');
  } else {
    // Fallback: um token.
    plat = tokens[0];
    pos = tokens.slice(1).join('_');
  }
  return chavePosicionamento(plat, pos);
}

module.exports = { chavePosicionamento, chaveDoMacro };
