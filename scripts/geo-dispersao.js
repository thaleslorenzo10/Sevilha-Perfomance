'use strict';

/**
 * Mede se a localização por IP está valendo alguma coisa
 * (node scripts/geo-dispersao.js).
 *
 * Não existe verdade contra a qual comparar: nenhum formulário pergunta a
 * cidade. O que dá para medir é a assinatura do problema. IP de operadora móvel
 * resolve no gateway, e gateway é concentrado — então, se a distribuição de
 * cidades for muito mais concentrada do que a dos seus leads de verdade, o que
 * está sendo enviado à Meta é o mapa da rede da operadora, não o dos clientes.
 *
 * O que olhar:
 *   • cobertura baixa → paga-se consulta e não se manda campo
 *   • uma cidade com fatia grande demais → assinatura de gateway
 *   • raio mediano alto → aperte MAXMIND_RAIO_MAX_KM
 */

const { conexao, TABELAS } = require('../lib/supabase');

const DIAS = Number(process.argv[2] || 30);

(async () => {
  const c = conexao();
  if (!c) {
    console.error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios.');
    process.exit(1);
  }

  const desde = new Date(Date.now() - DIAS * 864e5).toISOString();
  const res = await fetch(
    `${c.url}/rest/v1/${TABELAS.leads}` +
    `?select=geo_cidade,geo_estado,geo_cep,geo_raio_km,created_at` +
    `&created_at=gte.${desde}&order=created_at.desc&limit=5000`,
    { headers: c.headers }
  );
  if (!res.ok) {
    console.error('Supabase respondeu', res.status, await res.text());
    process.exit(1);
  }

  const linhas = await res.json();
  if (!linhas.length) {
    console.log(`Nenhum lead nos últimos ${DIAS} dias.`);
    return;
  }

  const comCidade = linhas.filter(l => l.geo_cidade);
  const cobertura = (comCidade.length / linhas.length) * 100;

  const porCidade = new Map();
  for (const l of comCidade) {
    const chave = `${l.geo_cidade}/${l.geo_estado || '?'}`;
    porCidade.set(chave, (porCidade.get(chave) || 0) + 1);
  }
  const ranking = [...porCidade.entries()].sort((a, b) => b[1] - a[1]);

  const raios = comCidade.map(l => l.geo_raio_km).filter(r => r != null).sort((a, b) => a - b);
  const mediana = raios.length ? raios[Math.floor(raios.length / 2)] : null;

  console.log(`\nÚltimos ${DIAS} dias — ${linhas.length} lead(s)\n`);
  console.log(`Cobertura: ${cobertura.toFixed(1)}% (${comCidade.length} com cidade, ${linhas.length - comCidade.length} sem)`);
  console.log(`Cidades distintas: ${ranking.length}`);
  console.log(`Raio mediano: ${mediana != null ? mediana + ' km' : '—'}`);
  console.log(`Com CEP: ${comCidade.filter(l => l.geo_cep).length}\n`);

  console.log('Cidade                              leads   fatia');
  for (const [cidade, n] of ranking.slice(0, 10)) {
    const fatia = (n / comCidade.length) * 100;
    console.log(`${cidade.padEnd(34)} ${String(n).padStart(6)}  ${fatia.toFixed(1).padStart(5)}%`);
  }

  const maiorFatia = ranking.length ? (ranking[0][1] / comCidade.length) * 100 : 0;
  console.log('');
  if (cobertura < 50)   console.log('⚠  Cobertura baixa: paga-se a consulta e o campo não sai na maior parte dos leads.');
  if (maiorFatia > 40)  console.log(`⚠  ${ranking[0][0]} concentra ${maiorFatia.toFixed(1)}% — assinatura de gateway de operadora, não de clientela.`);
  if (mediana != null && mediana > 50) console.log(`⚠  Raio mediano de ${mediana}km: aperte MAXMIND_RAIO_MAX_KM.`);
  if (cobertura >= 50 && maiorFatia <= 40 && (mediana == null || mediana <= 50)) {
    console.log('Distribuição plausível. Vale manter ligado.');
  }
})();
