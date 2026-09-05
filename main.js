const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 后端可执行文件路径：位于根目录 bin 下，Windows 为 backend.exe，其他平台为 backend。
const backendPath = path.join(__dirname, 'bin', process.platform === 'win32' ? 'backend.exe' : 'backend');

/**
 * 创建主应用窗口。
 * 执行流程：
 * 1. 创建 800×600 的 BrowserWindow，启用 contextIsolation 并挂载预加载脚本；
 * 2. 加载 index.html 作为窗口内容。
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
}

/**
 * 启动后端程序并等待执行完成。
 * 入参：folderPath —— 传递给后端的文件夹路径。
 * 处理步骤：
 * 1. 以 folderPath 为命令行参数异步启动 backend.exe（隐藏控制台窗口，超时 30 秒）；
 * 2. 通过回调判断执行结果：出错（含非 0 退出码）则 reject，成功则收集 stdout。
 * 返回值：Promise —— 成功解析为后端 stdout 文案（已去首尾空白），失败则 reject。
 */
function runBackend(folderPath) {
  return new Promise((resolve, reject) => {
    execFile(backendPath, [folderPath], { timeout: 30000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const detail = stderr ? `：${stderr.trim()}` : '';
        reject(new Error(`后端执行失败${detail}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * 处理渲染进程发来的“选择文件夹”请求。
 * 入参：无（通过 IPC 事件触发）。
 * 处理步骤：
 * 1. 弹出系统文件夹选择对话框；
 * 2. 判断用户是否取消选择。
 * 返回值：所选文件夹的绝对路径；用户取消时返回 null。
 */
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择文件夹',
    properties: ['openDirectory']
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

/**
 * 处理渲染进程发来的“扫描文件夹”请求。
 * 入参：folderPath —— 待扫描的文件夹绝对路径。
 * 处理步骤：
 * 1. 校验路径有效且为已存在的目录；
 * 2. 校验后端程序存在，缺失时返回构建提示；
 * 3. 调用 runBackend 启动后端并等待输出。
 * 返回值：{ ok: true, text: 输出文案 } 或 { ok: false, text: 错误说明 }。
 */
ipcMain.handle('scan-folder', async (event, folderPath) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { ok: false, text: '文件夹路径无效或不存在' };
    }
    if (!fs.existsSync(backendPath)) {
      return { ok: false, text: '未找到后端程序，请先在 go 目录执行：go build -o backend.exe main.go' };
    }
    const text = await runBackend(folderPath);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, text: err.message || String(err) };
  }
});

// 在主进程控制台打印启动日志。
console.log('app start');

// Electron 就绪后创建窗口。
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 所有窗口关闭时退出应用（macOS 除外）。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});