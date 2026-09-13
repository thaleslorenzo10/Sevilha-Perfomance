'use strict';

/**
 * Fuso único do painel: -03:00 (Brasília, sem horário de verão desde 2019).
 * O banco grava em UTC, o Meta responde no fuso da conta e a planilha grava a
 * data como texto. Toda pergunta "isso foi em que dia?" passa por aqui — antes
 * havia uma cópia de FUSO em api/stats.js e outra em lib/sessao-estrategica.js,
 * e o eixo do Meta era montado em UTC.
 */

const FUSO = '-03:00';
const OFFSET_MS = -3 * 60 * 60 * 1000;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' em -03:00 para uma Date ou string ISO. Data pura passa intacta. */
function diaDe(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const s = String(valor).trim();
  if (RE_DIA.test(s)) return s;
  const d = valor instanceof Date ? valor : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

function inicioDoDia(dia) { return `${dia}T00:00:00${FUSO}`; }
function fimDoDia(dia)    { return `${dia}T23:59:59${FUSO}`; }

/** Todos os dias de since a until, inclusive. Teto de 400 para intervalo absurdo. */
function cadaDia(since, until) {
  const dias = [];
  const cur = new Date(`${since}T00:00:00Z`);
  const fim = new Date(`${until}T00:00:00Z`);
  for (let i = 0; cur <= fim && i < 400; i++) {
    dias.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
}

function deslocarDias(dia, n) {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Período imediatamente anterior, com o mesmo número de dias. */
function periodoAnterior(since, until) {
  const n = cadaDia(since, until).length;
  return { since: deslocarDias(since, -n), until: deslocarDias(since, -1) };
}

module.exports = { FUSO, diaDe, inicioDoDia, fimDoDia, cadaDia, deslocarDias, periodoAnterior };
