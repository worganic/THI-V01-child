/**
 * Worganic - Agent State Module
 * Gestion de l'état en mémoire des runs + persistence dans data/agent-runs.json.
 */

const fs = require('fs');
const path = require('path');

const RUNS_FILE = path.join(__dirname, '..', '..', 'data', 'agent-runs.json');

// État en mémoire
let runs = {};           // runId -> run object
let sseClients = {};     // runId -> array of { res, id }

let saveTimeout = null;

// ============================================================
// Persistence
// ============================================================

function loadRuns() {
    try {
        if (fs.existsSync(RUNS_FILE)) {
            const data = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8'));
            runs = {};
            (data.runs || []).forEach(r => { runs[r.id] = r; });
            console.log(`[AgentState] Loaded ${Object.keys(runs).length} run(s) from disk`);
            // Au démarrage, marquer comme "failed" tous les runs encore "running"
            // (processus tués lors du redémarrage du serveur)
            const staleIds = Object.keys(runs).filter(id => runs[id].status === 'running');
            if (staleIds.length > 0) {
                staleIds.forEach(id => {
                    runs[id].status = 'failed';
                    runs[id].completedAt = new Date().toISOString();
                    runs[id].liveOutput = (runs[id].liveOutput || '') + '\n[Serveur redémarré — exécution interrompue]\n';
                });
                console.log(`[AgentState] Marked ${staleIds.length} stale run(s) as failed`);
                saveRuns();
            }
        }
    } catch (e) {
        console.error('[AgentState] Error loading runs:', e.message);
    }
}

function saveRuns() {
    // Debounce saves (max 1 write per 200ms)
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            fs.mkdirSync(path.dirname(RUNS_FILE), { recursive: true });
            fs.writeFileSync(RUNS_FILE, JSON.stringify({ runs: Object.values(runs) }, null, 2), 'utf8');
        } catch (e) {
            console.error('[AgentState] Error saving runs:', e.message);
        }
    }, 200);
}

// ============================================================
// Run management
// ============================================================

function createRun(runId, actionIds, triggeredBy, provider, model) {
    runs[runId] = {
        id: runId,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'running',
        triggeredBy: triggeredBy || 'user',
        provider: provider || 'claude',
        model: model || 'claude-sonnet-4-6',
        actionIds: [...actionIds],
        currentActionId: null,
        currentActionIndex: -1,
        results: { total: actionIds.length, completed: 0, failed: 0 },
        liveOutput: '',
        chatHistory: []
    };
    saveRuns();
    return runs[runId];
}

function getRun(runId) {
    return runs[runId] || null;
}

function getActiveRun() {
    return Object.values(runs).find(r => r.status === 'running') || null;
}

function getAllRuns() {
    return Object.values(runs).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function updateRun(runId, updates) {
    if (!runs[runId]) return;
    Object.assign(runs[runId], updates);
    saveRuns();
}

function appendOutput(runId, chunk) {
    if (!runs[runId]) return;
    runs[runId].liveOutput += chunk;
    saveRuns();
}

function addChatMessage(runId, role, content) {
    if (!runs[runId]) return;
    const msg = { role, content, timestamp: new Date().toISOString() };
    runs[runId].chatHistory.push(msg);
    saveRuns();
    return msg;
}

// ============================================================
// SSE client management
// ============================================================

function addSSEClient(runId, res) {
    if (!sseClients[runId]) sseClients[runId] = [];
    sseClients[runId].push(res);
    console.log(`[AgentState] SSE client added for run ${runId} (total: ${sseClients[runId].length})`);
}

function removeSSEClient(runId, res) {
    if (!sseClients[runId]) return;
    sseClients[runId] = sseClients[runId].filter(r => r !== res);
    console.log(`[AgentState] SSE client removed for run ${runId} (total: ${sseClients[runId].length})`);
}

function broadcast(runId, event) {
    const clients = sseClients[runId] || [];
    if (clients.length === 0) return;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    clients.forEach(res => {
        try {
            if (!res.writableEnded) res.write(data);
        } catch (e) {
            // Client disconnected
        }
    });
}

function broadcastAll(event) {
    Object.keys(sseClients).forEach(runId => broadcast(runId, event));
}

// Initialize on load
loadRuns();

module.exports = {
    createRun,
    getRun,
    getActiveRun,
    getAllRuns,
    updateRun,
    appendOutput,
    addChatMessage,
    addSSEClient,
    removeSSEClient,
    broadcast,
    broadcastAll,
    saveRuns
};
