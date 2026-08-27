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

  /**
   * O `_fbp` normalmente é criado pelo próprio Pixel. Quando ele é bloqueado
   * (bloqueador de anúncio, ITP, submissão antes do script carregar) o campo
   * some do evento e a correspondência cai. O formato é público e o Meta aceita
   * o cookie gerado por nós: fb.1.<timestamp>.<aleatório>. Se o Pixel carregar
   * depois, ele reaproveita este mesmo cookie — o id continua sendo um só.
   */
  function getOrCreateFbp() {
    var fbp = getCookie('_fbp');
    if (!fbp) {
      fbp = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10);
      setCookie('_fbp', fbp, 90);
      log('_fbp gerado localmente');
    }
    return fbp;
  }

  /**
   * O `referrer_url` do evento é o referrer da página onde ele aconteceu. Mas
   * navegar dentro do site zera essa informação, então guardamos também a
   * entrada externa da sessão e usamos como plano B — de fora é que veio a
   * visita, e é isso que o Meta usa como sinal de atribuição.
   */
  function firstReferrer() {
    var atual = document.referrer || '';
    var salvo = '';
    try {
      salvo = sessionStorage.getItem('_sp_referrer') || '';
      if (atual && !salvo && atual.indexOf(window.location.origin) !== 0) {
        sessionStorage.setItem('_sp_referrer', atual);
        salvo = atual;
      }
    } catch (e) {}
    return atual || salvo;
  }

  function generateEventId() {
    return 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /* ── Captura UTMs e Click IDs ─────────────────────────── */
  getOrCreateFbp();
  firstReferrer();

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
        // Cookie de 90 dias pode ter sido apagado antes do fbclid da sessão.
        if (k === 'fbclid' && stored && !getCookie('_fbc')) {
          setCookie('_fbc', 'fb.1.' + Date.now() + '.' + stored, 90);
          log('_fbc recriado do fbclid guardado');
        }
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
    if (fbpEl) fbpEl.value = getOrCreateFbp();

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
      // Não adianta chamar fbq('init', ...) aqui com e-mail e telefone: o Meta
      // só aceita correspondência avançada no código base do Pixel, e um
      // segundo init do mesmo id é descartado com "Duplicate Pixel ID"
      // (verificado no navegador). Quem carrega esses dados é o evento do CAPI,
      // que sai com o mesmo event_id e é deduplicado contra este.

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

    // Rede de segurança: manda tudo que o CAPI usa mesmo na página que não tem
    // o campo oculto correspondente. Sem isto, incluir um parâmetro novo no
    // evento obriga a editar todas as landing pages — e a que ficar para trás
    // manda evento pior sem avisar ninguém.
    data.fbp         = data.fbp         || getCookie('_fbp') || getOrCreateFbp();
    data.fbc         = data.fbc         || getCookie('_fbc');
    data.external_id = data.external_id || getOrCreateExtId();
    data.page_url    = data.page_url    || window.location.href;
    data.user_agent  = data.user_agent  || navigator.userAgent;
    data.pagina      = data.pagina      || (window.location.pathname.replace(/\/$/, '') || '/');
    data.referrer    = firstReferrer();

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
  // Ao mudar esta lista, subir o ?v= da tag <script> nas páginas. Este arquivo
  // é servido com must-revalidate, mas quem visitou antes disso ainda carrega a
  // versão immutable de um ano — e um beacon congelado não registra a página nova.
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


  /* ── Micro-eventos do funil ───────────────────────────────────────────
     Entre "chegou" e "converteu" existem seis passos, e sem eles uma
     conversão baixa não tem culpado identificável — todos os degraus parecem
     igualmente responsáveis. Estes eventos tornam o funil legível e, de
     quebra, tornam o teste A/B decidível antes de haver lead suficiente.

     Roda só nas páginas do beacon: o endpoint recusa as outras, e mandar
     evento de página não instrumentada só gastaria requisição. */

  (function funil() {
    var pagina = window.location.pathname.replace(/\/$/, '') || '/';
    if (PAGEVIEW_BEACON_PAGES.indexOf(pagina) === -1) return;

    var form = document.getElementById('sessao-form');
    if (!form) return;

    // Cada par evento+valor conta uma vez por carregamento. Sem isso, rolagem
    // e blur repetido enchem a tabela e distorcem qualquer contagem.
    var jaFoi = {};

    function marcar(evento, valor) {
      var chave = evento + ':' + (valor == null ? '' : valor);
      if (jaFoi[chave]) return;
      jaFoi[chave] = true;

      var corpo = JSON.stringify({
        pagina:    pagina,
        evento:    evento,
        valor:     valor == null ? null : String(valor),
        visitante: getOrCreateExtId(),
      });

      try {
        if (navigator.sendBeacon &&
            navigator.sendBeacon('/api/pageview', new Blob([corpo], { type: 'application/json' }))) {
          log('evento', evento, valor); return;
        }
      } catch (e) { /* cai no fetch */ }

      fetch('/api/pageview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: corpo, keepalive: true,
      }).catch(function () { /* métrica não pode quebrar a página */ });
    }

    /* Rolagem — diz se a pessoa chega a ver a oferta ou sai no primeiro terço. */
    window.addEventListener('scroll', function () {
      var alcance = document.body.scrollHeight - window.innerHeight;
      if (alcance <= 0) return;
      var pct = (window.scrollY / alcance) * 100;
      [25, 50, 75, 100].forEach(function (marca) {
        if (pct >= marca) marcar('scroll', marca);
      });
    }, { passive: true });

    /* Qual CTA funciona. São cinco por página, e hoje não se sabe qual paga. */
    Array.prototype.forEach.call(document.querySelectorAll('.open-modal'), function (el, i) {
      el.addEventListener('click', function () {
        marcar('cta_click', (i + 1) + ':' + el.textContent.trim().slice(0, 24));
      });
    });

    /* O modal pode abrir por qualquer caminho; observar a classe pega todos. */
    var overlay = document.getElementById('modal-overlay');
    var estavaAberto = false;
    if (overlay && window.MutationObserver) {
      // O observador entrega as mudanças em LOTE. Ler só o estado atual no fim
      // do lote perde a transição quando abre e fecha entre dois quadros — e o
      // que se perde é justamente o form_abandon, o evento mais caro daqui.
      // Por isso cada registro é avaliado pelo seu próprio antes/depois.
      var temOpen = function (cls) { return /(^|\s)open(\s|$)/.test(cls || ''); };

      new MutationObserver(function (registros) {
        registros.forEach(function (r, i) {
          var antes  = temOpen(r.oldValue);
          var depois = i + 1 < registros.length
            ? temOpen(registros[i + 1].oldValue)
            : overlay.classList.contains('open');
          if (antes === depois) return;
          if (depois) marcar('form_open');
          else if (algumCampoPreenchido() && !enviou) marcar('form_abandon', ultimoCampo || 'nenhum');
        });
        estavaAberto = overlay.classList.contains('open');
      }).observe(overlay, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    }

    var campos = ['f-name', 'f-email', 'f-phone', 'f-cargo', 'f-colab'];
    var ultimoCampo = '';
    var enviou = false;

    function algumCampoPreenchido() {
      return Array.prototype.some.call(form.elements, function (e) {
        return e.type !== 'hidden' && e.tagName !== 'BUTTON' && e.value;
      });
    }

    /* Primeiro campo tocado e último campo que ficou válido: juntos dizem
       ONDE a pessoa parou, que é a pergunta que o funil precisa responder. */
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.type === 'hidden' || el.tagName === 'BUTTON') return;
      var nome = el.name || el.id || '?';

      el.addEventListener('focus', function () { marcar('form_start', nome); }, { once: true });
      el.addEventListener('blur', function () {
        if (!el.value) return;
        ultimoCampo = nome;
        marcar('campo_ok', nome);
      });
    });

    /* O evento que decide se o problema é a página ou a segmentação do
       anúncio: quantos que abrem o formulário estão abaixo do porte que a
       oferta atende. */
    var colab = document.getElementById('f-colab');
    if (colab) colab.addEventListener('change', function () { marcar('porte', colab.value); });

    var cargo = document.getElementById('f-cargo');
    if (cargo) cargo.addEventListener('change', function () { marcar('cargo', cargo.value); });

    /* Qual pergunta a pessoa abre é objeção declarada, não inferida. */
    Array.prototype.forEach.call(document.querySelectorAll('.faq button, button[aria-expanded]'), function (b) {
      b.addEventListener('click', function () {
        marcar('faq_open', b.textContent.replace(/[+−-]\s*$/, '').trim().slice(0, 60));
      });
    });

    form.addEventListener('submit', function () { marcar('form_submit'); });

    /* Sucesso e erro são detectados pela tela que aparece, não por gancho no
       código da página — assim as duas landing pages funcionam sem edição. */
    ['form-success', 'form-error'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !window.MutationObserver) return;
      new MutationObserver(function () {
        var visivel = id === 'form-success'
          ? getComputedStyle(el).display !== 'none'
          : el.classList.contains('on');
        if (!visivel) return;
        if (id === 'form-success') { enviou = true; marcar('whatsapp'); }
        else marcar('submit_error');
      }).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    });

    log('funil instrumentado', pagina);
  })();

  log('tracking.js loaded ✓');
})();
