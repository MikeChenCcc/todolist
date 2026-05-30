const Pomodoro = (() => {
  let timer = null;
  let timeLeft = 0;
  let isRunning = false;
  let currentPhase = 'work';
  let pomodoroCount = 0;
  let currentTaskId = null;
  let currentTaskTitle = '';
  let settings = {
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    longBreakInterval: 4
  };

  function init() {
    const savedSettings = Storage.getSettings();
    if (savedSettings) {
      settings.workDuration = (savedSettings.pomodoroWorkDuration || 1500000) / 1000;
      settings.breakDuration = (savedSettings.pomodoroBreakDuration || 300000) / 1000;
      settings.longBreakDuration = (savedSettings.pomodoroLongBreakDuration || 900000) / 1000;
      settings.longBreakInterval = savedSettings.pomodoroLongBreakInterval || 4;
    }

    timeLeft = settings.workDuration;
    updateDisplay();
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('pomodoro-start').addEventListener('click', toggle);
    document.getElementById('pomodoro-reset').addEventListener('click', reset);
    document.getElementById('pomodoro-close').addEventListener('click', () => {
      document.getElementById('pomodoro-panel').classList.remove('show');
    });
    document.getElementById('btn-pomodoro').addEventListener('click', () => {
      document.getElementById('pomodoro-panel').classList.toggle('show');
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        document.getElementById('pomodoro-panel').classList.toggle('show');
      }
    });
  }

  function toggle() {
    if (isRunning) {
      pause();
    } else {
      start();
    }
  }

  function start() {
    isRunning = true;
    document.getElementById('pomodoro-start').textContent = '暂停';
    document.getElementById('pomodoro-time').classList.add('running');

    timer = setInterval(() => {
      timeLeft--;
      updateDisplay();

      if (timeLeft <= 0) {
        clearInterval(timer);
        isRunning = false;
        onPhaseComplete();
      }
    }, 1000);
  }

  function pause() {
    isRunning = false;
    clearInterval(timer);
    document.getElementById('pomodoro-start').textContent = '继续';
    document.getElementById('pomodoro-time').classList.remove('running');
  }

  function reset() {
    clearInterval(timer);
    isRunning = false;
    currentPhase = 'work';
    timeLeft = settings.workDuration;
    currentTaskId = null;
    currentTaskTitle = '';
    document.getElementById('pomodoro-start').textContent = '开始';
    document.getElementById('pomodoro-time').classList.remove('running');
    updateDisplay();
  }

  function startForTask(taskId, taskTitle) {
    if (isRunning) {
      pause();
    }
    currentTaskId = taskId;
    currentTaskTitle = taskTitle;
    document.getElementById('pomodoro-panel').classList.add('show');
    reset();
    currentTaskId = taskId;
    currentTaskTitle = taskTitle;
    updateDisplay();
    start();
  }

  function onPhaseComplete() {
    document.getElementById('pomodoro-time').classList.remove('running');

    if (currentPhase === 'work') {
      pomodoroCount++;

      if (currentTaskId) {
        Storage.updateTask(currentTaskId, { pomodoroCount: pomodoroCount });
        window.electronAPI.showNotification('专注完成', `「${currentTaskTitle}」已完成 ${pomodoroCount} 个番茄`);
      } else {
        window.electronAPI.showNotification('专注完成', `已完成 ${pomodoroCount} 个番茄，休息一下吧！`);
      }

      if (pomodoroCount % settings.longBreakInterval === 0) {
        currentPhase = 'longBreak';
        timeLeft = settings.longBreakDuration;
      } else {
        currentPhase = 'break';
        timeLeft = settings.breakDuration;
      }
    } else {
      window.electronAPI.showNotification('休息结束', '开始下一个番茄吧！');
      currentPhase = 'work';
      timeLeft = settings.workDuration;
    }

    document.getElementById('pomodoro-start').textContent = '开始';
    updateDisplay();
  }

  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('pomodoro-time').textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const statusMap = {
      'work': '专注中',
      'break': '短休息',
      'longBreak': '长休息'
    };
    let status = statusMap[currentPhase] || '准备开始';
    if (currentTaskTitle && currentPhase === 'work') {
      status = `专注: ${currentTaskTitle}`;
    }
    document.getElementById('pomodoro-status').textContent = status;
  }

  function getStats() {
    return {
      pomodoroCount,
      currentPhase,
      isRunning,
      timeLeft
    };
  }

  return { init, toggle, start, pause, reset, getStats, startForTask };
})();
