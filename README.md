# file-deduplication
file deduplication

## Go 后端

后端程序（go/main.go）接收文件夹路径参数，向标准输出打印 `hello <文件夹路径>` 文案。

- 构建：`npm start` 启动前会自动编译（prestart），也可单独执行 `npm run build:backend`，产物为 `bin/backend.exe`；
- 手动编译：在 `go` 目录执行 `go build -o ../bin/backend.exe main.go`；
- 运行：`npm start` 启动应用，选择文件夹后点击「扫描」，主进程调用 `bin/backend.exe <文件夹路径>`，页面展示后端输出。

> 构建产物 `bin/backend.exe` 已被 .gitignore 忽略，不入库。