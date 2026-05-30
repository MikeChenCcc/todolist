const App = (() => {
  let data = null;
  let sortableInstances = [];
  let editingTaskId = null;
  let deleteConfirmCallback = null;

  async function init() {
    data = await Storage.init();
    initUI();
    initEvents();
    initTitlebar();
    initTheme();
    initViewMode();
    renderAllTasks();
    initSortable();
    startDueDateChecker();

    UndoManager.init();
    Pomodoro.init();
    Stats.init();
    Search.init();
    Backup.init();
  }

  function initUI() {
    document.getElementById('btn-add-task').addEventListener('click', () => openTaskModal());
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
    document.getElementById('modal-close').addEventListener('click', closeTaskModal);
    document.getElementById('btn-cancel').addEventListener('click', closeTaskModal);
    document.getElementById('confirm-cancel').addEventListener('click', closeConfirmModal);
    document.getElementById('confirm-ok').addEventListener('click', () => {
      if (deleteConfirmCallback) deleteConfirmCallback();
      closeConfirmModal();
    });

    document.getElementById('btn-parse').addEventListener('click', () => {
      const titleInput = document.getElementById('task-title');
      const parsed = TaskParser.parse(titleInput.value);
      if (parsed.title) titleInput.value = parsed.title;
      if (parsed.priority) document.getElementById('task-priority').value = parsed.priority;
      if (parsed.dueDate) document.getElementById('task-due').value = new Date(parsed.dueDate).toISOString().slice(0, 16);
      if (parsed.tags.length) {
        const existing = document.getElementById('task-tags').value;
        const merged = existing ? existing + ', ' + parsed.tags.join(', ') : parsed.tags.join(', ');
        document.getElementById('task-tags').value = merged;
      }
    });

    document.querySelectorAll('.q-select').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.q-select').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('task-quadrant').value = btn.dataset.q;
      });
    });

    document.getElementById('task-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeTaskModal();
    });
    document.getElementById('confirm-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeConfirmModal();
    });

    document.getElementById('btn-stats').addEventListener('click', () => {
      document.getElementById('stats-panel').classList.toggle('show');
    });
    document.getElementById('stats-close').addEventListener('click', () => {
      document.getElementById('stats-panel').classList.remove('show');
    });

    document.getElementById('btn-backup').addEventListener('click', () => {
      const panel = document.getElementById('backup-panel');
      panel.classList.toggle('show');
      if (panel.classList.contains('show')) loadBackupList();
    });
    document.getElementById('backup-close').addEventListener('click', () => {
      document.getElementById('backup-panel').classList.remove('show');
    });
    document.getElementById('btn-create-backup').addEventListener('click', async () => {
      const result = await Backup.createBackup();
      if (result) loadBackupList();
    });
  }

  function initEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            openTaskModal();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('search-input').focus();
            break;
          case 'i':
            e.preventDefault();
            document.getElementById('stats-panel').classList.toggle('show');
            break;
        }
      }
      if (e.key === 'Escape') {
        closeTaskModal();
        closeConfirmModal();
      }
    });

  }

  function initTitlebar() {
    document.getElementById('btn-minimize').addEventListener('click', () => window.electronAPI.minimizeWindow());
    document.getElementById('btn-maximize').addEventListener('click', () => window.electronAPI.maximizeWindow());
    document.getElementById('btn-close').addEventListener('click', () => window.electronAPI.closeWindow());
  }

  function initTheme() {
    const savedTheme = data.settings.theme || 'system';
    applyTheme(savedTheme);

    document.getElementById('btn-theme').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Storage.updateSettings({ theme: next });
    });

    if (savedTheme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (data.settings.theme === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
      document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
    }
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function initViewMode() {
    const savedMode = data.settings.viewMode || 'classic';
    applyViewMode(savedMode);

    document.querySelectorAll('.view-btn').forEach(btn => {
      if (btn.dataset.mode === savedMode) btn.classList.add('active');
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyViewMode(btn.dataset.mode);
        Storage.updateSettings({ viewMode: btn.dataset.mode });
      });
    });
  }

  function applyViewMode(mode) {
    const container = document.getElementById('quadrant-container');
    container.classList.remove('list-view', 'compact-view');
    if (mode === 'list') container.classList.add('list-view');
    if (mode === 'compact') container.classList.add('compact-view');
  }

  function renderAllTasks() {
    data = Storage.getData();
    document.getElementById('search-input').value = '';
    ['q1', 'q2', 'q3', 'q4'].forEach(q => renderQuadrant(q));
    updateCounts();
  }

  function renderQuadrant(quadrant) {
    const list = document.getElementById(`list-${quadrant}`);
    list.innerHTML = '';
    const tasks = data[quadrant] || [];
    tasks.forEach(task => {
      list.appendChild(createTaskCard(task, quadrant));
    });
  }

  function createTaskCard(task, quadrant) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}`;
    card.dataset.id = task.id;
    card.dataset.quadrant = quadrant;

    const dueDateStr = task.dueDate ? formatDueDate(task.dueDate) : '';
    const isOverdue = task.dueDate && task.dueDate < Date.now() && !task.completed;

    card.innerHTML = `
      <div class="task-card-header">
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}"></div>
        <div class="task-card-content">
          <div class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
          ${task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : ''}
          <div class="task-meta">
            ${task.tags.map(t => `<span class="task-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}
            ${dueDateStr ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${dueDateStr}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn pomodoro" data-id="${task.id}" title="番茄钟">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="8" r="4" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="7" y1="8" x2="7" y2="5.5" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="8" x2="9" y2="8" stroke="currentColor" stroke-width="1.2"/><line x1="5" y1="2" x2="9" y2="2" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
          <button class="task-action-btn edit" data-id="${task.id}" title="编辑">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
          </button>
          <button class="task-action-btn delete" data-id="${task.id}" title="删除">
            <svg width="14" height="14" viewBox="0 0 14 14"><line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" stroke-width="1.5"/><line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector('.task-checkbox').addEventListener('click', (e) => {
      e.stopPropagation();
      handleComplete(task.id, quadrant, card);
    });

    card.querySelector('.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskModal(task, quadrant);
    });

    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(task.id, quadrant, card);
    });

    card.querySelector('.pomodoro').addEventListener('click', (e) => {
      e.stopPropagation();
      Pomodoro.startForTask(task.id, task.title);
    });

    card.addEventListener('dblclick', () => openTaskModal(task, quadrant));

    card.querySelectorAll('.task-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagValue = tag.dataset.tag;
        const searchInput = document.getElementById('search-input');
        if (searchInput.value === tagValue) {
          Search.clearFilters();
        } else {
          searchInput.value = tagValue;
          Search.filterByTag(tagValue);
        }
      });
    });

    return card;
  }

  function handleComplete(taskId, quadrant, card) {
    UndoManager.pushState(Storage.getData());
    card.classList.add('completing');
    setTimeout(() => {
      Storage.completeTask(taskId);
      renderAllTasks();
      initSortable();
    }, 300);
  }

  function handleDelete(taskId, quadrant, card) {
    showConfirmModal('确定要删除这个任务吗？', () => {
      UndoManager.pushState(Storage.getData());
      card.classList.add('removing');
      setTimeout(() => {
        Storage.deleteTask(taskId);
        renderAllTasks();
        initSortable();
      }, 200);
    });
  }

  function openTaskModal(task = null, quadrant = 'q2') {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('task-form');

    editingTaskId = task ? task.id : null;
    title.textContent = task ? '编辑任务' : '添加任务';

    document.getElementById('task-id').value = task ? task.id : '';
    document.getElementById('task-title').value = task ? task.title : '';
    document.getElementById('task-desc').value = task ? task.desc : '';
    document.getElementById('task-priority').value = task ? task.priority : 'medium';
    document.getElementById('task-due').value = task && task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '';
    document.getElementById('task-tags').value = task ? task.tags.join(', ') : '';

    const q = task ? quadrant : 'q2';
    document.getElementById('task-quadrant').value = q;
    document.querySelectorAll('.q-select').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.q === q);
    });

    modal.classList.add('show');
    setTimeout(() => document.getElementById('task-title').focus(), 100);
  }

  function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('show');
    editingTaskId = null;
  }

  function handleTaskSubmit(e) {
    e.preventDefault();

    const taskData = {
      title: document.getElementById('task-title').value.trim(),
      desc: document.getElementById('task-desc').value.trim(),
      priority: document.getElementById('task-priority').value,
      dueDate: document.getElementById('task-due').value ? new Date(document.getElementById('task-due').value).getTime() : null,
      tags: document.getElementById('task-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };

    const quadrant = document.getElementById('task-quadrant').value;

    UndoManager.pushState(Storage.getData());
    if (editingTaskId) {
      Storage.updateTask(editingTaskId, taskData);
    } else {
      Storage.addTask(quadrant, taskData);
    }

    closeTaskModal();
    renderAllTasks();
    initSortable();
  }

  function showConfirmModal(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('show');
    deleteConfirmCallback = callback;
  }

  function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('show');
    deleteConfirmCallback = null;
  }

  async function loadBackupList() {
    const list = document.getElementById('backup-list');
    const backups = await Backup.getBackupList();
    if (backups.length === 0) {
      list.innerHTML = '<div class="backup-empty">暂无备份</div>';
      return;
    }
    list.innerHTML = backups.map(b => {
      const time = new Date(b.time).toLocaleString('zh-CN');
      return `<div class="backup-item">
        <span class="backup-name">${b.name}</span>
        <span class="backup-time">${time}</span>
        <button class="btn btn-sm btn-secondary" data-path="${b.path}">恢复</button>
      </div>`;
    }).join('');
    list.querySelectorAll('button[data-path]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const success = await Backup.restoreBackup(btn.dataset.path);
        if (success) {
          renderAllTasks();
          initSortable();
          document.getElementById('backup-panel').classList.remove('show');
        }
      });
    });
  }

  function initSortable() {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    ['q1', 'q2', 'q3', 'q4'].forEach(q => {
      const el = document.getElementById(`list-${q}`);
      if (el) {
        const sortable = new Sortable(el, {
          group: 'tasks',
          animation: 200,
          ghostClass: 'sortable-ghost',
          chosenClass: 'sortable-chosen',
          dragClass: 'dragging',
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          onStart: (evt) => {
            evt.item.classList.add('dragging');
          },
          onEnd: (evt) => {
            evt.item.classList.remove('dragging');
            UndoManager.pushState(Storage.getData());
            const taskId = evt.item.dataset.id;
            const fromQ = evt.from.dataset.quadrant;
            const toQ = evt.to.dataset.quadrant;

            if (fromQ !== toQ) {
              Storage.moveTask(taskId, fromQ, toQ);
            }

            const orderedIds = Array.from(evt.to.children).map(c => c.dataset.id);
            Storage.reorderTasks(toQ, orderedIds);

            renderAllTasks();
            initSortable();
          }
        });
        sortableInstances.push(sortable);
      }
    });
  }

  function updateCounts() {
    ['q1', 'q2', 'q3', 'q4'].forEach(q => {
      const count = (data[q] || []).length;
      document.getElementById(`count-${q}`).textContent = count;
    });
  }

  function formatDueDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `已过期 ${Math.abs(days)} 天`;
    if (days === 0) return '今天';
    if (days === 1) return '明天';
    if (days <= 7) return `${days} 天后`;

    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function startDueDateChecker() {
    setInterval(() => {
      const overdue = Storage.getOverdueTasks();
      const upcoming = Storage.getUpcomingTasks(1);
      upcoming.forEach(task => {
        if (task.dueDate - Date.now() <= 15 * 60 * 1000) {
          window.electronAPI.showNotification('任务即将到期', `${task.title} 将在 15 分钟内到期`);
        }
      });
    }, 60000);
  }

  return { init, renderAllTasks, initSortable };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
