/* Apenas apresentação do menu. Os filtros, consultas e ações de cada página continuam nos scripts existentes. */
(() => {
  document.querySelectorAll('[data-admin-sidebar]').forEach((sidebar) => {
    const toggle = sidebar.querySelector('.admin-menu-toggle');
    const menu = sidebar.querySelector('.admin-sidebar-menu');
    const close = () => {
      sidebar.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Abrir menu';
    };
    toggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Fechar menu' : 'Abrir menu';
    });
    sidebar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });
    menu.addEventListener('click', (event) => {
      const control = event.target.closest('a,button');
      if (!control) return;
      close();
      const hash = control.getAttribute('href');
      const target = control.matches('.tab-btn')
        ? document.querySelector('.tab-panel.active')
        : hash?.startsWith('#') ? document.getElementById(hash.slice(1)) : null;
      if (control.matches('.tab-btn')) {
        menu.querySelectorAll('.tab-btn').forEach((button) => {
          if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
          else button.removeAttribute('aria-current');
        });
      }
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });
})();
