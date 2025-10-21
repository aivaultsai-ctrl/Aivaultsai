// This file re-exports the promoBrainAutomation handler from the main lib
// to force Firebase CLI to detect and (re)create the function if missing.
try {
    const mainLib = require('./index.js');
    if (mainLib && mainLib.promoBrainAutomation) {
        exports.promoBrainAutomation = mainLib.promoBrainAutomation;
    } else {
        // If the handler isn't found, export a placeholder that returns 500 so deploy still has an export
        const { onRequest } = require('firebase-functions/v2/https');
        exports.promoBrainAutomation = onRequest((req, res) => {
            res.status(500).send({ status: 'error', message: 'promoBrainAutomation handler not available in lib/index.js' });
        });
    }
} catch (e) {
    const { onRequest } = require('firebase-functions/v2/https');
    exports.promoBrainAutomation = onRequest((req, res) => {
        res.status(500).send({ status: 'error', message: 'Error loading promoBrainAutomation: ' + e.message });
    });
}
