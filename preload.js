const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  closeQuickCapture: () => ipcRenderer.invoke('close-quick-capture'),

  // Data operations
  loadData: () => ipcRenderer.invoke('load-data'),
  saveAllData: (newData) => ipcRenderer.invoke('save-all-data', newData),
  addTask: (quadrant, task) => ipcRenderer.invoke('add-task', quadrant, task),
  updateTask: (taskId, updates) => ipcRenderer.invoke('update-task', taskId, updates),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  completeTask: (taskId) => ipcRenderer.invoke('complete-task', taskId),
  moveTask: (taskId, fromQ, toQ) => ipcRenderer.invoke('move-task', taskId, fromQ, toQ),
  reorderTasks: (quadrant, orderedIds) => ipcRenderer.invoke('reorder-tasks', quadrant, orderedIds),
  searchTasks: (query) => ipcRenderer.invoke('search-tasks', query),
  getOverdueTasks: () => ipcRenderer.invoke('get-overdue-tasks'),
  getUpcomingTasks: (days) => ipcRenderer.invoke('get-upcoming-tasks', days),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  getStats: () => ipcRenderer.invoke('get-stats'),
  addTag: (tag) => ipcRenderer.invoke('add-tag', tag),
  removeTag: (tag) => ipcRenderer.invoke('remove-tag', tag),
  exportData: (filePath, format) => ipcRenderer.invoke('export-data', filePath, format),
  importData: (filePath) => ipcRenderer.invoke('import-data', filePath),
  createBackup: () => ipcRenderer.invoke('create-backup'),
  getBackupList: () => ipcRenderer.invoke('get-backup-list'),
  restoreBackup: (filePath) => ipcRenderer.invoke('restore-backup', filePath)
});
