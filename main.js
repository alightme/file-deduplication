const { app, BrowserWindow } = require('electron');
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

// 在主进程控制台打印 "Hello World"。
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