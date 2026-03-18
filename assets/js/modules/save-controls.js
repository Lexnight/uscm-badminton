
import { getState, setState, importState } from './app.js';

function sanitizeFileName(value) {
  return String(value || 'Tournoi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Tournoi';
}

function formatSaveStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function exportTournamentState() {
  const snapshot = {
    ...getState(),
    updatedAt: new Date().toISOString(),
    meta: {
      source: 'Badminton Tournoi Pro',
      exportedAt: new Date().toISOString()
    }
  };
  const fileName = `${sanitizeFileName(snapshot.settings?.tournamentName || 'Tournoi')}_${formatSaveStamp(new Date())}.json`;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

function setSidebarStatus(message = '', type = 'success') {
  const status = document.getElementById('sidebar-save-status');
  if (!status) return;
  status.textContent = message;
  status.className = `sidebar-save-status ${type} ${message ? 'show' : ''}`;
  window.clearTimeout(setSidebarStatus._timer);
  if (message) {
    setSidebarStatus._timer = window.setTimeout(() => {
      const node = document.getElementById('sidebar-save-status');
      if (node) {
        node.textContent = '';
        node.className = 'sidebar-save-status';
      }
    }, 2600);
  }
}

export function bindSidebarPersistence() {
  const saveBtn = document.getElementById('sidebar-save');
  const exportBtn = document.getElementById('sidebar-export');
  const importBtn = document.getElementById('sidebar-import');
  const importInput = document.getElementById('sidebar-import-input');

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', () => {
      setState({ ...getState() });
      setSidebarStatus('Saved', 'success');
    });
  }

  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', () => {
      exportTournamentState();
      setSidebarStatus('Export OK', 'success');
    });
  }

  if (importBtn && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', () => {
      importInput?.click();
    });
  }

  if (importInput && !importInput.dataset.bound) {
    importInput.dataset.bound = '1';
    importInput.addEventListener('change', async (event) => {
      const input = event.currentTarget;
      const file = input?.files?.[0];
      if (!file) return;
      try {
        const content = await file.text();
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON');
        }
        importState(parsed);
        setSidebarStatus('Import OK', 'success');
      } catch (error) {
        console.error(error);
        setSidebarStatus('Import fail', 'error');
      } finally {
        if (input) input.value = '';
      }
    });
  }
}
