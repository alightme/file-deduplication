const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 后端可执行文件路径：位于根目录 bin 下，Windows 为 backend.exe，其他平台为 backend。
const backendPath = path.join(__dirname, 'bin', process.platform === 'win32' ? 'backend.exe' : 'backend');

// 最近一次成功扫描的文件夹路径，用于限定删除/打开/定位等操作的文件范围。
let lastScannedFolder = null;

/**
 * 创建主应用窗口。
 * 执行流程：
 * 1. 创建 800×600 的 BrowserWindow，启用 contextIsolation 并挂载预加载脚本；
 * 2. 加载 index.html 作为窗口内容。
 */
function createWindow() {
  // 应用图标路径：开发环境为项目根目录 build/icon.ico，打包后随资源复制到应用目录内相同相对位置。
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconPath,
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
 * 1. 以 folderPath 为命令行参数异步启动 backend.exe（隐藏控制台窗口，超时 5 分钟、输出缓冲 100 MB）；
 * 2. 解析后端 stdout 的 JSON 消息，校验 msgType=10000 后取出 data 字段。
 * 返回值：Promise —— 成功解析为重复分组二维数组（每组为重复文件对象列表），失败则 reject。
 */
function runBackend(folderPath) {
  return new Promise((resolve, reject) => {
    // 扫描大目录耗时可能较长，超时放宽至 5 分钟；扫描结果 JSON 可能较大，stdout 缓冲上限放宽至 100 MB。
    execFile(backendPath, [folderPath], { timeout: 300000, windowsHide: true, maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // stderr 有内容时优先展示后端原因；为空（如输出超限、超时被杀）时回退到 error.message，便于定位问题。
        const detail = stderr ? `：${stderr.trim()}` : (error.message || '');
        reject(new Error(`后端执行失败${detail ? '：' + detail : ''}`));
        return;
      }
      const raw = stdout.trim();
      try {
        const message = JSON.parse(raw);
        if (message.msgType !== 10000) {
          reject(new Error(`后端返回未知消息类型：${message.msgType}`));
          return;
        }
        resolve(message.data);
      } catch (parseErr) {
        reject(new Error(`后端返回内容不是合法 JSON：${raw}`));
      }
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
 * 3. 调用 runBackend 启动后端并等待输出；
 * 4. 成功后记录 lastScannedFolder，供后续删除/打开/定位操作校验路径范围。
 * 返回值：{ ok: true, groups: 重复分组二维数组 } 或 { ok: false, text: 错误说明 }。
 */
ipcMain.handle('scan-folder', async (event, folderPath) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return { ok: false, text: '文件夹路径无效或不存在' };
    }
    if (!fs.existsSync(backendPath)) {
      return { ok: false, text: '未找到后端程序，请先执行：npm run build:backend' };
    }
    const groups = await runBackend(folderPath);
    lastScannedFolder = folderPath;
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, text: err.message || String(err) };
  }
});

/**
 * 判断目标路径是否为最近扫描文件夹内的文件。
 * 入参：filePath —— 待校验的绝对路径。
 * 处理步骤：先要求绝对路径，再与“最近扫描文件夹 + 分隔符”前缀比较。
 * 返回值：位于扫描文件夹内返回 true，否则返回 false。
 */
function isInsideScannedFolder(filePath) {
  if (!lastScannedFolder || typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    return false;
  }
  const root = path.resolve(lastScannedFolder);
  const target = path.resolve(filePath);
  return target.startsWith(root + path.sep);
}

/**
 * 处理渲染进程发来的“打开文件”请求（使用系统默认程序打开）。
 * 入参：filePath —— 文件绝对路径（扫描结果中的完整路径）。
 * 处理步骤：
 * 1. 校验路径位于最近扫描文件夹内且为已存在的普通文件；
 * 2. 调用 shell.openPath 交由系统默认程序打开。
 * 返回值：{ ok: true } 或 { ok: false, text: 错误说明 }。
 */
ipcMain.handle('open-file', async (event, filePath) => {
  if (!isInsideScannedFolder(filePath)) {
    return { ok: false, text: '路径不在扫描范围内' };
  }
  try {
    if (!fs.statSync(filePath).isFile()) {
      return { ok: false, text: '不是普通文件' };
    }
  } catch (err) {
    return { ok: false, text: '文件不存在或已被删除' };
  }
  // openPath 成功时返回空字符串，失败时返回错误信息。
  const errorText = await shell.openPath(filePath);
  return errorText ? { ok: false, text: errorText } : { ok: true };
});

/**
 * 处理渲染进程发来的“在资源管理器中定位文件”请求。
 * 入参：filePath —— 文件绝对路径（扫描结果中的完整路径）。
 * 处理步骤：
 * 1. 校验路径位于最近扫描文件夹内；
 * 2. 文件仍存在时调用 shell.showItemInFolder 打开资源管理器并选中该文件；
 * 3. 文件已被删除（如已移入回收站）时，改为打开其所在目录，便于用户核对删除结果。
 * 返回值：{ ok: true } 或 { ok: false, text: 错误说明 }。
 */
ipcMain.handle('show-in-folder', async (event, filePath) => {
  if (!isInsideScannedFolder(filePath)) {
    return { ok: false, text: '路径不在扫描范围内' };
  }
  try {
    if (!fs.statSync(filePath).isFile()) {
      return { ok: false, text: '不是普通文件' };
    }
    // 文件仍存在：在资源管理器中定位并选中该文件。
    shell.showItemInFolder(filePath);
    return { ok: true };
  } catch (err) {
    // 文件不存在（可能已移入回收站）：打开所在目录，由用户自行核对。
    const errorText = await shell.openPath(path.dirname(filePath));
    return errorText ? { ok: false, text: errorText } : { ok: true };
  }
});

/**
 * 处理渲染进程发来的“批量删除文件”请求：把未勾选保留的文件移入系统回收站。
 * 入参：paths —— 需要删除（移入回收站）的文件绝对路径数组。
 * 处理步骤：
 * 1. 校验已执行过扫描且 paths 为合法非空数组；
 * 2. 逐路径校验位于扫描文件夹内且为已存在的普通文件（不满足则记为失败）；
 * 3. 逐个调用 shell.trashItem 移入回收站，并用 Promise.allSettled 汇总成功与失败。
 * 返回值：{ ok: true, deleted: 成功数量, failed: [{ path, reason }] } 或 { ok: false, text: 错误说明 }。
 */
ipcMain.handle('delete-files', async (event, paths) => {
  if (!lastScannedFolder) {
    return { ok: false, text: '请先扫描文件夹' };
  }
  if (!Array.isArray(paths) || paths.length === 0) {
    return { ok: false, text: '没有需要删除的文件' };
  }
  // 每个文件独立执行“校验 + 移入回收站”，单个文件失败不影响其余文件。
  const results = await Promise.allSettled(paths.map(async (p) => {
    if (!isInsideScannedFolder(p)) {
      throw new Error('路径不在扫描范围内');
    }
    let stat;
    try {
      stat = await fs.promises.stat(p);
    } catch (err) {
      throw new Error('文件不存在或已被删除');
    }
    if (!stat.isFile()) {
      throw new Error('不是普通文件');
    }
    await shell.trashItem(p);
  }));
  const failed = [];
  let deleted = 0;
  results.forEach((item, index) => {
    if (item.status === 'fulfilled') {
      deleted += 1;
      return;
    }
    // 失败时记录路径与原因，供渲染进程提示并可重试。
    const reason = item.reason ? String(item.reason.message || item.reason).trim() : '未知错误';
    failed.push({ path: paths[index], reason });
  });
  return { ok: true, deleted, failed };
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