module.exports = ({ ipcMain, fs, path }) => {
  // 修改 bat 中的版本号
  ipcMain.handle('update-bat-version', async (_event, filePath, newVersion) => {
    if (!path.isAbsolute(filePath)) {
      throw new Error('文件路径应为整合包绝对路径');
    }
    const absPath = filePath;
    const text = await fs.promises.readFile(absPath, 'utf8');
    // 假设 bat 里有行：version=1.0.0
    const updated = text.replace(/version\s*=\s*.+/i, `version=${newVersion}`);
    await fs.promises.writeFile(absPath, updated, 'utf8');
    return true;
  });
};
