// 文件去重后端程序：接收文件夹路径参数，以 JSON 格式输出扫描结果。
// 执行流程：
// 1. 读取命令行参数中的文件夹路径；
// 2. 构造结果对象并向标准输出打印 JSON：{"msgType":10000,"data":"hello <文件夹路径>"}。
package main

import (
	"encoding/json"
	"os"
)

// result 是后端返回给 Electron 的 JSON 消息结构。
// 字段说明：
// MsgType 消息类型，固定 10000 表示扫描结果；
// Data    业务数据，存放 hello <文件夹路径> 文案。
type result struct {
	MsgType int    `json:"msgType"`
	Data    string `json:"data"`
}

// main 是程序入口。
// 入参：os.Args[1] —— 文件夹路径（由 Electron 主进程启动本程序时传入）。
// 处理步骤：
// 1. 取第一个命令行参数作为文件夹路径；
// 2. 构造 result 消息并序列化为 JSON 输出到标准输出。
// 返回值：向标准输出打印一行 JSON。
func main() {
	folderPath := ""
	if len(os.Args) > 1 {
		folderPath = os.Args[1]
	}
	// 构造返回消息：msgType=10000（扫描结果），data 存放 hello <文件夹路径>。
	out := result{
		MsgType: 10000,
		Data:    "hello " + folderPath,
	}
	// 序列化为 JSON 并输出到标准输出（自动追加换行）。
	json.NewEncoder(os.Stdout).Encode(out)
}
