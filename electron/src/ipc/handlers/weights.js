module.exports = ({ ipcMain, fs, path }) => {
  // 获取权重
  ipcMain.handle('get-weights', async (_event, dirPath) => {
    try {
      if (!path.isAbsolute(dirPath)) {
        throw new Error('dirPath must be an absolute path');
      }
      const baseDir = dirPath;
      // 递归遍历目录
      const walk = async (current) => {
        const entries = await fs.promises.readdir(current, { withFileTypes: true });
        const collected = [];
        for (const entry of entries) {
          // 计算绝对路径
          const full = path.join(current, entry.name);
          // 如果是目录则递归遍历，否则收集路径
          if (entry.isDirectory()) {
            collected.push(...(await walk(full)));
          } else {
            // 收集文件名和路径
            collected.push({ path: full, name: entry.name });
          }
        }
        return collected;
      };

      return await walk(baseDir);
    } catch (err) {
      console.error('[get-gpt-weights] read dir failed:', err);
      throw err;
    }
  });
};
