const Backup = (() => {
  let backupInterval = null;

  function init() {
    const settings = Storage.getSettings();
    if (settings.autoBackup) {
      startAutoBackup(settings.backupInterval || 86400000);
    }
  }

  function startAutoBackup(interval = 86400000) {
    if (backupInterval) clearInterval(backupInterval);
    backupInterval = setInterval(async () => {
      await createBackup();
    }, interval);
  }

  function stopAutoBackup() {
    if (backupInterval) {
      clearInterval(backupInterval);
      backupInterval = null;
    }
  }

  async function createBackup() {
    const result = await Storage.createBackup();
    if (result) {
      console.log('Backup created:', result);
    }
    return result;
  }

  async function restoreBackup(filePath) {
    return await Storage.restoreBackup(filePath);
  }

  function getBackupList() {
    return Storage.getBackupList();
  }

  return { init, startAutoBackup, stopAutoBackup, createBackup, restoreBackup, getBackupList };
})();
