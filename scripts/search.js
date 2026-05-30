const Search = (() => {
  let searchTimeout = null;

  function init() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(e.target.value);
      }, 200);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        performSearch('');
        searchInput.blur();
      }
    });
  }

  function performSearch(query) {
    const cards = document.querySelectorAll('.task-card');
    if (!query.trim()) {
      cards.forEach(c => c.style.display = '');
      return;
    }

    const results = Storage.searchTasks(query);
    const resultIds = new Set(results.map(t => t.id));

    cards.forEach(c => {
      c.style.display = resultIds.has(c.dataset.id) ? '' : 'none';
    });
  }

  function filterByTag(tag) {
    const cards = document.querySelectorAll('.task-card');
    if (!tag) {
      cards.forEach(c => c.style.display = '');
      return;
    }

    const results = Storage.getTasksByTag(tag);
    const resultIds = new Set(results.map(t => t.id));

    cards.forEach(c => {
      c.style.display = resultIds.has(c.dataset.id) ? '' : 'none';
    });
  }

  function filterByQuadrant(quadrant) {
    const cards = document.querySelectorAll('.task-card');
    if (!quadrant) {
      cards.forEach(c => c.style.display = '');
      return;
    }

    cards.forEach(c => {
      c.style.display = c.dataset.quadrant === quadrant ? '' : 'none';
    });
  }

  function filterByPriority(priority) {
    const cards = document.querySelectorAll('.task-card');
    if (!priority) {
      cards.forEach(c => c.style.display = '');
      return;
    }

    cards.forEach(c => {
      c.style.display = c.classList.contains(`priority-${priority}`) ? '' : 'none';
    });
  }

  function clearFilters() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.task-card').forEach(c => c.style.display = '');
  }

  return { init, performSearch, filterByTag, filterByQuadrant, filterByPriority, clearFilters };
})();
