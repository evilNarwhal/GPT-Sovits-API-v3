const registerPingHandlers = require('./handlers/ping');
const registerPathHandlers = require('./handlers/path');
const registerConfigHandlers = require('./handlers/config');
const registerBatHandlers = require('./handlers/bat');
const registerWeightsHandlers = require('./handlers/weights');
const registerDialogHandlers = require('./handlers/dialog');
const registerFileHandlers = require('./handlers/file');

const registerIpcHandlers = (deps) => {
  registerPingHandlers(deps);
  registerPathHandlers(deps);
  registerConfigHandlers(deps);
  registerBatHandlers(deps);
  registerWeightsHandlers(deps);
  registerDialogHandlers(deps);
  registerFileHandlers(deps);
};

module.exports = { registerIpcHandlers };
