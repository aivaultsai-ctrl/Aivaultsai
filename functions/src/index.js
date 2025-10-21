const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require('@google/genai');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const functions = require('firebase-functions');
const { google } = require('googleapis');
// Load local .env in development (dotenv is in dependencies)
try {
    require('dotenv').config();
} catch (e) {
    // dotenv optional
}

/**
 * Functie om de planning van PromoBrain in een Google Sheet te schrijven.
 * @param {string} planText - Het Markdown plan.
 */
async function writeToSheet(planText) {
    // Lazy fallback: only try functions.config() here at runtime if env var wasn't provided.
    if (!SHEET_ID) {
        try {
            if (functions && typeof functions.config === 'function') {
                const cfg = functions.config();
                if (cfg && cfg.lead && cfg.lead.sheet_id) {
                    SHEET_ID = cfg.lead.sheet_id;
                    console.warn('[promoBrain] Using legacy functions.config().lead.sheet_id for SHEET_ID (deprecated).');
                }
            }
        } catch (e) {
            // functions.config() may not be available in Gen2 — ignore silently and continue to error below
            console.debug('[promoBrain] functions.config() not available or failed at runtime:', e && e.message);
        }
    }

    if (!SHEET_ID) {
        throw new Error("Missing SHEET_ID environment variable. Cannot write to Google Sheets.");
    }

    const tasks = planText
        .split('\n')
        .filter(line => /^\s*\d+\.\s*/.test(line))
        .map(line => line.replace(/^\s*\d+\.\s*/, '').trim());

    if (tasks.length !== 3) {
        throw new Error(`Plan bevat ${tasks.length} taken (verwacht 3). Kan niet wegschrijven naar spreadsheet.`);
    }

    const row = [
        new Date().toISOString().slice(0, 10),
        tasks[0],
        tasks[1],
        tasks[2]
    ];

    try {
        console.log(`[promoBrain] Writing to sheet ${SHEET_ID} range ${TAB_NAME}!A:D`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${TAB_NAME}!A:D`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] },
        });
        console.log("Data succesvol naar Google Sheet geschreven.");
    } catch (sheetError) {
        console.error("Google Sheets Schrijffout:", sheetError && sheetError.message ? sheetError.message : sheetError);
        try {
            console.error('[promoBrain] Google Sheets error details:', JSON.stringify(sheetError, Object.getOwnPropertyNames(sheetError)));
        } catch (err) {
            console.error('[promoBrain] Could not stringify sheet error:', err);
        }
        if (sheetError && sheetError.response && sheetError.response.data) {
            console.error('[promoBrain] Google API response:', JSON.stringify(sheetError.response.data));
        }
        throw new Error("Kon niet naar Google Sheet schrijven. Controleer rechten/SHEET_ID. " + (sheetError && sheetError.message ? sheetError.message : ''));
    }
}

// --- Configuration / clients ---
// Mirror the lib/index.js initialization so the source entrypoint has the same runtime
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
// SHEET_ID may come from process.env (preferred) or functions.config() legacy config (lead.sheet_id)
// Prefer explicit env var. Do NOT call functions.config() at module load time —
// Cloud Functions v2 (Gen2) does not expose functions.config() and calling it
// during startup can crash the container. We'll attempt a safe, lazy read only
// when a write is actually requested (and always wrapped in try/catch).
// Prefer environment variable. If not present, fall back to the user-provided
// sheet id. This is a pragmatic short-term fallback: ideally SHEET_ID should
// be provided via environment variables or Secret Manager for production.
// SHEET_ID must be provided via environment variable in Gen2. Do not use
// hard-coded values in production. If it's missing at runtime, functions
// will log a clear error when a write is attempted.
let SHEET_ID = process.env.SHEET_ID || null;
const TAB_NAME = process.env.TAB_NAME || 'Dagrapport';

// Optional Secret Manager helper (safe if not installed)
let SecretClientAvailable = true;
try {
    require('@google-cloud/secret-manager');
} catch (e) {
    SecretClientAvailable = false;
}

let ai = null; // will be lazily initialized by initializeAI()

// Initialize Google Sheets client
const sheetsAuth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

async function getGeminiKeyFromSecretManager(name) {
    if (!SecretClientAvailable) return null;
    try {
        const client = new SecretManagerServiceClient();
        const [accessResponse] = await client.accessSecretVersion({ name });
        const payload = accessResponse.payload && accessResponse.payload.data ? accessResponse.payload.data.toString('utf8') : null;
        return payload;
    } catch (e) {
        console.log('[promoBrain] Secret Manager lookup failed or not configured:', e.message);
        return null;
    }
}

async function initializeAI() {
    if (ai) return ai;

    // 1) Prefer explicit environment variable (process.env)
    // Support multiple common names so deployments using different env names still work.
    let geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_KEY || process.env.GENAI_API_KEY;
    let keySource = geminiKey ? 'env' : null;

    // 2) Try Secret Manager (only if project is defined)
    if (!geminiKey) {
        const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
        if (project) {
            // Try a few common secret names the user might have created
            const possibleSecrets = [
                `projects/${project}/secrets/gemini-key/versions/latest`,
                `projects/${project}/secrets/google-genai-api-key/versions/latest`,
                `projects/${project}/secrets/google_genai_api_key/versions/latest`
            ];
            for (const name of possibleSecrets) {
                geminiKey = await getGeminiKeyFromSecretManager(name);
                if (geminiKey) { keySource = `secret:${name}`; break; }
            }
        }
    }

    // 3) Fallback to functions.config (legacy, may be deprecated)
    if (!geminiKey) {
        try {
            const cfg = functions.config && functions.config().gemini;
            if (cfg && cfg.key) { geminiKey = cfg.key; keySource = 'functions.config'; }
        } catch (e) {
            // ignore
        }
    }
    // Force API-key-only authentication path. We intentionally DO NOT use ADC/scopes here.
    // Sources tried (in order): process.env, Secret Manager (if project known), functions.config (legacy).
    if (!geminiKey) {
        const msg = 'No Gemini API key found: set GEMINI_API_KEY (env), a Secret Manager secret, or functions.config().gemini.key';
        console.error('[promoBrain] ' + msg);
        throw new Error(msg);
    }

    // Normalize into process.env for downstream consistency and easier debugging
    process.env.GEMINI_API_KEY = geminiKey;
    console.log('[promoBrain] Gemini API key source:', keySource || 'unknown');

    const _genaiOptions = {};
    _genaiOptions.apiKey = geminiKey;
    // NOTE: Do NOT include project/location when using apiKey — the client rejects that combination.
    const detectedProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    if (detectedProject) {
        console.log('[promoBrain] detected project id (not passed to client in apiKey mode):', detectedProject);
    }

    console.log('[promoBrain] auth mode: FORCE apiKey');
    ai = new GoogleGenAI(_genaiOptions);
    return ai;
}

/**
 * Append a lead row to the configured Google Sheet.
 * Row format: [date, name, email, company, message]
 */
async function appendLeadToSheet({ name, email, company, message }) {
    // Lazy fallback to functions.config() if needed (safe at runtime)
    if (!SHEET_ID) {
        try {
            if (functions && typeof functions.config === 'function') {
                const cfg = functions.config();
                if (cfg && cfg.lead && cfg.lead.sheet_id) {
                    // Only use legacy config as a last resort at runtime
                    SHEET_ID = cfg.lead.sheet_id;
                    console.warn('[leadReceiver] Using legacy functions.config().lead.sheet_id for SHEET_ID (deprecated).');
                }
            }
        } catch (e) {
            console.debug('[leadReceiver] functions.config() not available or failed at runtime:', e && e.message);
        }
    }
    if (!SHEET_ID) {
        throw new Error('Missing SHEET_ID environment variable. Cannot write lead to Google Sheets.');
    }

    const row = [
        new Date().toISOString(),
        name || '',
        email || '',
        company || '',
        message || ''
    ];

    try {
        console.log(`[leadReceiver] Appending lead to sheet ${SHEET_ID} range ${TAB_NAME}!A:E`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${TAB_NAME}!A:E`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] },
        });
        console.log('[leadReceiver] Lead appended successfully.');
    } catch (err) {
        console.error('[leadReceiver] Google Sheets append error:', err && err.message ? err.message : err);
        if (err && err.response && err.response.data) {
            console.error('[leadReceiver] Google API response:', JSON.stringify(err.response.data));
        }
        throw err;
    }
}

// De systeeminstructies die je CEO-agent (PromoBrain) definiëren
const systemInstruction = `
You are **PromoBrain**, the Autonomous CEO and Strategic Director for AIVaultsAI.
Your goal is to manage, prioritize, and optimize the workflow of the specialized agents (SiteSmith, AdArchitect, TokBot, VaultContent).
You analyze input (daily goals, performance reports) and output a daily action plan.
The output MUST be a prioritized list of tasks for the other agents, formatted in a clear Markdown list.
If data is missing (e.g., ROAS performance), your primary task is to prompt the user to provide it.
Your decisions are based on the core business goal: 100 Qualified Leads.
Language: Dutch.
`;

// De hoofdtaak van de Cloud Function
exports.promoBrainAutomation = onRequest(async (req, res) => {
    try {
        // Ensure AI client is initialized (reads env / secret manager / functions.config)
        await initializeAI();

        // De prompt die de gebruiker of een geautomatiseerd systeem stuurt
        // Dit is de dagelijkse standaardprompt van PromoBrain.
        const userPrompt = req.body?.prompt || `
            Voer de dagelijkse start-analyse uit. 
            Mijn doel is de AI Lead & Call Bot campagne te onderhouden en de content-kloof te dichten. 
            Vandaag is dag 2 van de lancering. Stel de 3 hoogste prioriteiten voor de agents op. 
            Ik heb nog geen ROAS data, dus plan de taak om dit te controleren.
        `;

        console.log(`PromoBrain gestart met prompt: ${userPrompt.trim()}`);

        // Roep de Gemini (Vertex AI) API aan
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2, // Lage temperatuur voor consistente planning
            },
        });

        const actionPlan = response.text.trim();

        // Log het actieplan en stuur het terug
        console.log("PromoBrain Actieplan succesvol gegenereerd.");
        
        res.status(200).send({
            status: "success",
            message: "PromoBrain heeft het dagelijkse actieplan gegenereerd. Zie 'actionPlan' voor details.",
            actionPlan: actionPlan
        });

    } catch (error) {
        console.error("Fout bij het aanroepen van PromoBrain:", error);
        res.status(500).send({
            status: "error",
            message: "Er is een fout opgetreden bij de PromoBrain-automatisering.",
            details: error.message
        });
    }
});

// HTTP endpoint to receive form submissions and forward them to Google Sheets
exports.leadReceiver = onRequest(async (req, res) => {
    try {
        // Support JSON and urlencoded form submissions. If body parser didn't run, try rawBody.
        let name = req.body && req.body.name;
        let email = req.body && req.body.email;
        let company = req.body && req.body.company;
        let message = req.body && req.body.message;

        // Fallback: parse rawBody for application/x-www-form-urlencoded
        const contentType = (req.headers && req.headers['content-type']) || '';
        if ((!name || !email) && req.rawBody && contentType.includes('application/x-www-form-urlencoded')) {
            try {
                const params = new URLSearchParams(req.rawBody.toString());
                name = name || params.get('name') || params.get('Naam') || params.get('naam');
                email = email || params.get('email');
                company = company || params.get('company') || params.get('Bedrijfsnaam') || params.get('bedrijf');
                message = message || params.get('message') || params.get('Bericht') || params.get('bericht');
            } catch (e) {
                console.warn('[leadReceiver] Could not parse rawBody:', e.message);
            }
        }

        // Minimal validation
        if (!name || !email) {
            console.log('[leadReceiver] Missing required fields', { name, email });
            return res.status(400).send({ status: 'error', message: 'Missing required fields: name and email' });
        }

        // Append to sheet
        await appendLeadToSheet({ name, email, company, message });

    // Redirect the browser to a thank-you page on the main site so standard HTML forms work.
    // Use 303 See Other for POST -> GET redirect semantics.
    const thankYouUrl = 'https://gen-lang-client-0919803756.web.app/?lead=success';
    console.log('[leadReceiver] Redirecting to', thankYouUrl);
    return res.redirect(303, thankYouUrl);
    } catch (err) {
        console.error('[leadReceiver] Error handling lead:', err && err.message ? err.message : err);
        return res.status(500).send({ status: 'error', message: 'Failed to save lead: ' + (err && err.message ? err.message : '') });
    }
});