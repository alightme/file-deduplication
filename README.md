# file-deduplication
file deduplication

## Go 后端

后端程序（go/main.go）接收文件夹路径参数，递归扫描目录并按「文件大小 + 头尾 xxh3 哈希」识别重复文件，以 JSON 形式输出扫描结果：

```json
{
  "msgType": 10000,
  "data": [
    [
      { "fileName": "a.txt", "fileSize": 5120, "filePath": "D:\\dir\\a.txt" },
      { "fileName": "b.txt", "fileSize": 5120, "filePath": "D:\\dir\\sub\\b.txt" }
    ]
  ]
}
```

### 字段说明

- `msgType`：消息类型，10000 表示扫描结果；
- `data`：重复分组二维数组，每行是一组重复文件；组内文件数不少于 2，无重复时为空数组；
- 单文件对象字段：
  - `fileName`：文件名；
  - `fileSize`：文件大小（字节数）；
  - `filePath`：文件完整路径。

### 去重算法

1. 递归遍历目录，收集所有普通文件，按文件大小分组（单文件/子树出错时跳过并继续）；
2. 计算每个文件的哈希指纹：
   - 文件大小 ≤ 8KB：整文件计算 xxh3 作为头部哈希，尾部哈希记为 0；
   - 文件大小 > 8KB：前 4KB 计算 xxh3 作为头部哈希，后 4KB 计算 xxh3 作为尾部哈希（避免大文件整体读取的 IO 开销）；
3. 同大小组内「头部哈希 + 尾部哈希」均相同的文件聚为一组，即视为重复。

> 说明：大于 8KB 的文件仅比对头尾各 4KB，属于近似判定；头尾相同但中间内容不同的文件也可能被判为重复。

## 构建与运行

- 构建：`npm start` 启动前会自动编译（prestart），也可单独执行 `npm run build:backend`，产物为 `bin/backend.exe`；
- 依赖：xxh3 由 `github.com/zeebo/xxh3` 提供，依赖已 vendor 到 `go/vendor`，编译无需联网；如需更新依赖，在 `go` 目录执行 `go mod tidy` 后重新执行 `go mod vendor`；
- 手动编译：在 `go` 目录执行 `go build -o ../bin/backend.exe main.go`；
- 运行：`npm start` 启动应用，选择文件夹后点击「扫描」，主进程调用 `bin/backend.exe <文件夹路径>` 并解析其 JSON 输出，页面以表格展示重复分组（列：重复组 / 文件名 / 文件大小 / 文件路径）。

> 构建产物 `bin/backend.exe` 已被 .gitignore 忽略，不入库。
