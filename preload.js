const { contextBridge, ipcRenderer } = require('electron');

/**
 * 通过 contextBridge 向渲染进程暴露文件夹选择 API。
 * 处理步骤：
 * 1. 定义 selectFolder 方法；
 * 2. 通过 ipcRenderer.invoke 调用主进程的 select-folder 处理器。
 */
contextBridge.exposeInMainWorld('fileAPI', {
  /**
   * 打开系统文件夹选择对话框。
   * 返回值：所选文件夹的绝对路径；用户取消时返回 null。
   */
  selectFolder: () => ipcRenderer.invoke('select-folder')
});