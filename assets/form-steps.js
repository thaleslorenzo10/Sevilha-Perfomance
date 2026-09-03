/**
 * Sevilha Performance — formulário da Sessão Estratégica em dois passos
 *
 * Este arquivo é COMPARTILHADO pelas duas variantes do teste A/B (/mentoria e
 * /mentoria-2). Comportamento de formulário idêntico é pré-requisito do teste:
 * enquanto cada página tinha a própria cópia deste código, qualquer correção
 * feita em uma e esquecida na outra passaria a medir a correção, não o layout.
 * A grade e a tipografia continuam sendo a variável; o formulário, não.
 *
 * ── Por que dois passos ─────────────────────────────────────────────────
 *
 * O formulário anterior pedia seis campos de uma vez e deixava a pergunta de
 * porte para o fim. Três consequências medidas em 25/08–03/09/2026:
 *
 *   • de 185 carregamentos vindos de anúncio, 8 abriram o formulário;
 *   • quem abria convertia bem (5 de 8), então o gargalo era ABRIR;
 *   • 3 em cada 4 leads que o anúncio traz têm menos de 10 colaboradores, e
 *     só descobriam que a oferta não era para eles depois de digitar tudo.
 *
 * Daí o desenho: o primeiro passo são duas perguntas de um toque cada (porte
 * e cargo), e o segundo pede contato. Quem está abaixo de 10 colaboradores
 * recebe o caminho do Clube da Performance no primeiro passo — e continua
 * podendo se inscrever, porque quem separa perfil é o time no CRM, não a
 * página (ver PRODUCT.md).
 *
 * ── Contrato com o HTML ─────────────────────────────────────────────────
 *
 * Ids esperados na página (ausentes = o trecho correspondente não roda):
 *   #modal-overlay #form-wrapper #sessao-form #modal-foot
 *   #passo-1 #passo-2 #passo-rotulo #modal-title #modal-sub
 *   #route-porte #clube-link #route-continuar #route-cargo
 *   #form-error #err-wa #form-success #wa-link #submit-btn
 *   #voltar-passo-1 #f-name #f-phone
 *
 * Os campos de porte e cargo são grupos de <input type="radio"> com
 * name="colaboradores" e name="cargo" — o mesmo `name=` dos <select> que eles
 * substituíram, porque esse nome é contrato com /api/leads. Um toque no lugar
 * de abrir a roleta do iOS, rolar e confirmar.
 *
 * Os atalhos do topo da página são <button class="porte-chip" data-porte="…">:
 * respondem o porte e já abrem o modal no passo certo. É a primeira interação
 * da página ser a pergunta, em vez de um botão que leva a um paredão de campos.
 */
(function () {
  'use strict';

  /* Destino do agendamento — trocar o número aqui se mudar o atendimento. */
  var WHATSAPP_URL = 'https://wa.me/5531999491532?text=' +
    encodeURIComponent('Olá! Acabei de solicitar minha Sessão Estratégica pelo site e quero agendar a reunião.');

  /* Oferta para quem está abaixo do porte. /campanha é a entrada do rodízio do
     Clube da Performance — ver api/ab.js. Não é `/` para a visita entrar no
     teste A/B daquela oferta como qualquer outra. */
  var CLUBE_URL = '/campanha';

  var FORA_DO_PORTE = ['De 0 a 4', 'De 5 a 9'];

  var overlay = document.getElementById('modal-overlay');
  var form    = document.getElementById('sessao-form');
  if (!overlay || !form) return;

  var passo1     = document.getElementById('passo-1');
  var passo2     = document.getElementById('passo-2');
  var rotulo     = document.getElementById('passo-rotulo');
  var titulo     = document.getElementById('modal-title');
  var subtitulo  = document.getElementById('modal-sub');
  var rodape     = document.getElementById('modal-foot');
  var rPorte     = document.getElementById('route-porte');
  var rCargo     = document.getElementById('route-cargo');
  var grupoCargo = document.getElementById('grupo-cargo');
  var btnSend    = document.getElementById('submit-btn');
  var erro       = document.getElementById('form-error');

  var waLink  = document.getElementById('wa-link');
  var errWa   = document.getElementById('err-wa');
  if (waLink) waLink.href = WHATSAPP_URL;
  if (errWa)  errWa.href  = WHATSAPP_URL;

  /** Marca um micro-evento quando o tracking está carregado. */
  function marcar(evento, valor) {
    if (typeof window.SP_marcar === 'function') window.SP_marcar(evento, valor);
  }

  function valorDe(nome) {
    var campo = form.elements[nome];
    return campo ? campo.value : '';
  }

  var TEXTOS = {
    1: {
      rotulo: 'Passo 1 de 2',
      titulo: 'Duas perguntas rápidas',
      sub:    'Elas definem se a Sessão Estratégica é o formato certo para o seu escritório.',
    },
    2: {
      rotulo: 'Passo 2 de 2',
      titulo: 'Onde falamos com você',
      sub:    'Nosso time chama no WhatsApp para combinar a data da sessão.',
    },
  };

  var passoAtual = 1;

  function irParaPasso(n) {
    passoAtual = n;
    if (passo1) passo1.hidden = n !== 1;
    if (passo2) passo2.hidden = n !== 2;
    // O botão de enviar não existe no passo 1: com ele na tela, o navegador
    // tentaria validar campos obrigatórios que estão escondidos e travaria o
    // envio sem conseguir mostrar onde ("invalid form control is not focusable").
    if (rodape) rodape.hidden = n !== 2;

    var t = TEXTOS[n];
    if (rotulo)    rotulo.textContent    = t.rotulo;
    if (titulo)    titulo.textContent    = t.titulo;
    if (subtitulo) subtitulo.textContent = t.sub;

    if (n === 2) {
      marcar('passo_2');
      // No touch o foco automático abre o teclado e come metade da tela.
      if (window.matchMedia('(pointer: fine)').matches) {
        var f = document.getElementById('f-name');
        if (f) f.focus();
      }
    }
  }

  /* ── Modal ───────────────────────────────────────────── */
  var lastFocus = null;

  window.openModal = function (passo) {
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    irParaPasso(passo === 2 ? 2 : 1);

    // O foco vai para o diálogo, não para o primeiro campo: focar a primeira
    // opção de um grupo de rádio faz o leitor de tela anunciá-la como se já
    // estivesse escolhida, e no passo 1 nada está escolhido ainda. Focar o
    // container mantém o teclado dentro do modal desde a abertura.
    if (passoAtual === 1) {
      var caixa = overlay.querySelector('.modal');
      if (caixa) caixa.focus();
    }
  };

  window.closeModal = function () {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  document.querySelectorAll('.open-modal').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); window.openModal(1); });
  });

  overlay.addEventListener('click', function (e) { if (e.target === this) window.closeModal(); });

  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { window.closeModal(); return; }
    if (e.key !== 'Tab') return;

    // Prende o foco dentro do diálogo enquanto ele estiver aberto.
    var f = overlay.querySelectorAll('a[href], button:not([disabled]), input, select, textarea');
    f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ── Passo 1: porte e cargo ──────────────────────────────────────────
     Quem está abaixo de 10 recebe o Clube ANTES de digitar qualquer coisa.
     O aviso de cargo operacional aparece junto, porque a sessão só vira
     decisão com quem decide — mas nenhum dos dois bloqueia o envio. */
  function avaliarPasso1() {
    var porte = valorDe('colaboradores');
    var cargo = valorDe('cargo');
    if (!porte) return;

    var fora = FORA_DO_PORTE.indexOf(porte) > -1;
    if (rPorte) rPorte.classList.toggle('on', fora);
    if (rCargo) rCargo.classList.toggle('on', !fora && cargo === 'Cargo Operacional');

    // Fora do porte: a pessoa escolhe o caminho. Perguntar o cargo de quem já
    // não é do perfil só adiciona um toque antes da decisão que importa.
    if (grupoCargo) grupoCargo.hidden = fora;
    if (fora) return;

    if (cargo) irParaPasso(2);
  }

  form.addEventListener('change', function (e) {
    var campo = e.target && e.target.name;
    if (campo === 'colaboradores' || campo === 'cargo') avaliarPasso1();
  });

  /* Atalhos do topo da página: respondem o porte e abrem o modal já adiantado. */
  document.querySelectorAll('.porte-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var valor = chip.getAttribute('data-porte');
      var alvo  = form.querySelector('input[name="colaboradores"][value="' + valor + '"]');
      if (alvo) {
        alvo.checked = true;
        // `.checked = true` não dispara change: o evento é do usuário, não da
        // propriedade. Sem este disparo, nem o funil nem o roteamento reagiriam.
        alvo.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // O modal abre no passo 1 de propósito: falta responder o cargo, e é o
      // avaliarPasso1() do disparo acima que decide se já pula para o passo 2.
      window.openModal(1);
      marcar('cta_chip', valor);
    });
  });

  var voltar = document.getElementById('voltar-passo-1');
  if (voltar) voltar.addEventListener('click', function (e) {
    e.preventDefault();
    irParaPasso(1);
  });

  var clube = document.getElementById('clube-link');
  if (clube) {
    clube.href = CLUBE_URL;
    clube.addEventListener('click', function () { marcar('clube'); });
  }

  var continuar = document.getElementById('route-continuar');
  if (continuar) continuar.addEventListener('click', function (e) {
    e.preventDefault();
    if (grupoCargo) grupoCargo.hidden = false;
    if (valorDe('cargo')) irParaPasso(2);
  });

  /* ── Telefone: o campo mostra o formato enquanto a pessoa digita ── */
  var fone = document.getElementById('f-phone');
  if (fone) fone.addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2)       this.value = d;
    else if (d.length <= 6)  this.value = '(' + d.slice(0,2) + ') ' + d.slice(2);
    else if (d.length <= 10) this.value = '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
    else                     this.value = '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  });

  /* ── Envio ───────────────────────────────────────────── */
  window.submitForm = function (e) {
    if (erro) erro.classList.remove('on');
    window.SP_handleSubmit(e, form, mostrarSucesso, mostrarErro);
  };

  function mostrarSucesso() {
    var wrapper = document.getElementById('form-wrapper');
    var sucesso = document.getElementById('form-success');
    if (wrapper) wrapper.style.display = 'none';
    if (sucesso) sucesso.style.display = 'block';
    setTimeout(function () { window.location.href = WHATSAPP_URL; }, 2500);
  }

  function mostrarErro() {
    if (erro) {
      erro.classList.add('on');
      erro.scrollIntoView({ block: 'nearest' });
    }
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.textContent = 'Tentar novamente';
    }
  }

  /* ── FAQ ─────────────────────────────────────────────── */
  window.toggleFaq = function (btn) {
    var item = btn.parentElement;
    var open = item.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var sinal = btn.querySelector('span');
    if (sinal) sinal.textContent = open ? '−' : '+';
  };

  // Estado inicial coerente com o HTML: o passo 1 é o que aparece.
  irParaPasso(1);
})();
