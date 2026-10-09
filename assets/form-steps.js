/** Shared six-step consultation form. Values and tracking names are API contracts. */
(function () {
  'use strict';

  const WHATSAPP_URL = 'https://wa.me/5531999491532?text=' +
    encodeURIComponent('Olá! Acabei de solicitar minha Sessão Estratégica pelo site e quero agendar a reunião.');
  const CAMPOS = ['colaboradores', 'cargo', 'escritorio', 'nome', 'email', 'telefone'];
  const TEXTOS = [
    ['Quantos colaboradores tem o seu escritório?', 'Conte com todos que fazem parte da operação.'],
    ['Qual é a sua posição no escritório?', 'Entender o seu papel ajuda a preparar a conversa.'],
    ['Como se chama o seu escritório?', 'Esta resposta é opcional.'],
    ['Como podemos chamar você?', 'Informe seu nome completo.'],
    ['Qual é o seu e-mail?', 'Usaremos este contato para falar sobre a sua sessão.'],
    ['Em qual WhatsApp falamos com você?', 'Nosso time entra em contato para combinar a data.'],
  ];
  const overlay = document.getElementById('modal-overlay');
  const form = document.getElementById('sessao-form');
  if (!overlay || !form) return;
  const passos = CAMPOS.map((_campo, i) => document.getElementById('passo-' + (i + 1)));
  const avancar = document.getElementById('avancar-passo');
  const voltar = document.getElementById('voltar-passo-1');
  const btnSend = document.getElementById('submit-btn');
  const erro = document.getElementById('form-error');
  const erroCampo = document.getElementById('step-error');
  const titulo = document.getElementById('modal-title');
  let passoAtual = 1;
  let lastFocus = null;
  let enviando = false;

  function marcar(evento, valor) {
    if (typeof window.SP_marcar === 'function') window.SP_marcar(evento, valor);
  }

  function valorDe(nome) {
    return form.elements[nome].value;
  }

  function orientarPerfil() {
    const fora = ['De 0 a 4', 'De 5 a 9'].includes(valorDe('colaboradores'));
    document.getElementById('route-porte').classList.toggle('on', fora);
    document.getElementById('route-cargo').classList.toggle('on', valorDe('cargo') === 'Cargo Operacional');
  }

  function limparErroCampo() {
    erroCampo.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(campo => campo.removeAttribute('aria-invalid'));
  }

  function irParaPasso(n, focar) {
    passoAtual = n;
    passos.forEach((passo, i) => { passo.hidden = i + 1 !== n; });
    voltar.hidden = n === 1;
    avancar.hidden = n === 6;
    btnSend.hidden = n !== 6;
    avancar.textContent = n === 3 && !valorDe('escritorio').trim() ? 'Pular esta pergunta' : 'Continuar';
    document.getElementById('passo-rotulo').textContent = 'Pergunta ' + n + ' de 6';
    document.getElementById('form-progress').value = n;
    titulo.textContent = TEXTOS[n - 1][0];
    document.getElementById('modal-sub').textContent = TEXTOS[n - 1][1];
    limparErroCampo();
    if (n === 4) marcar('passo_2');
    if (focar) titulo.focus();
  }

  function validarPasso(n) {
    const campo = form.elements[CAMPOS[n - 1]];
    const valor = campo.value.trim();
    if (n === 3) return true;
    let mensagem = '';
    if (!valor) mensagem = n < 3 ? 'Escolha uma opção para continuar.' : 'Preencha este campo para continuar.';
    else if (n === 5 && !campo.validity.valid) mensagem = 'Informe um e-mail válido.';
    else if (n === 6 && !/^\d{10,11}$/.test(valor.replace(/\D/g, ''))) mensagem = 'Informe o WhatsApp com DDD, com 10 ou 11 números.';
    if (!mensagem) return true;
    if (passoAtual !== n) irParaPasso(n, false);
    erroCampo.textContent = mensagem;
    erroCampo.hidden = false;
    const alvo = n < 3 ? campo[0] : campo;
    alvo.setAttribute('aria-invalid', 'true');
    alvo.focus();
    return false;
  }

  function proximoPasso() {
    if (!enviando && validarPasso(passoAtual) && passoAtual < 6) irParaPasso(passoAtual + 1, true);
  }

  window.openModal = function (passo) {
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    const sucesso = document.getElementById('form-success');
    if (!sucesso.hidden) { sucesso.focus(); return; }
    if (passo === 2) irParaPasso(2, false);
    titulo.focus();
  };

  window.closeModal = function () {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  document.querySelectorAll('.open-modal').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); window.openModal(); });
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) window.closeModal(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') { window.closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = Array.from(overlay.querySelectorAll('a[href], button:not([disabled]), input, select, textarea'))
      .filter(el => el.getClientRects().length > 0 && !el.closest('[hidden]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === titulo)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  avancar.addEventListener('click', proximoPasso);
  voltar.addEventListener('click', () => { if (!enviando) irParaPasso(passoAtual - 1, true); });
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.matches('input')) return;
    e.preventDefault();
    if (passoAtual < 6) proximoPasso();
    else window.submitForm(e);
  });
  form.addEventListener('change', e => {
    if (['colaboradores', 'cargo'].includes(e.target.name)) orientarPerfil();
    limparErroCampo();
  });
  document.getElementById('f-escritorio').addEventListener('input', () => {
    avancar.textContent = valorDe('escritorio').trim() ? 'Continuar' : 'Pular esta pergunta';
  });

  document.querySelectorAll('.porte-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const valor = chip.getAttribute('data-porte');
      const alvo = Array.from(form.querySelectorAll('input[name="colaboradores"]')).find(campo => campo.value === valor);
      if (alvo) {
        alvo.checked = true;
        alvo.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.openModal(['De 0 a 4', 'De 5 a 9'].includes(valor) ? 1 : 2);
      marcar('cta_chip', valor);
    });
  });
  document.getElementById('clube-link').addEventListener('click', () => marcar('clube'));
  document.getElementById('route-continuar').addEventListener('click', e => {
    e.preventDefault();
    proximoPasso();
  });

  document.getElementById('f-phone').addEventListener('input', function () {
    const d = this.value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) this.value = d;
    else if (d.length <= 6) this.value = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    else if (d.length <= 10) this.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    else this.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  });

  function terminarEnvio() {
    enviando = false;
    form.removeAttribute('aria-busy');
    voltar.disabled = false;
  }

  function mostrarSucesso() {
    terminarEnvio();
    document.getElementById('form-wrapper').hidden = true;
    const sucesso = document.getElementById('form-success');
    sucesso.hidden = false;
    sucesso.style.display = 'block';
    sucesso.focus();
    document.getElementById('wa-link').href = WHATSAPP_URL;
  }

  function mostrarErro() {
    terminarEnvio();
    erro.classList.add('on');
    erro.focus();
    btnSend.disabled = false;
    btnSend.textContent = 'Tentar novamente';
  }

  window.submitForm = function (e) {
    e.preventDefault();
    if (enviando) return;
    if (passoAtual < 6) { proximoPasso(); return; }
    for (let n = 1; n <= 6; n += 1) { if (!validarPasso(n)) return; }
    erro.classList.remove('on');
    if (typeof window.SP_handleSubmit !== 'function') { mostrarErro(); return; }
    enviando = true;
    form.setAttribute('aria-busy', 'true');
    voltar.disabled = true;
    window.SP_handleSubmit(e, form, mostrarSucesso, mostrarErro);
  };

  window.toggleFaq = function (btn) {
    const open = btn.parentElement.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    const sinal = btn.querySelector('span');
    if (sinal) sinal.textContent = open ? '−' : '+';
  };

  irParaPasso(1, false);
})();
