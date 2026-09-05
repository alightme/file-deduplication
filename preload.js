// 在渲染进程页面加载前运行。
// （占位脚本：如需访问特权 API，请在此通过 contextBridge 按需暴露。）
window.addEventListener('DOMContentLoaded', () => {
  console.log('Hello World (renderer loaded)');
});