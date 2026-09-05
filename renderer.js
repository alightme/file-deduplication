// 渲染进程逻辑：实现文件夹选择栏与扫描按钮的交互。

const folderPathInput = document.getElementById('folderPath');
const chooseFolderBtn = document.getElementById('chooseFolderBtn');
const scanBtn = document.getElementById('scanBtn');
const scanResult = document.getElementById('scanResult');

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

/**
 * 将所选文件夹交给后端程序扫描，并把返回结果展示在结果区。
 * 执行流程：
 * 1. 未选择文件夹时提示“请先选择文件夹”并直接返回；
 * 2. 调用预加载脚本暴露的 fileAPI.scanFolder(folderPath)；
 * 3. 根据返回的 ok 字段把文案或错误信息展示到结果区。
 */
async function scanFolder() {
  const folder = folderPathInput.value.trim();
  if (!folder) {
    scanResult.textContent = '请先选择文件夹';
    return;
  }
  scanResult.textContent = '扫描中…';
  const result = await window.fileAPI.scanFolder(folder);
  if (result.ok) {
    scanResult.textContent = result.text;
  } else {
    scanResult.textContent = '扫描失败：' + result.text;
  }
}

// 点击按钮或输入框时均触发文件夹选择。
chooseFolderBtn.addEventListener('click', chooseFolder);
folderPathInput.addEventListener('click', chooseFolder);
// 点击扫描按钮触发后端扫描。
scanBtn.addEventListener('click', scanFolder);