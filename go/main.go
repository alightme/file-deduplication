// 文件去重后端程序：递归扫描指定目录，按“文件大小 + 头尾 xxh3 哈希”识别重复文件，
// 并以 JSON 二维数组格式输出重复文件分组。
// 执行流程：
//  1. 读取命令行参数中的文件夹路径并校验是否为有效目录；
//  2. 递归遍历目录，收集所有普通文件及其大小（单文件/子树出错时跳过并继续）；
//  3. 按文件大小分组；
//  4. 组内逐文件计算指纹：小于等于 8KB 的文件整文件计算 xxh3 作为头部哈希、尾部哈希记为 0；
//     大于 8KB 的文件分别读取前 4KB 与后 4KB 计算 xxh3 作为头部/尾部哈希；
//  5. 同大小组内“头尾哈希均相同”的文件聚为一组，仅保留文件数不少于 2 的重复组；
//  6. 对重复组排序后序列化 JSON 输出到标准输出。
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/zeebo/xxh3"
)

// 阈值常量：文件大小小于等于该值时整文件参与哈希；大于该值时只取头尾各 4KB。
const (
	smallFileLimit = 8 * 1024 // 小文件判定阈值：8KB
	hashBlockSize  = 4 * 1024 // 大文件哈希块大小：4KB
)

// fileItem 是输出 JSON 中单个文件的信息，对应表格中的一行。
// 字段说明：
// FileName 文件名；
// FileSize 文件大小（字节数）；
// FilePath 文件完整路径。
type fileItem struct {
	FileName string `json:"fileName"` // 文件名
	FileSize int64  `json:"fileSize"` // 文件大小（字节数）
	FilePath string `json:"filePath"` // 文件完整路径
}

// candidate 是扫描过程中使用的候选文件，在 fileItem 基础上附带哈希指纹。
// 字段说明：
// headHash 头部哈希：小于等于 8KB 时为整文件 xxh3；大于 8KB 时为前 4KB 的 xxh3；
// tailHash 尾部哈希：小于等于 8KB 时固定为 0；大于 8KB 时为后 4KB 的 xxh3。
type candidate struct {
	fileItem
	headHash uint64 // 头部哈希
	tailHash uint64 // 尾部哈希
}

// result 是后端返回给 Electron 的 JSON 消息结构。
// 字段说明：
// MsgType 消息类型，固定 10000 表示扫描结果；
// Data    重复文件分组二维数组，每行是一组重复文件（组内文件数不少于 2），无重复时为空数组。
type result struct {
	MsgType int          `json:"msgType"` // 消息类型
	Data    [][]fileItem `json:"data"`    // 重复文件分组
}

// main 是程序入口。
// 入参：os.Args[1] —— 待扫描的文件夹路径（由 Electron 主进程传入）。
// 处理步骤：
// 1. 校验命令行参数与目录有效性，不合法时向标准错误输出提示并以退出码 1 结束；
// 2. 调用 findDuplicates 扫描目录得到重复分组；
// 3. 构造 result 消息序列化 JSON 输出到标准输出。
// 返回值：扫描成功时向标准输出打印一行 JSON；失败时向标准错误打印原因并以退出码 1 结束。
func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "用法：backend.exe <文件夹路径>")
		os.Exit(1)
	}
	folderPath := os.Args[1]
	// 校验入参为已存在的目录。
	info, err := os.Stat(folderPath)
	if err != nil || !info.IsDir() {
		fmt.Fprintf(os.Stderr, "文件夹路径无效或不存在：%s\n", folderPath)
		os.Exit(1)
	}
	// 扫描目录并获取重复文件分组。
	groups, err := findDuplicates(folderPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "扫描失败：%s\n", err.Error())
		os.Exit(1)
	}
	// 构造返回消息：msgType=10000（扫描结果），data 存放重复分组二维数组。
	out := result{
		MsgType: 10000,
		Data:    groups,
	}
	// 序列化为 JSON 并输出到标准输出（自动追加换行）。
	json.NewEncoder(os.Stdout).Encode(out)
}

// findDuplicates 递归扫描目录并找出重复文件分组。
// 入参：root —— 待扫描的目录绝对路径。
// 处理步骤：
// 1. collectFiles 遍历 root 下所有普通文件，记录文件名、大小、完整路径；
// 2. 按文件大小分组，组内文件数不足 2 时直接跳过（单文件不可能重复）；
// 3. 为组内每个文件计算头尾 xxh3 哈希，读取失败的文件跳过不参与判定；
// 4. 按“头尾哈希”二次聚类，聚出文件数不少于 2 的重复组；
// 5. 组内文件按路径排序、组间按文件大小降序排序后返回。
// 返回值：重复分组二维数组（对应 data 结构）；遍历根目录失败时返回错误。
func findDuplicates(root string) ([][]fileItem, error) {
	// 收集目录下所有普通文件。
	files, err := collectFiles(root)
	if err != nil {
		return nil, err
	}
	// 按文件大小分组：键为文件大小，值为候选文件列表。
	bySize := make(map[int64][]*candidate)
	for _, f := range files {
		bySize[f.FileSize] = append(bySize[f.FileSize], f)
	}

	var groups [][]fileItem
	// 遍历每个“同大小”分组，进一步按头尾哈希聚类。
	for _, cands := range bySize {
		// 组内不足 2 个文件时不可能存在重复，跳过以节省文件读取开销。
		if len(cands) < 2 {
			continue
		}
		// 以“头部哈希 + 尾部哈希”为键聚类。
		clusters := make(map[[2]uint64][]*candidate)
		for _, c := range cands {
			// 计算头尾哈希，读取失败（如文件被占用或已被删除）时跳过该文件。
			if fillHash(c) != nil {
				continue
			}
			key := [2]uint64{c.headHash, c.tailHash}
			clusters[key] = append(clusters[key], c)
		}
		// 聚类结果文件数不少于 2 时视为一组重复文件。
		for _, list := range clusters {
			if len(list) < 2 {
				continue
			}
			groups = append(groups, toFileItems(list))
		}
	}
	// 组间排序：优先展示文件体积更大的重复组，其次组内文件更多的组，最后按路径兜底。
	sort.Slice(groups, func(i, j int) bool {
		if groups[i][0].FileSize != groups[j][0].FileSize {
			return groups[i][0].FileSize > groups[j][0].FileSize
		}
		if len(groups[i]) != len(groups[j]) {
			return len(groups[i]) > len(groups[j])
		}
		return groups[i][0].FilePath < groups[j][0].FilePath
	})
	return groups, nil
}

// collectFiles 递归遍历目录并收集所有普通文件。
// 入参：root —— 遍历起始目录。
// 处理步骤：
// 1. 使用 filepath.WalkDir 深度优先遍历 root；
// 2. 目录或符号链接等非普通文件直接跳过，仅保留普通文件；
// 3. 通过目录项 Info 获取文件大小，路径使用遍历得到的完整路径。
// 返回值：普通文件候选列表；根目录遍历失败时返回错误。
func collectFiles(root string) ([]*candidate, error) {
	var files []*candidate
	err := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		// 子树无法访问（如无权限）时跳过该子树并继续遍历其他分支。
		if err != nil {
			return nil
		}
		// 仅处理普通文件：跳过目录与符号链接等类型。
		if d.IsDir() || !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		files = append(files, &candidate{
			fileItem: fileItem{
				FileName: d.Name(),
				FileSize: info.Size(),
				FilePath: p,
			},
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// fillHash 计算单个文件头尾 xxh3 哈希并回填到候选对象中。
// 入参：c —— 候选文件，须含 FilePath 与 FileSize，计算完成后回填 headHash、tailHash。
// 处理步骤：
// 1. 打开文件；打开失败直接返回错误；
// 2. 文件小于等于 8KB 时读取整个文件计算 xxh3 作为头部哈希，尾部哈希记为 0；
// 3. 文件大于 8KB 时读取前 4KB 计算头部哈希，再定位到末尾读取后 4KB 计算尾部哈希。
// 返回值：成功返回 nil；打开或读取失败返回错误，由调用方决定跳过该文件。
func fillHash(c *candidate) error {
	f, err := os.Open(c.FilePath)
	if err != nil {
		return err
	}
	defer f.Close()

	// 小文件（小于等于 8KB）：整文件哈希，尾部哈希为 0。
	if c.FileSize <= smallFileLimit {
		buf := make([]byte, c.FileSize)
		if _, err := io.ReadFull(f, buf); err != nil {
			return err
		}
		c.headHash = xxh3.Hash(buf)
		c.tailHash = 0
		return nil
	}

	// 大文件（大于 8KB）：读取前 4KB 计算头部哈希。
	headBuf := make([]byte, hashBlockSize)
	if _, err := io.ReadFull(f, headBuf); err != nil {
		return err
	}
	c.headHash = xxh3.Hash(headBuf)

	// 大文件：定位到文件末尾前 4KB 处，读取后 4KB 计算尾部哈希。
	if _, err := f.Seek(-hashBlockSize, io.SeekEnd); err != nil {
		return err
	}
	tailBuf := make([]byte, hashBlockSize)
	if _, err := io.ReadFull(f, tailBuf); err != nil {
		return err
	}
	c.tailHash = xxh3.Hash(tailBuf)
	return nil
}

// toFileItems 将一组候选文件转换为输出结构并排序。
// 入参：list —— 同一重复组的候选文件列表（含哈希字段，输出时丢弃）。
// 处理步骤：
// 1. 仅取 fileItem 部分（丢弃 headHash、tailHash 等内部字段）；
// 2. 组内按完整路径升序排序，保证同一组内输出顺序稳定。
// 返回值：可用于 JSON 输出的文件信息切片。
func toFileItems(list []*candidate) []fileItem {
	items := make([]fileItem, 0, len(list))
	for _, c := range list {
		items = append(items, c.fileItem)
	}
	// 组内按路径排序，保证同组输出顺序稳定。
	sort.Slice(items, func(i, j int) bool {
		return items[i].FilePath < items[j].FilePath
	})
	return items
}
