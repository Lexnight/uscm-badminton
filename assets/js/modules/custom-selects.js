
let globalBound = false;

function closeAllCustomSelects(except = null) {
  document.querySelectorAll('.custom-select.is-open').forEach((node) => {
    if (except && node === except) return;
    node.classList.remove('is-open');
    const trigger = node.querySelector('.custom-select-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
}

function buildCustomSelect(select) {
  if (!select || select.dataset.customSelectReady === '1') return;
  select.dataset.customSelectReady = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';
  wrapper.tabIndex = -1;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const triggerLabel = document.createElement('span');
  triggerLabel.className = 'custom-select-label';
  trigger.appendChild(triggerLabel);

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-chevron-down';
  icon.setAttribute('aria-hidden', 'true');
  trigger.appendChild(icon);

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');

  const updateTriggerLabel = () => {
    const selectedOption = select.options[select.selectedIndex];
    triggerLabel.textContent = selectedOption ? selectedOption.textContent : 'Choisir';
  };

  const rebuildOptions = () => {
    menu.innerHTML = '';
    Array.from(select.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.textContent = option.textContent;
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
      if (option.disabled) {
        item.disabled = true;
      }
      if (option.selected) {
        item.classList.add('is-selected');
      }
      item.addEventListener('click', () => {
        if (option.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        rebuildOptions();
        updateTriggerLabel();
        wrapper.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(item);
    });
  };

  select.style.display = 'none';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  updateTriggerLabel();
  rebuildOptions();

  trigger.addEventListener('click', () => {
    const willOpen = !wrapper.classList.contains('is-open');
    closeAllCustomSelects(wrapper);
    wrapper.classList.toggle('is-open', willOpen);
    trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  select.addEventListener('change', () => {
    updateTriggerLabel();
    rebuildOptions();
  });
}

export function bindCustomSelects(root = document) {
  root.querySelectorAll('select').forEach(buildCustomSelect);

  if (!globalBound) {
    globalBound = true;
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.custom-select')) {
        closeAllCustomSelects();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAllCustomSelects();
      }
    });
  }
}
