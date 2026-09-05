// 文件去重后端程序：接收文件夹路径参数，向标准输出打印 hello + 路径。
// 执行流程：
// 1. 读取命令行参数中的文件夹路径；
// 2. 向标准输出打印 hello <文件夹路径>。
package main

import (
	"fmt"
	"os"
)

// main 是程序入口。
// 入参：os.Args[1] —— 文件夹路径（由 Electron 主进程启动本程序时传入）。
// 处理步骤：取第一个命令行参数作为文件夹路径。
// 返回值：向标准输出打印 hello <文件夹路径>。
func main() {
	folderPath := ""
	if len(os.Args) > 1 {
		folderPath = os.Args[1]
	}
	fmt.Println("hello " + folderPath)
}
