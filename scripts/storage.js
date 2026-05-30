const Storage = (() => {
  let data = null;

  async function init() {
    data = await window.electronAPI.loadData();
    return data;
  }

  function getData() {
    return data;
  }

  function setData(newData) {
    data = newData;
    syncToMain();
  }

  function syncToMain() {
    window.electronAPI.saveAllData(data);
  }

  function addTask(quadrant, task) {
    const newTask = {
      id: crypto.randomUUID(),
      title: task.title || '',
      desc: task.desc || '',
      priority: task.priority || 'medium',
      tags: task.tags || [],
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
      dueDate: task.dueDate || null,
      recurring: task.recurring || null,
      pomodoroCount: 0,
      pomodoroTarget: task.pomodoroTarget || 0,
      subtasks: task.subtasks || [],
      order: data[quadrant] ? data[quadrant].length : 0
    };
    if (!data[quadrant]) data[quadrant] = [];
    data[quadrant].push(newTask);
    window.electronAPI.addTask(quadrant, task);
    return newTask;
  }

  function updateTask(taskId, updates) {
    for (const q of ['q1', 'q2', 'q3', 'q4', 'completed']) {
      const idx = data[q].findIndex(t => t.id === taskId);
      if (idx !== -1) {
        data[q][idx] = { ...data[q][idx], ...updates };
        window.electronAPI.updateTask(taskId, updates);
        return data[q][idx];
      }
    }
    return null;
  }

  function deleteTask(taskId) {
    for (const q of ['q1', 'q2', 'q3', 'q4', 'completed']) {
      const idx = data[q].findIndex(t => t.id === taskId);
      if (idx !== -1) {
        const removed = data[q].splice(idx, 1)[0];
        window.electronAPI.deleteTask(taskId);
        return removed;
      }
    }
    return null;
  }

  function completeTask(taskId) {
    for (const q of ['q1', 'q2', 'q3', 'q4']) {
      const idx = data[q].findIndex(t => t.id === taskId);
      if (idx !== -1) {
        const task = data[q].splice(idx, 1)[0];
        task.completed = true;
        task.completedAt = Date.now();
        data.completed.unshift(task);
        window.electronAPI.completeTask(taskId);
        return task;
      }
    }
    return null;
  }

  function moveTask(taskId, fromQuadrant, toQuadrant) {
    const fromIdx = data[fromQuadrant].findIndex(t => t.id === taskId);
    if (fromIdx === -1) return null;
    const task = data[fromQuadrant].splice(fromIdx, 1)[0];
    data[toQuadrant].push(task);
    window.electronAPI.moveTask(taskId, fromQuadrant, toQuadrant);
    return task;
  }

  function reorderTasks(quadrant, orderedIds) {
    if (!data[quadrant]) return;
    const taskMap = new Map(data[quadrant].map(t => [t.id, t]));
    data[quadrant] = orderedIds.map(id => taskMap.get(id)).filter(Boolean);
    data[quadrant].forEach((t, i) => t.order = i);
    window.electronAPI.reorderTasks(quadrant, orderedIds);
  }

  function getAllTasks() {
    const all = [];
    ['q1', 'q2', 'q3', 'q4'].forEach(q => {
      data[q].forEach(t => all.push({ ...t, quadrant: q }));
    });
    return all;
  }

  function searchTasks(query) {
    const q = query.toLowerCase();
    return getAllTasks().filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }

  function getTasksByTag(tag) {
    return getAllTasks().filter(t => t.tags.includes(tag));
  }

  function getTasksByDueDate(date) {
    const target = new Date(date).toDateString();
    return getAllTasks().filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === target;
    });
  }

  function getOverdueTasks() {
    const now = Date.now();
    return getAllTasks().filter(t => t.dueDate && t.dueDate < now && !t.completed);
  }

  function getUpcomingTasks(days = 7) {
    const now = Date.now();
    const future = now + days * 24 * 60 * 60 * 1000;
    return getAllTasks().filter(t => t.dueDate && t.dueDate >= now && t.dueDate <= future);
  }

  function addTag(tag) {
    if (!data.tags.includes(tag)) {
      data.tags.push(tag);
      window.electronAPI.addTag(tag);
    }
  }

  function removeTag(tag) {
    data.tags = data.tags.filter(t => t !== tag);
    window.electronAPI.removeTag(tag);
  }

  function updateSettings(settings) {
    data.settings = { ...data.settings, ...settings };
    window.electronAPI.updateSettings(settings);
  }

  function getSettings() {
    return data.settings;
  }

  async function exportData(filePath, format = 'json') {
    return window.electronAPI.exportData(filePath, format);
  }

  async function importData(filePath) {
    const result = await window.electronAPI.importData(filePath);
    if (result) {
      data = await window.electronAPI.loadData();
    }
    return result;
  }

  async function createBackup() {
    return window.electronAPI.createBackup();
  }

  async function getBackupList() {
    return window.electronAPI.getBackupList();
  }

  async function restoreBackup(filePath) {
    const result = await window.electronAPI.restoreBackup(filePath);
    if (result) {
      data = await window.electronAPI.loadData();
    }
    return result;
  }

  function getStats() {
    const stats = {
      total: 0,
      completed: data.completed.length,
      byQuadrant: { q1: 0, q2: 0, q3: 0, q4: 0 },
      byPriority: { high: 0, medium: 0, low: 0 },
      overdue: 0,
      todayCompleted: 0,
      weekCompleted: 0
    };
    const now = new Date();
    const today = now.toDateString();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    ['q1', 'q2', 'q3', 'q4'].forEach(q => {
      stats.byQuadrant[q] = data[q].length;
      stats.total += data[q].length;
      data[q].forEach(t => {
        if (t.priority) stats.byPriority[t.priority]++;
        if (t.dueDate && t.dueDate < now.getTime()) stats.overdue++;
      });
    });
    data.completed.forEach(t => {
      if (t.completedAt) {
        if (new Date(t.completedAt).toDateString() === today) stats.todayCompleted++;
        if (t.completedAt > weekAgo) stats.weekCompleted++;
      }
    });
    return stats;
  }

  return {
    init, getData, setData,
    addTask, updateTask, deleteTask, completeTask,
    moveTask, reorderTasks, getAllTasks, searchTasks,
    getTasksByTag, getTasksByDueDate,
    getOverdueTasks, getUpcomingTasks,
    addTag, removeTag,
    updateSettings, getSettings,
    exportData, importData,
    createBackup, getBackupList, restoreBackup,
    getStats
  };
})();
