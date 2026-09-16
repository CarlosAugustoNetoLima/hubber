

export function initPickers(root = document) {
  initDatepickers(root);
  initSelects(root);
}

function initDatepickers(root) {
  const inputs = Array.from(root.querySelectorAll('[data-datepicker]'));
  if (!inputs.length || !window.flatpickr) return;

  const instances = new Map();

  inputs.forEach((input) => {
    const fp = window.flatpickr(input, {
      locale: window.flatpickr.l10ns.pt,
      dateFormat: 'd/m/Y',
      minDate: 'today',
      allowInput: true,
      disableMobile: true,
      static: true,
      monthSelectorType: 'static',
      nextArrow: '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M6 3l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      prevArrow: '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M12 3L6 9l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    });
    instances.set(input.id, fp);
  });

  inputs.forEach((input) => {
    const afterId = input.dataset.datepickerAfter;
    const start = afterId && instances.get(afterId);
    if (!start) return;
    start.set('onChange', ([date]) => {
      instances.get(input.id).set('minDate', date || 'today');
    });
  });
}

function initSelects(root) {
  const selects = Array.from(root.querySelectorAll('[data-choices]'));
  if (!selects.length || !window.Choices) return;

  selects.forEach((select) => {
    new window.Choices(select, {
      searchEnabled: false,
      shouldSort: false,
      allowHTML: false,
      itemSelectText: '',
    });
    // O Lenis captura a roda do mouse da página inteira; sem este marcador
    // a lista do dropdown não rola.
    select.closest('.choices')
      ?.querySelector('.choices__list--dropdown .choices__list')
      ?.setAttribute('data-lenis-prevent', '');
  });
}
