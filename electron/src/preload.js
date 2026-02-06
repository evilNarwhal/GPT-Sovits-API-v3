const { contextBridge, ipcRenderer } = require('electron');

// 仅暴露必要的文件与路径接口给渲染进程，避免直接提供完整的 Node API
contextBridge.exposeInMainWorld('fileAPI', {
  // 修改 bat 中的版本号
  updateBatVersion: (filePath, newVersion) => ipcRenderer.invoke('update-bat-version', filePath, newVersion),
  // 获取目录下的权重文件
  getWeights: (dirPath) => ipcRenderer.invoke('get-weights', dirPath),
  // 选择目录/文件并返回绝对路径
  getAbsPath: (type) => ipcRenderer.invoke('get-abs-path', type),
  // 读取本地全局配置
  loadGlobalConfig: () => ipcRenderer.invoke('load-global-config'),
  // 写入本地全局配置
  saveGlobalConfig: (payload) => ipcRenderer.invoke('save-global-config', payload),
  // 读取本地文件为 Buffer（二进制），用于需要手动读取文件内容的场景
  // filePath 必须是绝对路径（由对话框选择或拖拽得到）
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  // 保存生成语音到本地（临时存放），返回保存后的路径
  saveGeneratedAudio: (arrayBuffer, fileName) =>
    ipcRenderer.invoke('save-generated-audio', arrayBuffer, fileName),
});

// 安全暴露 path 的常用函数
contextBridge.exposeInMainWorld('path', {
  isAbsolute: (p) => ipcRenderer.invoke('path-is-absolute', p),
  normalize: (p) => ipcRenderer.invoke('path-normalize', p),
  join: (...parts) => ipcRenderer.invoke('path-join', parts),
});
