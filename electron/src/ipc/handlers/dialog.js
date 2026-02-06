module.exports = ({ ipcMain, dialog }) => {
  // 获取根目录的绝对路径
  ipcMain.handle('get-abs-path', async (_event, type) => {
    if (type === 'dir') return dialog.showOpenDialog({ properties: ['openDirectory'] });
    return null;
  });
};
