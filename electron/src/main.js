// electron 更偏向 commonjs 规范，尤其是 preload 使用 require 引入模块
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { registerIpcHandlers } = require('./ipc');

// Local global config file name (stored under electron directory)
const CONFIG_FILE_NAME = 'config.json';

// Get local config path under electron directory
const getConfigFilePath = () => path.resolve(__dirname, '..', CONFIG_FILE_NAME);

// Register ipc handlers grouped by feature
registerIpcHandlers({ ipcMain, dialog, fs, path, getConfigFilePath });

// app 控制应用生命周期；BrowserWindow 创建和管理窗口
const createWindow = () => {
  // Menu.setApplicationMenu(null); // 禁用默认菜单栏
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    // 配置项用于控制渲染进程的能力、隔离与安全策略
    webPreferences: {
      // 预加载脚本的绝对路径
      preload: path.join(__dirname, 'preload.js'),
      // 出于安全考虑，关闭 Node.js 直通
      // nodeIntegration: false,
      // contextIsolation: true, // 启用上下文隔离
      // enableRemoteModule: false // 禁用 remote 模块
    },
    menubar: false,
  });
  win.loadURL('http://localhost:5173');
  // win.loadFile('src/index.html');
};

// 当 Electron 完成初始化并准备创建窗口时调用
app.whenReady().then(() => {
  createWindow();
  // macOS：在没有窗口打开时会自动创建一个新窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 判断操作系统是否是 macOS，不是则在页面关闭后退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
