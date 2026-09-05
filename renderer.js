// 渲染进程逻辑：实现文件夹选择栏、扫描按钮交互与重复文件表格展示。

const folderPathInput = document.getElementById('folderPath');
const chooseFolderBtn = document.getElementById('chooseFolderBtn');
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const resultWrap = document.getElementById('resultWrap');
const summaryEl = document.getElementById('summary');
const resultBody = document.getElementById('resultBody');

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
 * 将所选文件夹交给后端程序扫描，并把重复结果以表格形式展示。
 * 执行流程：
 * 1. 未选择文件夹时提示“请先选择文件夹”并直接返回；
 * 2. 隐藏旧结果区，状态区显示“扫描中…”；
 * 3. 调用预加载脚本暴露的 fileAPI.scanFolder(folderPath)；
 * 4. 成功时调用 renderGroups 渲染表格；失败时在状态区展示错误说明。
 */
async function scanFolder() {
  const folder = folderPathInput.value.trim();
  if (!folder) {
    statusEl.textContent = '请先选择文件夹';
    return;
  }
  resultWrap.classList.add('hidden');
  statusEl.textContent = '扫描中…';
  const result = await window.fileAPI.scanFolder(folder);
  if (result.ok) {
    renderGroups(result.groups);
  } else {
    statusEl.textContent = '扫描失败：' + result.text;
  }
}

/**
 * 将后端返回的重复分组渲染为一张扁平化表格。
 * 入参：groups —— 重复分组二维数组，每行是一组重复文件（文件对象含 fileName/fileSize/filePath）。
 * 执行流程：
 * 1. 无重复分组时提示“未发现重复文件”并隐藏结果区；
 * 2. 统计并展示“共 N 组重复，涉及 M 个文件”；
 * 3. 清空旧行，逐组逐文件创建表格行：组号列用 rowspan 合并、其余列为文件名/大小/路径；
 * 4. 相邻组使用交替底色便于区分。
 * 返回值：无（直接操作 DOM）。
 */
function renderGroups(groups) {
  if (!groups || groups.length === 0) {
    statusEl.textContent = '未发现重复文件';
    resultWrap.classList.add('hidden');
    return;
  }
  // 统计重复组数与涉及文件总数。
  const totalFiles = groups.reduce((sum, group) => sum + group.length, 0);
  summaryEl.textContent = `共 ${groups.length} 组重复，涉及 ${totalFiles} 个文件`;
  resultBody.textContent = '';
  // 逐组渲染；奇偶组使用不同底色便于视觉区分。
  groups.forEach((group, groupIndex) => {
    group.forEach((file, fileIndex) => {
      const row = document.createElement('tr');
      if (groupIndex % 2 === 1) {
        row.classList.add('group-alt');
      }
      // 组号列：仅组内首个文件输出，并通过 rowspan 合并该组所有行。
      if (fileIndex === 0) {
        const groupCell = document.createElement('td');
        groupCell.className = 'col-group';
        groupCell.rowSpan = group.length;
        groupCell.textContent = String(groupIndex + 1);
        row.appendChild(groupCell);
      }
      // 文件名列。
      const nameCell = document.createElement('td');
      nameCell.className = 'col-name';
      nameCell.textContent = file.fileName;
      row.appendChild(nameCell);
      // 文件大小列（字节数格式化为可读单位）。
      const sizeCell = document.createElement('td');
      sizeCell.className = 'col-size';
      sizeCell.textContent = formatSize(file.fileSize);
      row.appendChild(sizeCell);
      // 文件完整路径列。
      const pathCell = document.createElement('td');
      pathCell.textContent = file.filePath;
      row.appendChild(pathCell);
      resultBody.appendChild(row);
    });
  });
  statusEl.textContent = '';
  resultWrap.classList.remove('hidden');
}

/**
 * 将字节数格式化为可读大小文案。
 * 入参：size —— 文件大小（字节数）。
 * 处理步骤：
 * 1. 小于 1024 字节直接以 B 展示；
 * 2. 否则依次除以 1024 得到合适的 KB/MB/GB/TB 单位，保留两位小数。
 * 返回值：格式化后的文案，如 "1.43 MB"。
 */
function formatSize(size) {
  if (size < 1024) {
    return size + ' B';
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = -1;
  do {
    value = value / 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return value.toFixed(2) + ' ' + units[unitIndex];
}

// 点击按钮或输入框时均触发文件夹选择。
chooseFolderBtn.addEventListener('click', chooseFolder);
folderPathInput.addEventListener('click', chooseFolder);
// 点击扫描按钮触发后端扫描。
scanBtn.addEventListener('click', scanFolder);
