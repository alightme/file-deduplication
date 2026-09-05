// 绿色版（免安装）打包脚本：将 Electron 运行时与当前应用组装为可双击运行的 Windows 目录。
// 通过 npm script「package:win」调用，产物位于 dist/file-deduplication-win32-x64。
// 执行流程：
// 1. 校验后端程序 bin/backend.exe 与 Electron 运行时 node_modules/electron/dist 均已就绪；
// 2. 清空并重建输出目录 dist/file-deduplication-win32-x64，整体复制 Electron 运行时；
// 3. 将 electron.exe 重命名为 file-deduplication.exe（Electron 按相对路径定位 resources，改名不影响运行）；
// 4. 移除 resources/default_app.asar（示例应用，应用目录存在时不会被加载，移除可减小体积）；
// 5. 在 resources/app 下写入应用文件：入口、页面、图标 build/icon.ico 与后端程序 bin/backend.exe；
//    —— 应用不压缩为 asar，main.js 中 __dirname 指向 resources/app，后端路径 __dirname/bin/backend.exe 无需改动即可生效；
// 6. 打印产物路径，供用户直接双击运行或分发。
const path = require('path');
const fs = require('fs');

// 项目根目录（脚本所在目录）。
const rootDir = __dirname;

// Electron 运行时目录：执行 npm install 后由 electron 包自动下载到 node_modules/electron/dist。
const electronDist = path.join(rootDir, 'node_modules', 'electron', 'dist');

// 应用名：沿用 package.json 的 name 字段，同时作为可执行文件名与产物目录名。
const appName = 'file-deduplication';

// 产物输出目录：dist/file-deduplication-win32-x64。
const outDir = path.join(rootDir, 'dist', `${appName}-win32-x64`);

// 需要随应用一起分发的运行时文件（均为运行必需文件，与仓库源码对应）。
const appFiles = ['package.json', 'main.js', 'preload.js', 'renderer.js', 'index.html', 'build/icon.ico'];

// 后端程序在应用内的相对路径：resources/app/bin/backend.exe，与 main.js 的后端定位逻辑 __dirname/bin 对应。
const backendRel = path.join('bin', 'backend.exe');

/**
 * 校验打包前置条件是否满足。
 * 入参：无。
 * 处理步骤：分别检查 Electron 运行时目录与后端程序是否存在，缺失时打印提示。
 * 返回值：满足返回 true，否则返回 false。
 */
function checkPrerequisites() {
  if (!fs.existsSync(electronDist) || !fs.existsSync(path.join(electronDist, 'electron.exe'))) {
    console.error('未找到 Electron 运行时，请先执行：npm install');
    return false;
  }
  if (!fs.existsSync(path.join(rootDir, backendRel))) {
    console.error('未找到后端程序，请先执行：npm run build:backend');
    return false;
  }
  return true;
}

/**
 * 重置输出目录：删除旧的打包产物后重建。
 * 入参：无。
 * 处理步骤：先校验输出目录位于项目根目录内，再递归删除并重建，避免残留旧文件。
 * 返回值：无。
 */
function resetOutDir() {
  // 安全校验：仅允许删除项目 dist 目录下的内容，防止误删其他路径。
  const resolvedOut = path.resolve(outDir);
  const resolvedRoot = path.resolve(rootDir);
  if (!resolvedOut.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`输出目录超出项目范围：${resolvedOut}`);
  }
  fs.rmSync(resolvedOut, { recursive: true, force: true });
  fs.mkdirSync(resolvedOut, { recursive: true });
}

/**
 * 组装绿色版目录。
 * 入参：无。
 * 处理步骤：
 * 1. 整体复制 Electron 运行时到输出目录；
 * 2. 重命名 electron.exe 为 file-deduplication.exe；
 * 3. 移除示例应用 default_app.asar；
 * 4. 在 resources/app 下复制应用文件与后端程序。
 * 返回值：无。
 */
function assemble() {
  resetOutDir();
  fs.cpSync(electronDist, outDir, { recursive: true });

  // 可执行文件改名：便于用户识别；Electron 依据相对路径加载 resources，改名不影响运行。
  fs.renameSync(path.join(outDir, 'electron.exe'), path.join(outDir, `${appName}.exe`));

  // 移除示例应用：resources/app 存在时 Electron 会优先加载应用，default_app.asar 不会被使用。
  const defaultApp = path.join(outDir, 'resources', 'default_app.asar');
  if (fs.existsSync(defaultApp)) {
    fs.rmSync(defaultApp, { force: true });
  }

  // 写入应用目录 resources/app：应用文件不压缩进 asar，便于后端 exe 直接执行。
  const appDir = path.join(outDir, 'resources', 'app');
  fs.mkdirSync(appDir, { recursive: true });
  appFiles.forEach((file) => {
    // 逐个复制应用文件：支持子目录（如 build/icon.ico），先确保目标父目录存在。
    const dest = path.join(appDir, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(rootDir, file), dest);
  });

  // 复制后端程序到 resources/app/bin/backend.exe。
  fs.mkdirSync(path.join(appDir, 'bin'), { recursive: true });
  fs.copyFileSync(path.join(rootDir, backendRel), path.join(appDir, backendRel));
}

// 入口：校验通过后执行组装并打印产物路径。
if (checkPrerequisites()) {
  assemble();
  console.log(`打包完成：${path.join(outDir, `${appName}.exe`)}`);
}