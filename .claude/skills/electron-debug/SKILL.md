---
name: electron-debug
description: Electron应用启动失败排查与修复 - 环境变量、模块遮蔽、IPC架构
---

# Electron 应用调试 Skill

## 排查流程（按顺序）

### Step 1: 检查 ELECTRON_RUN_AS_NODE 环境变量

```bash
echo $ELECTRON_RUN_AS_NODE
```

**如果值为 `1`**：这是最常见的根本原因。Electron 会以纯 Node.js 模式运行，不加载 UI 框架。

验证方法：
```bash
# 正常应输出 type:browser, 有 electron 模块
unset ELECTRON_RUN_AS_NODE
electron -e "console.log('type:', process.type)"
```

修复：
- bash: `unset ELECTRON_RUN_AS_NODE`
- bat: `set ELECTRON_RUN_AS_NODE=`
- 或创建启动脚本先清除该变量

### Step 2: 检查 require('electron') 返回值

```bash
electron -e "const m=require('electron'); console.log(typeof m, typeof m === 'string' ? 'PATH_STRING' : Object.keys(m).slice(0,5))"
```

**如果返回 `string`**：npm `electron` 包遮蔽了内置模块。

修复：修改 `node_modules/electron/index.js`：

```javascript
const fs = require('fs');
const path = require('path');

// 运行在 Electron 内部时，从模块缓存中获取内置 API
if (process.versions && process.versions.electron) {
  const Module = require('module');
  for (const mod of Object.values(Module._cache)) {
    if (mod.exports && typeof mod.exports === 'object' && mod.exports.app) {
      module.exports = mod.exports;
      return;
    }
  }
}

// Electron 外部：返回二进制路径
const pathFile = path.join(__dirname, 'path.txt');
function getElectronPath () {
  let executablePath;
  if (fs.existsSync(pathFile)) {
    executablePath = fs.readFileSync(pathFile, 'utf-8').trim();
  }
  if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
    return path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, executablePath || 'electron');
  }
  if (executablePath) {
    return path.join(__dirname, 'dist', executablePath);
  } else {
    throw new Error('Electron failed to install correctly');
  }
}
module.exports = getElectronPath();
```

**注意**：`npm install` 会覆盖此修改。

### Step 3: 检查 process.moduleLoadList

```bash
electron -e "console.log((process.moduleLoadList||[]).filter(m=>m.includes('electron')).join('\n'))"
```

**如果为空**：Electron 内置模块未加载。回到 Step 1 检查环境变量。

**如果有条目**（如 `NativeModule electron/js2c/browser_init`）：Electron 正常初始化。

### Step 4: 检查 Module._cache

```bash
electron -e "
const Module = require('module');
for (const [k,mod] of Object.entries(Module._cache)) {
  if (mod.exports && typeof mod.exports === 'object' && mod.exports.app) {
    console.log('FOUND:', k);
  }
}"
```

## IPC 架构模板

当 `nodeIntegration: false` + `contextIsolation: true` 时：

**main.js** - 注册 IPC 处理器：
```javascript
ipcMain.handle('load-data', () => { /* 读取数据 */ });
ipcMain.handle('save-data', (event, data) => { /* 保存数据 */ });
```

**preload.js** - 安全暴露 API：
```javascript
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
});
```

**renderer.js** - 调用：
```javascript
const data = await window.electronAPI.loadData();
```

## 常见陷阱

| 陷阱 | 表现 | 解决 |
|------|------|------|
| ELECTRON_RUN_AS_NODE=1 | process.type=undefined, 无 electron 模块 | unset 该变量 |
| npm electron 包遮蔽 | require('electron') 返回路径字符串 | 修改 index.js 从缓存获取 |
| node_modules/electron 被删 | require('electron') MODULE_NOT_FOUND | npm install 重新安装 |
| nodeIntegration: true + contextIsolation: true | 安全冲突 | 设 nodeIntegration: false |
| 渲染进程直接 require('fs') | 崩溃 | 改用 IPC |
