const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

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