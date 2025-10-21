// Minimal placeholder export to force Firebase CLI to (re)create promoBrainAutomation.
// This uses the classic firebase-functions v1 export style which the deploy analyzer reliably detects.
const functions = require('firebase-functions');

exports.promoBrainAutomation = functions.https.onRequest((req, res) => {
  // Simple health/placeholder response. We'll replace this with the real handler after creation.
  res.status(200).send({ status: 'ok', message: 'promoBrainAutomation placeholder active' });
});
