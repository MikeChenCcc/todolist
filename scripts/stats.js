const Stats = (() => {
  function init() {
    updateStats();
    setInterval(updateStats, 60000);
  }

  function updateStats() {
    const stats = Storage.getStats();
    renderStats(stats);
  }

  function renderStats(stats) {
    const container = document.getElementById('stats-panel');
    if (!container) return;

    let content = container.querySelector('.stats-content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'stats-content';
      container.appendChild(content);
    }

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">待办任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.completed}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.todayCompleted}</div>
          <div class="stat-label">今日完成</div>
        </div>
        <div class="stat-card ${stats.overdue > 0 ? 'stat-warning' : ''}">
          <div class="stat-value">${stats.overdue}</div>
          <div class="stat-label">已过期</div>
        </div>
      </div>
      <div class="stats-chart">
        <h4>象限分布</h4>
        <div class="quadrant-bars">
          <div class="bar-item">
            <span class="bar-label">紧急重要</span>
            <div class="bar-track">
              <div class="bar-fill q1" style="width: ${getPercent(stats.byQuadrant.q1, stats.total)}%"></div>
            </div>
            <span class="bar-value">${stats.byQuadrant.q1}</span>
          </div>
          <div class="bar-item">
            <span class="bar-label">重要不紧急</span>
            <div class="bar-track">
              <div class="bar-fill q2" style="width: ${getPercent(stats.byQuadrant.q2, stats.total)}%"></div>
            </div>
            <span class="bar-value">${stats.byQuadrant.q2}</span>
          </div>
          <div class="bar-item">
            <span class="bar-label">紧急不重要</span>
            <div class="bar-track">
              <div class="bar-fill q3" style="width: ${getPercent(stats.byQuadrant.q3, stats.total)}%"></div>
            </div>
            <span class="bar-value">${stats.byQuadrant.q3}</span>
          </div>
          <div class="bar-item">
            <span class="bar-label">不紧急不重要</span>
            <div class="bar-track">
              <div class="bar-fill q4" style="width: ${getPercent(stats.byQuadrant.q4, stats.total)}%"></div>
            </div>
            <span class="bar-value">${stats.byQuadrant.q4}</span>
          </div>
        </div>
      </div>
    `;
  }

  function getPercent(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  function getDailySummary() {
    const stats = Storage.getStats();
    return {
      date: new Date().toLocaleDateString('zh-CN'),
      total: stats.total,
      completed: stats.todayCompleted,
      overdue: stats.overdue,
      completionRate: stats.total > 0 ? Math.round((stats.completed / (stats.total + stats.completed)) * 100) : 0
    };
  }

  return { init, updateStats, getDailySummary };
})();
