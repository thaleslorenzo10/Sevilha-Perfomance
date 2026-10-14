/* Configuração da turma e encerramento das inscrições no horário de Brasília. */
(function () {
  'use strict';
  var aula = window.AULA || {};
  var prazo = new Date(aula.encerramento).getTime();
  var data = new Date(aula.data + 'T12:00:00-03:00');
  document.querySelectorAll('#aula-data, [data-aula-data]').forEach(function (el) {
    el.textContent = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  });
  window.SP_inscricoesEncerradas = function () {
    return Number.isFinite(prazo) && Date.now() >= prazo;
  };
  function atualizarPrazo() {
    if (!window.SP_inscricoesEncerradas()) return;
    document.querySelectorAll('.open-modal, #submit-btn').forEach(function (el) {
      el.disabled = true;
      el.textContent = 'Inscrições encerradas';
    });
    if (typeof window.closeModal === 'function') window.closeModal();
  }
  atualizarPrazo();
  setInterval(atualizarPrazo, 30000);
  document.addEventListener('visibilitychange', atualizarPrazo);
})();
