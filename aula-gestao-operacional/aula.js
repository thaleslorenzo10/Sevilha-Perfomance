/**
 * /aula-gestao-operacional — tudo que a página lê de window.AULA.
 *
 * Data, horário e noindex (troca de turma sem tocar copy), preço do lote nos
 * cartões e no .trust do modal, e a barra do lote. A barra nunca mostra um
 * número que não seja vendidosFora + vendidos(Kiwify) sobre ingressos: antes
 * da resposta de /api/stats?modo=aula (ou se ela falhar) vale só o
 * vendidosFora do config.
 */
(function () {
  var a = window.AULA || {};
  var lote = a.lote || {};

  function texto(sel, txt) {
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = txt; });
  }
  function brl(centavos) {
    var v = centavos / 100;
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  /* ── Data, horário e noindex ─────────────────────────── */
  if (a.data) {
    var d = new Date(a.data + 'T12:00:00-03:00');
    texto('#aula-data, [data-aula-data]', d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }));
    texto('#aula-hora, [data-aula-hora]', (a.hora || '19:30').replace(':', 'h') + ' (Brasília)');
    var r = document.getElementById('meta-robots'); if (r) r.setAttribute('content', 'index, follow');
  }

  /* ── Preço ───────────────────────────────────────────── */
  if (lote.precoCentavos) {
    texto('[data-preco]', brl(lote.precoCentavos));
    var campo = document.querySelector('input[name="valor_centavos"]');
    if (campo) campo.value = String(lote.precoCentavos);
    if (lote.parcelas > 0) {
      texto('[data-parcelas]', 'ou ' + lote.parcelas + 'x de ' + brl(Math.round(lote.precoCentavos / lote.parcelas)));
      document.querySelectorAll('[data-parcelas]').forEach(function (el) { el.hidden = false; });
    }
  }

  /* ── Barra do lote ───────────────────────────────────── */
  var vendidosKiwify = 0;

  function pintar() {
    var ingressos = lote.ingressos || 0;
    var vendidos = (lote.vendidosFora || 0) + vendidosKiwify;
    var pct = ingressos ? Math.min(100, Math.round((vendidos / ingressos) * 100)) : 0;
    var restantes = Math.max(0, ingressos - vendidos);
    var nome = lote.nome || 'Lote';
    var rotulo = pct >= 100 ? nome + ' esgotado' : nome + ' · ' + pct + '% vendido';
    var sobra = restantes + (restantes === 1 ? ' ingresso' : ' ingressos');
    texto('[data-lote-rotulo]', rotulo);
    texto('[data-lote-restantes]', sobra);
    document.querySelectorAll('[data-lote-barra]').forEach(function (el) { el.style.width = pct + '%'; });
    document.querySelectorAll('.lote[role="progressbar"]').forEach(function (el) {
      el.setAttribute('aria-valuenow', String(pct));
      el.setAttribute('aria-label', rotulo + ', ' + sobra + ' restantes');
    });
  }

  if (!lote.ingressos) return;
  pintar();

  // Falha silenciosa por desenho: a barra já está certa com o vendidosFora.
  fetch('/api/stats?modo=aula', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (j) {
      if (j && typeof j.vendidos === 'number' && j.vendidos >= 0) { vendidosKiwify = j.vendidos; pintar(); }
    })
    .catch(function () {});
})();
