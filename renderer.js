// 渲染进程逻辑：实现文件夹选择栏、扫描按钮交互、重复文件表格展示、
// 勾选保留文件、删除未勾选文件（删除后表格保持原样，便于用户按路径核对删除结果）。

const folderPathInput = document.getElementById('folderPath');
const chooseFolderBtn = document.getElementById('chooseFolderBtn');
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const resultWrap = document.getElementById('resultWrap');
const summaryEl = document.getElementById('summary');
const deleteBtn = document.getElementById('deleteBtn');
const resultBody = document.getElementById('resultBody');

// 已成功移入回收站的文件路径集合：表格保持原样展示，再次点击删除时跳过这些文件，避免重复提交。
const deletedPaths = new Set();

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
 * 将重复分组渲染为带“保留”勾选列的扁平化表格。
 * 入参：groups —— 重复分组二维数组，每行是一组重复文件（文件对象含 fileName/fileSize/filePath）。
 * 执行流程：
 * 1. 无重复分组时提示“未发现重复文件”并隐藏结果区；
 * 2. 清空上一次扫描留下的已删除记录，统计并展示“共 N 组重复，涉及 M 个文件”；
 * 3. 逐组逐文件创建表格行：勾选列、组号列（rowspan 合并）、文件名/大小/路径列；
 * 4. 文件名与路径单元格可点击，分别打开文件、在资源管理器中定位；
 * 5. 相邻组使用交替底色便于区分，末尾启用删除按钮。
 * 返回值：无（直接操作 DOM）。
 */
function renderGroups(groups) {
  // 新扫描结果：清空上一次扫描记录的已删除路径。
  deletedPaths.clear();
  if (!groups || groups.length === 0) {
    statusEl.textContent = '未发现重复文件';
    resultWrap.classList.add('hidden');
    deleteBtn.disabled = true;
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
      row.dataset.group = String(groupIndex);
      row.dataset.path = file.filePath;
      if (groupIndex % 2 === 1) {
        row.classList.add('group-alt');
      }
      // 保留勾选列：勾选表示该文件要保留，未勾选的文件可被“删除未勾选文件”移入回收站（默认不勾选）。
      const checkCell = document.createElement('td');
      checkCell.className = 'col-check';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'keep-check';
      checkCell.appendChild(check);
      row.appendChild(checkCell);
      // 组号列：仅组内首个文件输出，并通过 rowspan 合并该组所有行。
      if (fileIndex === 0) {
        const groupCell = document.createElement('td');
        groupCell.className = 'col-group';
        groupCell.rowSpan = group.length;
        groupCell.textContent = String(groupIndex + 1);
        row.appendChild(groupCell);
      }
      // 文件名列（点击可在系统默认程序中打开文件）。
      const nameCell = document.createElement('td');
      nameCell.className = 'col-name';
      nameCell.textContent = file.fileName;
      nameCell.title = file.fileName;
      row.appendChild(nameCell);
      // 文件大小列（字节数格式化为可读单位）。
      const sizeCell = document.createElement('td');
      sizeCell.className = 'col-size';
      sizeCell.textContent = formatSize(file.fileSize);
      row.appendChild(sizeCell);
      // 文件完整路径列（点击可在资源管理器中定位文件）。
      const pathCell = document.createElement('td');
      pathCell.className = 'col-path';
      pathCell.textContent = file.filePath;
      pathCell.title = file.filePath;
      row.appendChild(pathCell);
      resultBody.appendChild(row);
    });
  });
  deleteBtn.disabled = false;
  statusEl.textContent = '';
  resultWrap.classList.remove('hidden');
}

/**
 * 将未勾选“保留”的文件批量移入回收站（表格保持原样，不做增删改）。
 * 执行流程：
 * 1. 收集表格中尚未删除且未勾选保留的文件路径，同时统计“整组未勾选”的组数；
 * 2. 无待删除文件时提示并返回；否则弹出二次确认（整组清空时额外提醒）；
 * 3. 调用 fileAPI.deleteFiles(paths) 交给主进程移入回收站；
 * 4. 成功后把成功删除的路径记入 deletedPaths，避免再次点击时重复提交；
 * 5. 状态区汇总成功数与失败明细（失败文件仍保留未删除状态，可重试）。
 * 返回值：无（直接操作 DOM）。
 */
async function deleteUnchecked() {
  const unchecked = [];
  const groupStateMap = new Map();
  resultBody.querySelectorAll('tr').forEach((row) => {
    // 已成功删除的文件跳过：不参与统计，也不重复提交。
    if (deletedPaths.has(row.dataset.path)) {
      return;
    }
    const groupIndex = Number(row.dataset.group);
    if (!groupStateMap.has(groupIndex)) {
      groupStateMap.set(groupIndex, { hasChecked: false });
    }
    const check = row.querySelector('.keep-check');
    if (check && check.checked) {
      groupStateMap.get(groupIndex).hasChecked = true;
    } else {
      unchecked.push(row.dataset.path);
    }
  });
  if (unchecked.length === 0) {
    statusEl.textContent = '没有未勾选的文件需要删除';
    return;
  }
  // 统计“整组未勾选任何保留文件”的组数，用于删除前二次确认提示。
  let emptyGroupCount = 0;
  groupStateMap.forEach((state) => {
    if (!state.hasChecked) emptyGroupCount += 1;
  });
  let confirmText = `确定将 ${unchecked.length} 个未勾选文件移入回收站吗？`;
  if (emptyGroupCount > 0) {
    confirmText += `\n其中 ${emptyGroupCount} 组未勾选任何保留文件，整组文件都会被移入回收站。`;
  }
  if (!window.confirm(confirmText)) {
    return;
  }
  deleteBtn.disabled = true;
  statusEl.textContent = '正在移入回收站…';
  const result = await window.fileAPI.deleteFiles(unchecked);
  if (!result.ok) {
    deleteBtn.disabled = false;
    statusEl.textContent = '删除失败：' + result.text;
    return;
  }
  // 失败文件的路径集合（未删除成功，可重试）；其余未勾选文件视为已成功移入回收站。
  const failedPaths = new Set((result.failed || []).map((item) => item.path));
  unchecked.forEach((p) => {
    if (!failedPaths.has(p)) {
      deletedPaths.add(p);
    }
  });
  // 汇总操作结果：成功数 + 失败明细。表格保持原样，便于按路径核对删除结果。
  let text = `已将 ${result.deleted} 个文件移入回收站`;
  if (result.failed && result.failed.length > 0) {
    text += `，${result.failed.length} 个失败：`;
    text += result.failed
      .map((item) => `${item.path}（${item.reason}）`)
      .join('；');
  }
  statusEl.textContent = text;
}

/**
 * 使用系统默认程序打开指定文件。
 * 入参：filePath —— 文件完整路径（来自表格行 dataset）。
 * 执行流程：调用 fileAPI.openFile，失败时在状态区提示原因。
 */
async function openFile(filePath) {
  const result = await window.fileAPI.openFile(filePath);
  if (!result.ok) {
    statusEl.textContent = '打开失败：' + result.text;
  }
}

/**
 * 在系统资源管理器中定位指定文件。
 * 入参：filePath —— 文件完整路径（来自表格行 dataset）。
 * 执行流程：调用 fileAPI.showInFolder，失败时在状态区提示原因。
 */
async function showInFolder(filePath) {
  const result = await window.fileAPI.showInFolder(filePath);
  if (!result.ok) {
    statusEl.textContent = '定位失败：' + result.text;
  }
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
// 点击删除按钮，把未勾选保留的文件移入回收站。
deleteBtn.addEventListener('click', deleteUnchecked);
// 表格点击委托：文件名打开文件、文件路径在资源管理器中定位。
resultBody.addEventListener('click', (event) => {
  const cell = event.target.closest('td');
  const row = event.target.closest('tr');
  if (!cell || !row) {
    return;
  }
  if (cell.classList.contains('col-name')) {
    openFile(row.dataset.path);
  } else if (cell.classList.contains('col-path')) {
    showInFolder(row.dataset.path);
  }
});
