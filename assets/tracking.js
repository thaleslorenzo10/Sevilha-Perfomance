/**
 * Sevilha Performance — Tracking Centralizado
 * Meta Pixel + Conversions API (CAPI) + Google Ads
 *
 * ─────────────────────────────────────────────────────────
 * CONFIGURAÇÃO — atualize apenas este bloco
 * ─────────────────────────────────────────────────────────
 */
var SP_CONFIG = {
  META_PIXEL_ID:           '657178423444244',
  GOOGLE_ADS_ID:           'AW-XXXXXXXXXX',           // preencher quando tiver o Google Ads ID
  GOOGLE_CONVERSION_LABEL: 'XXXXXXXXXXXXXXXXXXXXX',   // preencher quando tiver o label
  FORM_ENDPOINT:           '/api/leads',              // Vercel Serverless Function
  DEBUG:                   false,
};
/* ──────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────── */
  function log() {
    if (SP_CONFIG.DEBUG) console.log('[SP Tracking]', ...arguments);
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function getOrCreateExtId() {
    var id = localStorage.getItem('_sp_ext_id');
    if (!id) {
      id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      localStorage.setItem('_sp_ext_id', id);
    }
    return id;
  }

  function generateEventId() {
    return 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /* ── Captura UTMs e Click IDs ─────────────────────────── */
  (function captureParams() {
    var params = new URLSearchParams(window.location.search);
    var keys   = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
                  'fbclid','gclid','ttclid','msclkid'];

    keys.forEach(function (k) {
      var val = params.get(k);
      if (val) {
        sessionStorage.setItem(k, val);
        log('captured', k, val);

        // Gera _fbc a partir do fbclid
        if (k === 'fbclid') {
          var fbc = 'fb.1.' + Date.now() + '.' + val;
          setCookie('_fbc', fbc, 90);
          log('_fbc cookie set');
        }
      } else {
        // Tenta restaurar da sessionStorage (navegações entre páginas)
        var stored = sessionStorage.getItem(k);
        if (stored) log('restored from session', k, stored);
      }
    });
  })();

  /* ── Meta Pixel — advanced matching (pixel já iniciado inline no HTML) ── */
  if (window.fbq) {
    fbq('init', SP_CONFIG.META_PIXEL_ID, { external_id: getOrCreateExtId() });
    log('Meta Pixel advanced matching set (external_id)');
  }

  /* ── Google Tag (gtag.js) ────────────────────────────── */
  (function loadGtag() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + SP_CONFIG.GOOGLE_ADS_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', SP_CONFIG.GOOGLE_ADS_ID, {
      allow_enhanced_conversions: true,
    });
    log('Google Tag init');
  })();

  /* ── Preenche campos ocultos do formulário ───────────── */
  window.SP_populateHiddenFields = function (form) {
    var utmKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
                   'fbclid','gclid','ttclid','msclkid'];

    utmKeys.forEach(function (k) {
      var el = form.querySelector('[name="' + k + '"]');
      if (el) el.value = sessionStorage.getItem(k) || '';
    });

    // Meta Pixel cookies
    var fbpEl = form.querySelector('[name="fbp"]');
    if (fbpEl) fbpEl.value = getCookie('_fbp');

    var fbcEl = form.querySelector('[name="fbc"]');
    if (fbcEl) fbcEl.value = getCookie('_fbc');

    // Identificadores
    var extIdEl = form.querySelector('[name="external_id"]');
    if (extIdEl) extIdEl.value = getOrCreateExtId();

    // Contexto da página
    var pageUrlEl = form.querySelector('[name="page_url"]');
    if (pageUrlEl) pageUrlEl.value = window.location.href;

    var uaEl = form.querySelector('[name="user_agent"]');
    if (uaEl) uaEl.value = navigator.userAgent;

    // Event ID para deduplicação Browser ↔ CAPI
    var eventIdEl = form.querySelector('[name="event_id"]');
    if (eventIdEl && !eventIdEl.value) eventIdEl.value = generateEventId();

    log('hidden fields populated');
  };

  /* ── Dispara eventos de conversão ────────────────────── */
  window.SP_fireLeadEvents = function (eventId, formData) {
    // Meta Pixel Lead
    if (window.fbq) {
      fbq('track', 'Lead', {
        content_name: document.title,
        content_category: 'pre-inscricao',
        value: 0,
        currency: 'BRL',
      }, { eventID: eventId });
      log('Meta Lead fired', eventId);
    }

    // Google Ads Conversion
    if (window.gtag) {
      gtag('event', 'conversion', {
        send_to: SP_CONFIG.GOOGLE_ADS_ID + '/' + SP_CONFIG.GOOGLE_CONVERSION_LABEL,
        value: 0.0,
        currency: 'BRL',
        transaction_id: eventId,
      });
      // Enhanced Conversions (email/telefone hasheados são enviados via gtag)
      if (formData && formData.email) {
        gtag('set', 'user_data', {
          email: formData.email,
          phone_number: formData.telefone || '',
        });
      }
      log('Google Ads conversion fired', eventId);
    }
  };

  /* ── Retry com backoff + localStorage fallback ─────── */
  var PENDING_KEY = 'sp_pending_leads';

  function savePending(data) {
    try {
      var list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      list.push(data);
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function postLead(data, attempt) {
    attempt = attempt || 1;
    return fetch(SP_CONFIG.FORM_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(data),
    }).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    }).catch(function(err) {
      if (attempt < 3) {
        log('retry', attempt, err.message);
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(postLead(data, attempt + 1)); }, attempt * 1500);
        });
      }
      savePending(data);
      log('saved to localStorage after', attempt, 'attempts');
      throw err;
    });
  }

  // Reenviar leads pendentes ao carregar a página
  (function retrySaved() {
    try {
      var list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      if (!list.length) return;
      log('retrying', list.length, 'pending lead(s)');
      localStorage.removeItem(PENDING_KEY);
      list.forEach(function(data) { postLead(data).catch(function(){}); });
    } catch(e) {}
  })();

  /* ── Handler de submit unificado ─────────────────────── */
  /**
   * `onError` é opcional. Página que passa um handler assume a responsabilidade
   * de mostrar a falha ao visitante; sem ele o comportamento continua o de
   * antes — segue para o sucesso mesmo com o POST falhando —, para não deixar
   * as landing pages antigas sem nenhuma saída na tela.
   */
  window.SP_handleSubmit = function (e, form, onSuccess, onError) {
    e.preventDefault();

    var btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }

    // Preenche campos antes de serializar
    window.SP_populateHiddenFields(form);

    var data      = Object.fromEntries(new FormData(form));
    var eventId   = data.event_id || generateEventId();
    data.event_id = eventId;

    log('submitting to', SP_CONFIG.FORM_ENDPOINT, data);

    postLead(data)
    .then(function (res) {
      log('form submitted', res.status);
      window.SP_fireLeadEvents(eventId, data);
      onSuccess();
    })
    .catch(function (err) {
      log('form error after retries', err);
      if (typeof onError === 'function') {
        // O lead ficou no localStorage e será reenviado no próximo carregamento.
        // Não dispara conversão: não houve lead salvo para converter.
        onError(err);
        return;
      }
      // Sem handler de erro: mantém o comportamento antigo — não bloqueia o usuário.
      window.SP_fireLeadEvents(eventId, data);
      onSuccess();
    });
  };

  /* ── Beacon de visita ─────────────────────────────────
     As páginas do teste A/B recebem a visita no redirect /campanha. As que
     ficam fora do rodízio são acessadas direto pelo anúncio e precisam
     registrar a própria visita, senão não há denominador para a conversão.
     A lista curta evita contar a mesma visita duas vezes. */
  var PAGEVIEW_BEACON_PAGES = ['/mentoria', '/mentoria-2'];

  (function beacon() {
    var pagina = window.location.pathname.replace(/\/$/, '') || '/';
    if (PAGEVIEW_BEACON_PAGES.indexOf(pagina) === -1) return;

    var corpo = JSON.stringify({
      pagina: pagina,
      query:  window.location.search.replace(/^\?/, ''),
    });

    // sendBeacon sobrevive à saída da página; fetch é o plano B.
    try {
      if (navigator.sendBeacon &&
          navigator.sendBeacon('/api/pageview', new Blob([corpo], { type: 'application/json' }))) {
        log('pageview beacon enviado', pagina);
        return;
      }
    } catch (e) { /* cai no fetch */ }

    fetch('/api/pageview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    corpo,
      keepalive: true,
    }).catch(function () { /* métrica não pode quebrar a página */ });
  })();

  log('tracking.js loaded ✓');
})();
