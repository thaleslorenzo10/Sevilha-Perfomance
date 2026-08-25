'use strict';

/**
 * Teste de lib/geo.js (node scripts/test-geo.js).
 *
 * Roda offline: o `fetch` é substituído. O que interessa aqui não é a MaxMind
 * responder — é o que acontece quando ela não responde, responde errado ou
 * responde impreciso demais para valer alguma coisa.
 */

process.env.MAXMIND_ACCOUNT_ID = '123456';
process.env.MAXMIND_LICENSE_KEY = 'chave-de-teste';

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

const RESPOSTA = {
  city:         { names: { en: 'Belo Horizonte', 'pt-BR': 'Belo Horizonte' } },
  subdivisions: [{ iso_code: 'MG' }],
  postal:       { code: '30110' },
  country:      { iso_code: 'BR' },
  location:     { accuracy_radius: 20 },
  traits:       { autonomous_system_organization: 'Claro NXT Telecomunicacoes Ltda' },
};

let chamadas = 0;
let proxima  = { ok: true, status: 200, corpo: RESPOSTA };

let ultimaUrl = '';
global.fetch = async (url) => {
  ultimaUrl = String(url);
  chamadas++;
  if (proxima.lanca) throw Object.assign(new Error('abortado'), { name: 'TimeoutError' });
  return { ok: proxima.ok, status: proxima.status, json: async () => proxima.corpo };
};

// Só depois de plantar o fetch, para o módulo não capturar o original.
const { localizarPorIp, ehPublico } = require('../lib/geo');

(async () => {
  console.log('— IP que não vale consulta —');
  chamadas = 0;
  ok(await localizarPorIp('192.168.0.10') === null, 'rede privada não é consultada');
  ok(await localizarPorIp('127.0.0.1')    === null, 'localhost não é consultado');
  ok(await localizarPorIp('')             === null, 'IP vazio não é consultado');
  ok(chamadas === 0, 'nenhuma consulta gasta com IP não roteável', chamadas);
  ok(ehPublico('200.150.10.1') === true, 'IP público é reconhecido');

  console.log('\n— resposta boa —');
  const geo = await localizarPorIp('200.150.10.1');
  ok(geo?.cidade === 'Belo Horizonte', 'cidade lida', geo);
  ok(geo?.estado === 'MG',             'estado pela sigla ISO 3166-2', geo);
  ok(geo?.cep    === '30110',          'CEP lido', geo);
  ok(geo?.pais   === 'br',             'país em minúsculo, como o CAPI espera', geo);
  ok(geo?.asn === 'Claro NXT Telecomunicacoes Ltda', 'operadora lida (não vai para a Meta)', geo);

  ok(ultimaUrl.startsWith('https://geolite.info/geoip/v2.1/city/'),
     'consulta vai ao host do GeoLite2, não ao do serviço pago', ultimaUrl);

  console.log('\n— cache —');
  const antes = chamadas;
  await localizarPorIp('200.150.10.1');
  ok(chamadas === antes, 'segunda consulta do mesmo IP não gasta chamada paga', chamadas);

  console.log('\n— precisão insuficiente —');
  proxima = { ok: true, status: 200, corpo: { ...RESPOSTA, location: { accuracy_radius: 500 } } };
  ok(await localizarPorIp('200.150.10.2') === null,
     'raio acima do limite é descartado em vez de virar palpite');

  console.log('\n— falhas não podem derrubar o lead —');
  proxima = { ok: false, status: 404, corpo: { code: 'IP_ADDRESS_NOT_FOUND' } };
  ok(await localizarPorIp('200.150.10.3') === null, 'IP fora da base devolve null');

  proxima = { ok: false, status: 401, corpo: { code: 'AUTHORIZATION_INVALID', error: 'x' } };
  ok(await localizarPorIp('200.150.10.4') === null, 'credencial inválida devolve null (e loga)');

  proxima = { lanca: true };
  ok(await localizarPorIp('200.150.10.5') === null, 'timeout devolve null');

  console.log('\n— sem credencial não há consulta —');
  delete process.env.MAXMIND_ACCOUNT_ID;
  const antesSemChave = chamadas;
  ok(await localizarPorIp('200.150.10.6') === null, 'sem credencial devolve null');
  ok(chamadas === antesSemChave, 'e não chega a chamar a MaxMind', chamadas);

  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
  process.exit(falhas ? 1 : 0);
})();
