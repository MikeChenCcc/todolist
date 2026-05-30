# 四象限时间管理工具

## 项目结构
- `main.js` - Electron 主进程，IPC 处理器
- `preload.js` - contextBridge 安全暴露 API
- `scripts/storage.js` - 渲染进程数据层，使用 window.electronAPI
- `index.html` - 主界面
- `quick-capture.html` - 快速捕获窗口

## 启动方式
```bash
# 必须先清除环境变量
unset ELECTRON_RUN_AS_NODE
electron .
# 或直接双击 start.bat
```

## Skills
- `.claude/skills/electron-debug/` - Electron 启动问题排查
