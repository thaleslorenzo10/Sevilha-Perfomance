'use strict';

/**
 * Trava de reenvio dos eventos de conversão enviados em lote.
 *
 * O envio do formulário nativo do Meta é feito por varredura diária da
 * planilha, então o mesmo lead reaparece em toda execução. A janela de
 * deduplicação do Meta é de 48h — depois disso um reenvio vira conversão
 * duplicada e infla o relatório. Guardar o que já foi enviado é o que torna a
 * varredura idempotente de verdade.
 *
 * Falha de leitura ou de escrita interrompe o processo em vez de seguir: sem a
 * trava, "seguir mesmo assim" significa duplicar evento.
 *
 * Tabela (projeto Lorenzo Media, convenção <cliente>_<dominio>):
 *   sevilha_eventos_enviados(event_id text primary key, evento text,
 *                            fonte text, enviado_em timestamptz)
 */

const TABELA = 'sevilha_eventos_enviados';

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios para a trava de reenvio');
  }
  return {
    base: `${url}/rest/v1/${TABELA}`,
    headers: {
      'Content-Type':  'application/json',
      apikey:          key,
      Authorization:   `Bearer ${key}`,
    },
  };
}

/** Dos ids informados, quais já foram enviados. */
async function jaEnviados(eventIds) {
  const ids = [...new Set(eventIds)].filter(Boolean);
  if (!ids.length) return new Set();

  const { base, headers } = config();
  const lista = ids.map(id => `"${id.replace(/"/g, '')}"`).join(',');
  const url   = `${base}?select=event_id&event_id=in.(${encodeURIComponent(lista)})`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ao ler ${TABELA}: ${await res.text()}`);
  }
  return new Set((await res.json()).map(r => r.event_id));
}

/**
 * Registra os enviados. `on_conflict` com `ignore-duplicates` evita que duas
 * execuções simultâneas derrubem uma à outra por chave repetida.
 */
async function marcarEnviados(registros) {
  if (!registros.length) return;

  const { base, headers } = config();
  const res = await fetch(`${base}?on_conflict=event_id`, {
    method:  'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body:    JSON.stringify(registros),
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ao gravar em ${TABELA}: ${await res.text()}`);
  }
}

module.exports = { jaEnviados, marcarEnviados, TABELA };
