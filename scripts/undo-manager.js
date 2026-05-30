const UndoManager = (() => {
  const undoStack = [];
  const redoStack = [];
  const maxSize = 50;

  function pushState(state) {
    undoStack.push(JSON.parse(JSON.stringify(state)));
    if (undoStack.length > maxSize) undoStack.shift();
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length === 0) return null;
    const state = undoStack.pop();
    redoStack.push(JSON.parse(JSON.stringify(Storage.getData())));
    Storage.setData(state);
    return state;
  }

  function redo() {
    if (redoStack.length === 0) return null;
    const state = redoStack.pop();
    undoStack.push(JSON.parse(JSON.stringify(Storage.getData())));
    Storage.setData(state);
    return state;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function clear() {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          const state = undo();
          if (state) {
            window.dispatchEvent(new CustomEvent('undo', { detail: state }));
          }
        }
        if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          const state = redo();
          if (state) {
            window.dispatchEvent(new CustomEvent('redo', { detail: state }));
          }
        }
      }
    });

    window.addEventListener('undo', () => {
      if (typeof App !== 'undefined') {
        App.renderAllTasks();
        App.initSortable();
      }
    });

    window.addEventListener('redo', () => {
      if (typeof App !== 'undefined') {
        App.renderAllTasks();
        App.initSortable();
      }
    });
  }

  return { pushState, undo, redo, canUndo, canRedo, clear, init };
})();
