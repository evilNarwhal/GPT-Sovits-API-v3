module.exports = ({ ipcMain, fs, path, getConfigFilePath }) => {
  ipcMain.handle("read-file", async (_event, filePath) => {
    try {
      // 读取指定路径的文件并返回 Buffer（二进制）
      // 适用于前端需要自行解析文件内容的场景
      const buffer = await fs.promises.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error("[read-file] failed:", error);
      throw error;
    }
  });

  ipcMain.handle("save-generated-audio", async (_event, arrayBuffer, fileName) => {
    try {
      if (!arrayBuffer) throw new Error("arrayBuffer is required");
      const baseDir = path.resolve(path.dirname(getConfigFilePath()), "generated_audio");
      await fs.promises.mkdir(baseDir, { recursive: true });
      const rawName = fileName ? path.basename(fileName) : `tts_${Date.now()}.wav`;
      const safeName = path.extname(rawName) ? rawName : `${rawName}.wav`;
      const targetPath = path.join(baseDir, safeName);
      const buffer = Buffer.from(arrayBuffer);
      await fs.promises.writeFile(targetPath, buffer);
      return targetPath;
    } catch (error) {
      console.error("[save-generated-audio] failed:", error);
      throw error;
    }
  });
};
