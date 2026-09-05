# file-deduplication
file deduplication

## Go 后端

后端程序（go/main.go）接收文件夹路径参数，以 JSON 形式输出扫描结果：

```json
{ "msgType": 10000, "data": "hello <文件夹路径>" }
```

- `msgType`：消息类型，10000 表示扫描结果；
- `data`：业务数据，存放 `hello <文件夹路径>` 文案。

- 构建：`npm start` 启动前会自动编译（prestart），也可单独执行 `npm run build:backend`，产物为 `bin/backend.exe`；
- 手动编译：在 `go` 目录执行 `go build -o ../bin/backend.exe main.go`；
- 运行：`npm start` 启动应用，选择文件夹后点击「扫描」，主进程调用 `bin/backend.exe <文件夹路径>` 并解析其 JSON 输出，页面展示 `data` 字段文案。

> 构建产物 `bin/backend.exe` 已被 .gitignore 忽略，不入库。