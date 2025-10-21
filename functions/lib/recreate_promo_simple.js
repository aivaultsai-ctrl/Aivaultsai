// Minimal placeholder in lib to force Firebase CLI to (re)create promoBrainAutomation.
const functions = require('firebase-functions');

exports.promoBrainAutomation = functions.https.onRequest((req, res) => {
  res.status(200).send({ status: 'ok', message: 'promoBrainAutomation placeholder active (lib)' });
});
