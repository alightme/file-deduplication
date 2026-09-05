// 后端构建脚本：编译 go/main.go 为根目录 bin/backend.exe。
// 执行流程：
// 1. 确保 bin 目录存在；
// 2. 在 go 目录下执行 go build -o ../bin/backend.exe main.go；
// 3. 将编译结果退出码透传给 npm（编译失败时中止后续 electron 启动）。
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// 项目根目录、go 源码目录与产物输出目录。
const rootDir = __dirname;
const goDir = path.join(rootDir, 'go');
const binDir = path.join(rootDir, 'bin');

// 确保输出目录 bin 存在（不存在则创建）。
fs.mkdirSync(binDir, { recursive: true });

// 在 go 目录执行 go build，产物输出到 bin/backend.exe。
const result = spawnSync('go', ['build', '-o', '../bin/backend.exe', 'main.go'], {
  cwd: goDir,
  stdio: 'inherit'
});

// 透传退出码：status 为 null 表示启动失败（如未安装 go），统一按失败处理。
process.exit(result.status === null ? 1 : result.status);