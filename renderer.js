// 渲染进程逻辑：实现文件夹选择栏的交互。

const folderPathInput = document.getElementById('folderPath');
const chooseFolderBtn = document.getElementById('chooseFolderBtn');

/**
 * 打开系统文件夹选择对话框，并把所选路径显示在输入框中。
 * 执行流程：
 * 1. 调用预加载脚本暴露的 fileAPI.selectFolder()；
 * 2. 用户取消选择时返回 null，不做任何处理；
 * 3. 选择成功后，将所选文件夹路径写入输入框展示。
 */
async function chooseFolder() {
  const selected = await window.fileAPI.selectFolder();
  if (selected) {
    folderPathInput.value = selected;
  }
}

// 点击按钮或输入框时均触发文件夹选择。
chooseFolderBtn.addEventListener('click', chooseFolder);
folderPathInput.addEventListener('click', chooseFolder);