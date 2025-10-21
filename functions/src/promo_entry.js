// This entry file explicitly re-exports the promoBrainAutomation handler from lib/index.js
try {
  const lib = require('../lib/index.js');
  if (lib && lib.promoBrainAutomation) {
    exports.promoBrainAutomation = lib.promoBrainAutomation;
  } else if (lib && lib.default && lib.default.promoBrainAutomation) {
    exports.promoBrainAutomation = lib.default.promoBrainAutomation;
  } else {
    const { onRequest } = require('firebase-functions/v2/https');
    exports.promoBrainAutomation = onRequest((req, res) => {
      res.status(500).send({ status: 'error', message: 'promo handler missing in lib/index.js' });
    });
  }
} catch (e) {
  const { onRequest } = require('firebase-functions/v2/https');
  exports.promoBrainAutomation = onRequest((req, res) => {
    res.status(500).send({ status: 'error', message: 'Error loading promo handler: ' + e.message });
  });
}
