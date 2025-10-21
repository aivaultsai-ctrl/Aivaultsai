// Lightweight wrapper to expose promoBrainAutomation for Firebase deploy-time discovery.
// This file avoids importing heavy modules at load-time. The real implementation in
// lib/index.js is required only when an actual request arrives.
const { onRequest } = require('firebase-functions/v2/https');

exports.promoBrainAutomation = onRequest(async (req, res) => {
  try {
    // Require the real handler at request-time to avoid analyzer/runtime issues during deploy
    const lib = require('../lib/index.js');
    if (lib && lib.promoBrainAutomation) {
      // If the lib export is an onRequest function, call it
      return lib.promoBrainAutomation(req, res);
    }
    res.status(500).send({ status: 'error', message: 'promoBrainAutomation implementation not found in lib/index.js' });
  } catch (err) {
    console.error('promo_wrapper error requiring lib:', err && err.message ? err.message : err);
    res.status(500).send({ status: 'error', message: 'Error loading promo handler: ' + (err && err.message ? err.message : String(err)) });
  }
});
