const { contextBridge, ipcRenderer } = require('electron');

/**
 * 通过 contextBridge 向渲染进程暴露特权 API。
 * 处理步骤：
 * 1. 定义 selectFolder、scanFolder 方法；
 * 2. 通过 ipcRenderer.invoke 调用主进程对应的 IPC 处理器。
 */
contextBridge.exposeInMainWorld('fileAPI', {
  /**
   * 打开系统文件夹选择对话框。
   * 返回值：所选文件夹的绝对路径；用户取消时返回 null。
   */
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  /**
   * 请求主进程调用后端程序扫描文件夹。
   * 入参：folderPath —— 待扫描的文件夹绝对路径。
   * 返回值：Promise，解析为 { ok: true, groups: 重复分组二维数组 } 或 { ok: false, text: 错误说明 }。
   */
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath)
});
