module.exports = ({ ipcMain }) => {
  // 接收器：用于接收渲染进程发送的 ping
  ipcMain.handle('ping', () => 'pong');
};
