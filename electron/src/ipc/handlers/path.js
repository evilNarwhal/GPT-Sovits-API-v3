module.exports = ({ ipcMain, path }) => {
  ipcMain.handle('path-is-absolute', (_event, targetPath) => path.isAbsolute(targetPath ?? ''));
  ipcMain.handle('path-normalize', (_event, targetPath) => path.normalize(targetPath ?? ''));
  ipcMain.handle('path-join', (_event, parts) => path.join(...(Array.isArray(parts) ? parts : [])));
};
