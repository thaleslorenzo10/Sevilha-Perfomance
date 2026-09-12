(() => {
  const form = document.querySelector('#briefing');
  const fields = [...form.querySelectorAll('textarea')];
  const button = document.querySelector('#submit-button');
  const status = document.querySelector('#submit-status');
  const draftStatus = document.querySelector('#draft-status');
  const storageKey = 'sevilha:briefing-aula:v1';
  let pending = null;
  let receipt = null;
  let sending = false;

  function answers() {
    return Object.fromEntries(fields.map(field => [field.name, field.value]));
  }

  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers: answers(), pending, receipt }));
      draftStatus.textContent = receipt
        ? 'Último envio confirmado. Alterações ficam em rascunho neste navegador até um novo envio.'
        : 'Rascunho salvo neste navegador. As respostas só chegam à equipe quando você enviar.';
    } catch {
      draftStatus.textContent = 'Este navegador não conseguiu salvar o rascunho. Mantenha a página aberta até confirmar o envio.';
    }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!draft || typeof draft !== 'object') return;
      fields.forEach(field => {
        if (typeof draft.answers?.[field.name] === 'string') field.value = draft.answers[field.name].slice(0, 3000);
      });
      if (typeof draft.pending?.id === 'string' && typeof draft.pending?.snapshot === 'string') pending = draft.pending;
      if (typeof draft.receipt?.id === 'string') receipt = draft.receipt;
      draftStatus.textContent = 'Rascunho recuperado deste navegador. Confira as respostas antes de enviar.';
      if (receipt) {
        status.textContent = `Último envio confirmado: ${receipt.id}. Você pode enviar uma atualização.`;
        button.textContent = 'Enviar atualização';
      }
    } catch {
      draftStatus.textContent = 'Não foi possível recuperar o rascunho local. Mantenha a página aberta enquanto responde.';
    }
  }

  fields.forEach(field => field.addEventListener('input', () => {
    field.setCustomValidity(field.required && !field.value.trim() ? 'Preencha este campo ou escreva “a definir”.' : '');
    saveDraft();
  }));

  function showStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
    status.focus();
  }

  async function sendBriefing(event) {
    event.preventDefault();
    if (sending) return;
    fields.forEach(field => field.setCustomValidity(field.required && !field.value.trim() ? 'Preencha este campo ou escreva “a definir”.' : ''));
    if (!form.reportValidity()) return;
    const submitted = answers();
    const snapshot = JSON.stringify(submitted);
    sending = true;
    button.disabled = true;
    button.textContent = 'Enviando…';
    status.textContent = 'Aguardando confirmação do envio…';
    status.dataset.state = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      if (!pending || pending.snapshot !== snapshot) pending = { id: crypto.randomUUID(), snapshot };
      const requestId = pending.id;
      saveDraft();
      const body = JSON.stringify({ id: requestId, answers: submitted, website: form.elements.website.value });
      if (new TextEncoder().encode(body).byteLength > 56 * 1024) {
        showStatus('As respostas ultrapassam o limite total de texto. Resuma os trechos mais longos ou substitua materiais extensos por links e envie novamente.', 'error');
        return;
      }
      const response = await fetch('/api/briefing-aula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      const responseErrors = {
        413: 'As respostas ultrapassam o limite total de texto. Resuma os trechos mais longos ou use links e envie novamente.',
        422: 'O envio contém respostas inválidas. Confira os campos obrigatórios e o limite de 3.000 caracteres por resposta, depois envie novamente.',
        409: 'Não foi possível usar o protocolo deste envio. Suas respostas foram mantidas. Clique em enviar novamente para gerar um novo protocolo.',
        400: 'Não foi possível validar este envio. Confira as respostas e tente novamente.',
        503: 'O serviço de envio está temporariamente indisponível. Suas respostas foram mantidas. Tente novamente mais tarde.',
      };
      if (responseErrors[response.status]) {
        if (response.status === 409) pending = null;
        saveDraft();
        showStatus(responseErrors[response.status], 'error');
        return;
      }
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.id !== requestId) throw new Error('unconfirmed');
      receipt = { id: requestId };
      pending = null;
      const changed = JSON.stringify(answers()) !== snapshot;
      saveDraft();
      showStatus(`Respostas gravadas com sucesso. Protocolo: ${requestId}.${changed ? ' Você alterou respostas durante o envio. Envie uma atualização para gravar essas alterações.' : ' Você pode fechar esta página ou enviar uma atualização.'}`, 'success');
    } catch {
      showStatus('Não foi possível confirmar o envio. Suas respostas continuam no formulário. Confira a conexão e tente enviar novamente.', 'error');
      saveDraft();
    } finally {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.textContent = receipt ? 'Enviar atualização' : 'Enviar briefing';
    }
  }

  restoreDraft();
  form.addEventListener('submit', sendBriefing);
  button.disabled = false;
})();
