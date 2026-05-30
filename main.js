const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let mainWindow;
let quickCaptureWindow;
let tray;

let dataPath = '';
let backupPath = '';
let saveTimer = null;
let data = null;

const defaultData = {
  version: '1.0.0',
  q1: [], q2: [], q3: [], q4: [],
  completed: [],
  tags: ['工作', '生活', '学习'],
  templates: [],
  pomodoroHistory: [],
  settings: {
    theme: 'system', sortBy: 'priority', notifications: true,
    startOnBoot: false, autoSave: true, autoBackup: true,
    backupInterval: 86400000, pomodoroWorkDuration: 1500000,
    pomodoroBreakDuration: 300000, pomodoroLongBreakDuration: 900000,
    pomodoroLongBreakInterval: 4, viewMode: 'classic',
    compactMode: false, showCompletedTasks: false
  }
};

function validateData(d) {
  if (!d || typeof d !== 'object') return false;
  return ['q1', 'q2', 'q3', 'q4', 'completed'].every(k => Array.isArray(d[k]));
}

function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(raw);
      data = validateData(parsed) ? parsed : { ...defaultData };
    } else {
      data = { ...defaultData };
      saveDataSync();
    }
  } catch (err) {
    console.error('Failed to load data:', err);
    data = { ...defaultData };
  }
}

function saveDataSync() {
  try {
    const dir = path.dirname(dataPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

function saveData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDataSync, 500);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    frame: false, titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createQuickCaptureWindow() {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.focus();
    return;
  }
  quickCaptureWindow = new BrowserWindow({
    width: 400, height: 200, frame: false, alwaysOnTop: true,
    resizable: false, skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  quickCaptureWindow.loadFile('quick-capture.html');
  quickCaptureWindow.on('blur', () => {
    if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) quickCaptureWindow.close();
  });
  quickCaptureWindow.on('closed', () => { quickCaptureWindow = null; });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: '打开主窗口', click: () => mainWindow && mainWindow.show() },
      { label: '快速添加任务', click: () => createQuickCaptureWindow() },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('四象限时间管理');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { if (mainWindow) mainWindow.show(); });
  } catch (err) {
    console.log('Tray icon not found, skipping tray creation');
  }
}

function registerGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+Q', () => createQuickCaptureWindow());
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
}

function registerIpcHandlers() {
  ipcMain.handle('get-data-path', () => dataPath);
  ipcMain.handle('get-backup-path', () => backupPath);
  ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.handle('close-window', () => { if (mainWindow) mainWindow.hide(); });
  ipcMain.handle('show-notification', (event, title, body) => {
    new Notification({ title, body }).show();
  });
  ipcMain.handle('close-quick-capture', () => {
    if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) quickCaptureWindow.close();
  });

  ipcMain.handle('load-data', () => JSON.parse(JSON.stringify(data)));

  ipcMain.handle('save-all-data', (event, newData) => {
    data = newData;
    saveData();
    return true;
  });

  ipcMain.handle('add-task', (event, quadrant, task) => {
    const newTask = {
      id: uuidv4(), title: task.title || '', desc: task.desc || '',
      priority: task.priority || 'medium', tags: task.tags || [],
      completed: false, createdAt: Date.now(), completedAt: null,
      dueDate: task.dueDate || null, recurring: task.recurring || null,
      pomodoroCount: 0, pomodoroTarget: task.pomodoroTarget || 0,
      subtasks: task.subtasks || [], order: data[quadrant] ? data[quadrant].length : 0
    };
    if (!data[quadrant]) data[quadrant] = [];
    data[quadrant].push(newTask);
    saveData();
    return newTask;
  });

  ipcMain.handle('update-task', (event, taskId, updates) => {
    for (const q of ['q1', 'q2', 'q3', 'q4', 'completed']) {
      const idx = data[q].findIndex(t => t.id === taskId);
      if (idx !== -1) { data[q][idx] = { ...data[q][idx], ...updates }; saveData(); return data[q][idx]; }
    }
    return null;
  });

  ipcMain.handle('delete-task', (event, taskId) => {
    for (const q of ['q1', 'q2', 'q3', 'q4', 'completed']) {
      const idx = data[q].findIndex(t => t.id === taskId);
      if (idx !== -1) { const removed = data[q].splice(idx, 1)[0]; saveData(); return removed; }
    }
    return null;
  });

  ipcMain.handle('complete-task', (event, taskId) => {
    for (const q of ['q1', 'q2', 'q3', 'q4']) {
      const idx = data[q].findIndex(t => t.id === taskId);
      if (idx !== -1) {
        const task = data[q].splice(idx, 1)[0];
        task.completed = true; task.completedAt = Date.now();
        data.completed.unshift(task); saveData(); return task;
      }
    }
    return null;
  });

  ipcMain.handle('move-task', (event, taskId, fromQ, toQ) => {
    const fromIdx = data[fromQ].findIndex(t => t.id === taskId);
    if (fromIdx === -1) return null;
    const task = data[fromQ].splice(fromIdx, 1)[0];
    data[toQ].push(task); saveData(); return task;
  });

  ipcMain.handle('reorder-tasks', (event, quadrant, orderedIds) => {
    if (!data[quadrant]) return;
    const taskMap = new Map(data[quadrant].map(t => [t.id, t]));
    data[quadrant] = orderedIds.map(id => taskMap.get(id)).filter(Boolean);
    data[quadrant].forEach((t, i) => t.order = i);
    saveData();
  });

  ipcMain.handle('search-tasks', (event, query) => {
    const q = query.toLowerCase();
    const all = [];
    ['q1', 'q2', 'q3', 'q4'].forEach(quadrant => data[quadrant].forEach(t => all.push({ ...t, quadrant })));
    return all.filter(t => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q)));
  });

  ipcMain.handle('get-overdue-tasks', () => {
    const now = Date.now();
    const all = []; ['q1', 'q2', 'q3', 'q4'].forEach(q => data[q].forEach(t => all.push(t)));
    return all.filter(t => t.dueDate && t.dueDate < now && !t.completed);
  });

  ipcMain.handle('get-upcoming-tasks', (event, days) => {
    const now = Date.now(); const future = now + (days || 7) * 24 * 60 * 60 * 1000;
    const all = []; ['q1', 'q2', 'q3', 'q4'].forEach(q => data[q].forEach(t => all.push(t)));
    return all.filter(t => t.dueDate && t.dueDate >= now && t.dueDate <= future);
  });

  ipcMain.handle('update-settings', (event, settings) => { data.settings = { ...data.settings, ...settings }; saveData(); });

  ipcMain.handle('get-stats', () => {
    const stats = { total: 0, completed: data.completed.length, byQuadrant: { q1: 0, q2: 0, q3: 0, q4: 0 }, byPriority: { high: 0, medium: 0, low: 0 }, overdue: 0, todayCompleted: 0, weekCompleted: 0 };
    const now = new Date(); const today = now.toDateString(); const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    ['q1', 'q2', 'q3', 'q4'].forEach(q => { stats.byQuadrant[q] = data[q].length; stats.total += data[q].length; data[q].forEach(t => { if (t.priority) stats.byPriority[t.priority]++; if (t.dueDate && t.dueDate < now.getTime()) stats.overdue++; }); });
    data.completed.forEach(t => { if (t.completedAt) { if (new Date(t.completedAt).toDateString() === today) stats.todayCompleted++; if (t.completedAt > weekAgo) stats.weekCompleted++; } });
    return stats;
  });

  ipcMain.handle('add-tag', (event, tag) => { if (!data.tags.includes(tag)) { data.tags.push(tag); saveData(); } });
  ipcMain.handle('remove-tag', (event, tag) => { data.tags = data.tags.filter(t => t !== tag); saveData(); });

  ipcMain.handle('export-data', (event, filePath, format) => {
    try {
      let content;
      if (format === 'json') { content = JSON.stringify(data, null, 2); }
      else if (format === 'csv') {
        const all = []; ['q1', 'q2', 'q3', 'q4'].forEach(q => data[q].forEach(t => all.push({ ...t, quadrant: q })));
        const headers = ['id', 'title', 'desc', 'priority', 'tags', 'completed', 'quadrant', 'dueDate', 'createdAt'];
        const rows = all.map(t => headers.map(h => { let val = t[h]; if (Array.isArray(val)) val = val.join(';'); if (typeof val === 'string' && val.includes(',')) val = `"${val}"`; return val; }).join(','));
        content = [headers.join(','), ...rows].join('\n');
      }
      fs.writeFileSync(filePath, content, 'utf-8'); return true;
    } catch (err) { console.error('Export failed:', err); return false; }
  });

  ipcMain.handle('import-data', (event, filePath) => {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8'); const imported = JSON.parse(raw);
      if (validateData(imported)) { data = imported; saveData(); return true; } return false;
    } catch (err) { console.error('Import failed:', err); return false; }
  });

  ipcMain.handle('create-backup', () => {
    try {
      if (!fs.existsSync(backupPath)) fs.mkdirSync(backupPath, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupPath, `backup-${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
      cleanOldBackups(); return backupFile;
    } catch (err) { console.error('Backup failed:', err); return null; }
  });

  ipcMain.handle('get-backup-list', () => {
    try {
      if (!fs.existsSync(backupPath)) return [];
      return fs.readdirSync(backupPath).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse()
        .map(f => ({ name: f, path: path.join(backupPath, f), time: fs.statSync(path.join(backupPath, f)).mtime }));
    } catch (err) { return []; }
  });

  ipcMain.handle('restore-backup', (event, filePath) => {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8'); const imported = JSON.parse(raw);
      if (validateData(imported)) { data = imported; saveData(); return true; } return false;
    } catch (err) { console.error('Restore failed:', err); return false; }
  });
}

function cleanOldBackups(keep = 7) {
  try {
    if (!fs.existsSync(backupPath)) return;
    const files = fs.readdirSync(backupPath).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
    if (files.length > keep) files.slice(keep).forEach(f => fs.unlinkSync(path.join(backupPath, f)));
  } catch (err) { console.error('Clean backups failed:', err); }
}

app.whenReady().then(() => {
  dataPath = path.join(app.getPath('userData'), 'tasks.json');
  backupPath = path.join(app.getPath('userData'), 'backups');
  loadData();
  registerIpcHandlers();
  createMainWindow();
  createTray();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createMainWindow(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
