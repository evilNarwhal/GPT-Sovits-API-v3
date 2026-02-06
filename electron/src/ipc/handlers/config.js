module.exports = ({ ipcMain, fs, path, getConfigFilePath }) => {
  const readConfig = async () => {
    const configPath = getConfigFilePath();
    try {
      const raw = await fs.promises.readFile(configPath, 'utf8');
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      if (error && error.code === 'ENOENT') return {};
      console.error('[config] read failed:', error);
      return {};
    }
  };

  const writeConfig = async (content) => {
    const configPath = getConfigFilePath();
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify(content, null, 2), 'utf8');
  };

  // 读取全局配置（deployUrl / activeVersion）
  ipcMain.handle('load-global-config', async () => {
    const data = await readConfig();
    return {
      deployUrl: typeof data.deployUrl === 'string' ? data.deployUrl : '',
      activeVersion: typeof data.activeVersion === 'string' ? data.activeVersion : '',
    };
  });

  // 写入全局配置（deployUrl / activeVersion），保留其他字段
  ipcMain.handle('save-global-config', async (_event, payload) => {
    const current = await readConfig();
    const safePayload = {
      deployUrl: typeof payload?.deployUrl === 'string' ? payload.deployUrl : '',
      activeVersion: typeof payload?.activeVersion === 'string' ? payload.activeVersion : '',
    };
    const content = {
      ...current,
      ...safePayload,
      updatedAt: new Date().toISOString(),
    };
    await writeConfig(content);
    return true;
  });

  // 仅保留全局配置读写
};
