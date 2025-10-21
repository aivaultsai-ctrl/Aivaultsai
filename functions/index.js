// Explicitly export the placeholder handler so Firebase CLI will detect promoBrainAutomation
try {
  const placeholder = require('./lib/recreate_promo_simple.js');
  if (placeholder && placeholder.promoBrainAutomation) {
    exports.promoBrainAutomation = placeholder.promoBrainAutomation;
  }
} catch (e) {
  // Fallback minimal export to ensure deploy doesn't fail
  const functions = require('firebase-functions');
  exports.promoBrainAutomation = functions.https.onRequest((req, res) => {
    res.status(500).send({ status: 'error', message: 'Failed to load promo placeholder: ' + (e && e.message)});
  });
}
