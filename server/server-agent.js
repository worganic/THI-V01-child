/**
 * Worganic Platform - Agent Server (Orchestrateur)
 * =================================================
 * Responsable : exécution batch de prompts IA dans des branches git distinctes.
 *
 * Port: 3003
 *
 * Routes:
 *   POST /api/agent/run            → Lance le batch
 *   POST /api/agent/stop           → Arrête le run en cours
 *   POST /api/agent/chat/:runId    → Envoie un message à l'IA en cours
 *   GET  /api/agent/runs           → Liste des runs
 *   GET  /api/agent/runs/:runId    → État d'un run
 *   GET  /api/agent/stream/:runId  → SSE temps réel
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');

const gitManager = require('./modules/git-manager');
const agentState = require('./modules/agent-state');

const app = express();
const PORT = process.env.AGENT_PORT || 3003;

const DATA_DIR = path.join(__dirname, '..', 'data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config', 'conf.json');

// Process en cours d'exécution (runId -> { process })
const runningProcesses = new Map();

// Flag d'arrêt pour le batch
const stopFlags = new Set();

/**
 * Tuer un process enfant de façon fiable sur Windows et Unix.
 * Sur Windows avec shell:true, proc.kill('SIGTERM') tue seulement cmd.exe,
 * pas le process enfant (Gemini CLI) qui continue en orphelin.
 * taskkill /F /T /PID tue l'arbre entier.
 */
function killProcess(childProcess) {
    if (!childProcess) return;
    try { childProcess.stdin?.end(); } catch (_) {}
    try {
        if (os.platform() === 'win32') {
            try {
                execSync(`taskkill /F /T /PID ${childProcess.pid}`, { stdio: 'ignore', timeout: 3000 });
            } catch (_) {
                // Fallback si taskkill échoue
                try { childProcess.kill(); } catch (_) {}
            }
        } else {
            childProcess.kill('SIGTERM');
        }
    } catch (_) {}
}

// ============================================================
// Middleware
// ============================================================

app.use(cors({
    origin: ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4202', 'http://localhost:3001', 'http://127.0.0.1:4200', 'http://127.0.0.1:4202'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    console.log(`[AGENT] ${req.method} ${req.url}`);
    next();
});

// ============================================================
// Helpers
// ============================================================

function readIndexJson() {
    try {
        return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    } catch (e) {
        console.error('[AGENT] Error reading index.json:', e.message);
        return { actions: [] };
    }
}

function writeIndexJson(data) {
    try {
        fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[AGENT] Error writing index.json:', e.message);
    }
}

function readConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function getDefaultProviderModel() {
    const conf = readConfig();
    const provider = conf.cliConfig?.activeProviders?.[0] || 'claude';
    const models = conf.cliConfig?.enabledModels?.[provider] || [];
    const model = models[0] || (provider === 'claude' ? 'claude-sonnet-4-6' : 'gemini-2.0-flash');
    return { provider, model };
}

function generateRunId() {
    return `run-${Date.now()}`;
}

function updateActionExecution(actionId, updates) {
    try {
        const index = readIndexJson();
        const idx = index.actions.findIndex(a => a.id === actionId);
        if (idx === -1) return;

        if (!index.actions[idx].execution) {
            index.actions[idx].execution = {
                status: 'idle',
                runId: null,
                startedAt: null,
                completedAt: null,
                branchName: null,
                branchStatus: 'none',
                commitHash: null,
                branchPushed: false,
                modifiedFiles: [],
                output: '',
                errorMessage: null,
                chatHistory: []
            };
        }

        Object.assign(index.actions[idx].execution, updates);

        // Sync gitState and gitBranch for backward compatibility
        if (updates.branchName) {
            index.actions[idx].gitBranch = updates.branchName;
        }
        if (updates.branchStatus === 'pushed') {
            index.actions[idx].gitState = 'Pushé';
        } else if (updates.status === 'completed' && updates.commitHash) {
            index.actions[idx].gitState = 'Commité';
        }
        if (updates.modifiedFiles) {
            index.actions[idx].modifiedFiles = updates.modifiedFiles;
        }

        writeIndexJson(index);
    } catch (e) {
        console.error('[AGENT] Error updating action execution:', e.message);
    }
}

// ============================================================
// AI Execution (avec support chat bidirectionnel)
// ============================================================

function executePromptWithChat(runId, actionId, prompt, provider, model) {
    return new Promise((resolve, reject) => {
        const rawProvider = (provider || 'claude').split('-')[0];
        const finalModel = model || 'claude-sonnet-4-6';

        agentState.broadcast(runId, {
            type: 'ai_start',
            actionId,
            message: `> Démarrage ${rawProvider} (${finalModel})...\n`
        });

        let proc;
        let fullOutput = '';
        let lastOutputTime = Date.now();

        const childEnv = {
            ...process.env,
            FORCE_COLOR: '0',
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
            NODE_NO_READLINE: '1',
        };

        if (rawProvider === 'gemini') {
            proc = spawn('gemini', ['-m', finalModel, '--yolo'], {
                env: childEnv,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
        } else {
            // Claude : mode interactif avec stdin pipé
            proc = spawn('claude', ['--model', finalModel, '--dangerously-skip-permissions'], {
                env: childEnv,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });
        }

        if (!proc.pid) {
            return reject(new Error(`Impossible de lancer ${rawProvider}. Vérifiez que la CLI est installée.`));
        }

        // Log de démarrage avec PID
        const startMsg = `> Processus démarré (PID ${proc.pid})\n`;
        agentState.appendOutput(runId, startMsg);
        agentState.broadcast(runId, { type: 'ai_output', actionId, chunk: startMsg });

        // Stocker le process pour le chat
        runningProcesses.set(runId, { process: proc, provider: rawProvider });

        // Envoyer le prompt initial puis fermer stdin (EOF) :
        // → le CLI traite le prompt, répond, puis se termine proprement.
        // Si l'utilisateur envoie un message via /api/agent/chat avant la fermeture,
        // il sera écrit sur stdin. Après EOF, les messages déclenchent un nouveau process.
        if (proc.stdin) {
            proc.stdin.write(prompt + '\n');
            proc.stdin.end(); // EOF → déclenche traitement + sortie du process
        }

        // Timeout de sécurité : 10 min sans aucune sortie → kill
        const timeoutInterval = setInterval(() => {
            if (Date.now() - lastOutputTime > 10 * 60 * 1000) {
                clearInterval(timeoutInterval);
                const msg = '\n[Timeout] Aucune réponse depuis 10 minutes — arrêt forcé.\n';
                agentState.appendOutput(runId, msg);
                agentState.broadcast(runId, { type: 'ai_output', actionId, chunk: msg });
                killProcess(proc);
            }
        }, 30000);

        proc.stdout?.on('data', (data) => {
            const chunk = data.toString();
            lastOutputTime = Date.now();
            fullOutput += chunk;
            agentState.appendOutput(runId, chunk);
            agentState.broadcast(runId, { type: 'ai_output', actionId, chunk });
        });

        proc.stderr?.on('data', (data) => {
            const chunk = data.toString();
            lastOutputTime = Date.now();
            agentState.appendOutput(runId, `[stderr] ${chunk}`);
            agentState.broadcast(runId, { type: 'ai_output', actionId, chunk, isStderr: true });
        });

        proc.on('close', (code) => {
            clearInterval(timeoutInterval);
            runningProcesses.delete(runId);
            agentState.broadcast(runId, {
                type: 'ai_end',
                actionId,
                code,
                message: `\n> Processus terminé (code ${code})\n`
            });
            if (code === 0 || code === null) {
                resolve(fullOutput);
            } else {
                reject(new Error(`Processus terminé avec code ${code}`));
            }
        });

        proc.on('error', (err) => {
            clearInterval(timeoutInterval);
            runningProcesses.delete(runId);
            reject(new Error(`Erreur de lancement: ${err.message}`));
        });
    });
}

// ============================================================
// Batch Runner
// ============================================================

async function runBatch(runId, actionIds, provider, model, useGit) {
    console.log(`[AGENT] Starting batch run ${runId} with ${actionIds.length} action(s) | useGit=${useGit}`);

    try {
        // Vérifier/initialiser git seulement si useGit est activé
        const gitOk = useGit ? gitManager.ensureGitRepo() : false;

        agentState.broadcast(runId, {
            type: 'run_started',
            runId,
            totalActions: actionIds.length,
            gitAvailable: gitOk,
            useGit
        });

        for (let i = 0; i < actionIds.length; i++) {
            if (stopFlags.has(runId)) {
                agentState.updateRun(runId, { status: 'stopped', completedAt: new Date().toISOString() });
                agentState.broadcast(runId, { type: 'run_stopped', runId });
                stopFlags.delete(runId);
                return;
            }

            const actionId = actionIds[i];
            const index = readIndexJson();
            const action = index.actions.find(a => a.id === actionId);

            if (!action) {
                console.warn(`[AGENT] Action ${actionId} not found, skipping`);
                continue;
            }

            agentState.updateRun(runId, { currentActionId: actionId, currentActionIndex: i });
            agentState.broadcast(runId, {
                type: 'action_start',
                actionId,
                actionName: action.name,
                index: i,
                total: actionIds.length
            });

            // Marquer l'action comme "running"
            updateActionExecution(actionId, {
                status: 'running',
                startedAt: new Date().toISOString(),
                runId
            });

            let branchName = null;
            let commitHash = null;
            let pushed = false;

            try {
                // === Étape 1 : Créer la branche git (si useGit) ===
                if (useGit && gitOk) {
                    try {
                        checkoutMain();
                        branchName = `action/${actionId}-${gitManager.slugify(action.name)}`;
                        gitManager.createBranch(branchName);
                        agentState.broadcast(runId, {
                            type: 'branch_created',
                            actionId,
                            branchName,
                            message: `> Branche créée : ${branchName}\n`
                        });
                        agentState.appendOutput(runId, `\n=== Branche : ${branchName} ===\n`);
                    } catch (gitErr) {
                        console.warn(`[AGENT] Git branch error: ${gitErr.message}`);
                        agentState.broadcast(runId, {
                            type: 'git_warning',
                            actionId,
                            message: `[Git] Avertissement: ${gitErr.message}\n`
                        });
                    }
                } else if (!useGit) {
                    agentState.broadcast(runId, {
                        type: 'system',
                        actionId,
                        message: `> Mode sans Git — exécution directe\n`
                    });
                }

                agentState.appendOutput(runId, `\n=== Action : ${action.name} ===\n${action.prompt}\n\n`);

                // === Étape 2 : Exécuter le prompt ===
                const output = await executePromptWithChat(runId, actionId, action.prompt, provider, model);

                // === Étape 3 : Récupérer les fichiers modifiés (si useGit) ===
                let modifiedFiles = [];
                if (useGit && gitOk) {
                    modifiedFiles = gitManager.getModifiedFiles();
                    agentState.broadcast(runId, {
                        type: 'files_detected',
                        actionId,
                        modifiedFiles,
                        message: `> ${modifiedFiles.length} fichier(s) modifié(s)\n`
                    });
                }

                // === Étape 4 : Commit + Push (si useGit) ===
                if (useGit && gitOk && branchName) {
                    try {
                        commitHash = gitManager.commitAll(`action(${actionId}): ${action.name}`);
                        if (commitHash) {
                            agentState.broadcast(runId, {
                                type: 'committed',
                                actionId,
                                commitHash,
                                message: `> Commit : ${commitHash}\n`
                            });
                        }
                        pushed = gitManager.pushBranch(branchName);
                        if (pushed) {
                            agentState.broadcast(runId, {
                                type: 'pushed',
                                actionId,
                                branchName,
                                message: `> Branch poussée vers origin/${branchName}\n`
                            });
                        }
                    } catch (gitErr) {
                        console.warn(`[AGENT] Git commit/push error: ${gitErr.message}`);
                    }
                }

                // === Étape 5 : Mettre à jour l'action ===
                const run = agentState.getRun(runId);
                updateActionExecution(actionId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    branchName: branchName || '',
                    branchStatus: pushed ? 'pushed' : (commitHash ? 'committed' : (branchName ? 'created' : 'none')),
                    commitHash: commitHash || null,
                    branchPushed: pushed,
                    modifiedFiles,
                    output: output.substring(0, 5000), // Limiter la taille
                    chatHistory: run ? [...run.chatHistory] : []
                });

                const currentRun = agentState.getRun(runId);
                const newCompleted = (currentRun?.results?.completed || 0) + 1;
                agentState.updateRun(runId, {
                    results: {
                        ...currentRun.results,
                        completed: newCompleted
                    }
                });

                agentState.broadcast(runId, {
                    type: 'action_done',
                    actionId,
                    actionName: action.name,
                    modifiedFiles,
                    branchName,
                    commitHash,
                    pushed
                });

            } catch (actionError) {
                console.error(`[AGENT] Action ${actionId} failed:`, actionError.message);

                const failedRun = agentState.getRun(runId);
                updateActionExecution(actionId, {
                    status: 'failed',
                    completedAt: new Date().toISOString(),
                    errorMessage: actionError.message,
                    chatHistory: failedRun ? [...failedRun.chatHistory] : []
                });

                const currentRun = agentState.getRun(runId);
                const newFailed = (currentRun?.results?.failed || 0) + 1;
                agentState.updateRun(runId, {
                    results: {
                        ...currentRun.results,
                        failed: newFailed
                    }
                });

                agentState.broadcast(runId, {
                    type: 'action_failed',
                    actionId,
                    actionName: action.name,
                    error: actionError.message
                });
            }
        }

        // Run terminé — ne pas écraser un statut 'stopped' défini par /api/agent/stop
        const finalRun = agentState.getRun(runId);
        if (finalRun?.status === 'stopped') {
            console.log(`[AGENT] Run ${runId} already stopped, skipping run_completed`);
            return;
        }

        agentState.updateRun(runId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            currentActionId: null
        });

        agentState.broadcast(runId, {
            type: 'run_completed',
            runId,
            results: finalRun?.results || {}
        });

    } catch (e) {
        console.error(`[AGENT] Batch run ${runId} failed:`, e.message);
        // Ne pas écraser un statut 'stopped' défini par /api/agent/stop
        const stoppedRun = agentState.getRun(runId);
        if (stoppedRun?.status === 'stopped') return;

        agentState.updateRun(runId, {
            status: 'failed',
            completedAt: new Date().toISOString()
        });
        agentState.broadcast(runId, {
            type: 'run_failed',
            runId,
            error: e.message
        });
    }
}

function checkoutMain() {
    try {
        gitManager.checkoutMain();
    } catch (e) {
        console.warn('[AGENT] checkoutMain failed:', e.message);
    }
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/agent/run
 * Lance un batch d'actions.
 * Body: { actionIds: string[], provider?: string, model?: string }
 */
app.post('/api/agent/run', (req, res) => {
    const { actionIds, provider, model, useGit } = req.body;

    if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
        return res.status(400).json({ error: 'actionIds requis (tableau non vide)' });
    }

    // Vérifier qu'il n'y a pas déjà un run actif
    const active = agentState.getActiveRun();
    if (active) {
        return res.status(409).json({
            error: 'Un run est déjà en cours',
            runId: active.id,
            liveUrl: `/agent/live/${active.id}`
        });
    }

    // Résoudre le provider/model
    const defaults = getDefaultProviderModel();
    const finalProvider = provider || defaults.provider;
    const finalModel = model || defaults.model;
    // useGit: true par défaut si non précisé
    const finalUseGit = useGit !== false;

    const runId = generateRunId();
    const run = agentState.createRun(runId, actionIds, 'admin', finalProvider, finalModel);

    // Lancer le batch en arrière-plan
    setImmediate(() => runBatch(runId, actionIds, finalProvider, finalModel, finalUseGit));

    res.json({
        success: true,
        runId,
        liveUrl: `/agent/live/${runId}`,
        provider: finalProvider,
        model: finalModel,
        totalActions: actionIds.length,
        useGit: finalUseGit
    });
});

/**
 * POST /api/agent/stop
 * Arrête le run en cours.
 * Body: { runId: string }
 */
app.post('/api/agent/stop', (req, res) => {
    const { runId } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId requis' });

    const run = agentState.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run non trouvé' });

    if (run.status !== 'running') {
        return res.json({ success: true, message: 'Run déjà terminé' });
    }

    stopFlags.add(runId);

    const now = new Date().toISOString();

    // Mettre à jour le statut du run immédiatement (ne pas attendre la fin du process)
    agentState.updateRun(runId, { status: 'stopped', completedAt: now });

    // Mettre à jour l'action en cours dans index.json (sinon elle reste "running" dans l'admin)
    if (run.currentActionId) {
        updateActionExecution(run.currentActionId, {
            status: 'stopped',
            completedAt: now,
            errorMessage: 'Run arrêté par l\'utilisateur'
        });
    }

    // Tuer le process enfant (arbre complet sur Windows via taskkill)
    const proc = runningProcesses.get(runId);
    if (proc) {
        killProcess(proc.process);
        runningProcesses.delete(runId);
    }

    // Broadcaster immédiatement run_stopped aux clients SSE
    agentState.broadcast(runId, { type: 'run_stopped', runId });

    res.json({ success: true, message: 'Arrêt demandé' });
});

/**
 * POST /api/agent/chat/:runId
 * Envoie un message à l'IA en cours d'exécution.
 * Body: { message: string }
 */
app.post('/api/agent/chat/:runId', (req, res) => {
    const { runId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
        return res.status(400).json({ error: 'message requis' });
    }

    // Enregistrer et broadcaster le message utilisateur dans tous les cas
    agentState.addChatMessage(runId, 'user', message);
    agentState.broadcast(runId, {
        type: 'user_message',
        message,
        timestamp: new Date().toISOString()
    });

    const proc = runningProcesses.get(runId);

    if (!proc || proc.process.stdin?.destroyed) {
        // Le process IA s'est terminé après avoir répondu au prompt initial.
        // Le message est enregistré dans chatHistory mais ne peut pas être livré.
        const note = `[Système] Le processus IA a terminé. Message enregistré : "${message.substring(0, 80)}${message.length > 80 ? '…' : ''}"\n`;
        agentState.appendOutput(runId, note);
        agentState.broadcast(runId, { type: 'ai_output', chunk: note });
        return res.json({ success: true, note: 'process_ended' });
    }

    try {
        if (proc.process.stdin && !proc.process.stdin.destroyed) {
            proc.process.stdin.write(message + '\n');
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/agent/continue/:runId
 * Relance une conversation IA après que le process initial s'est terminé.
 * Construit un prompt de continuation avec le contexte liveOutput.
 * Body: { message: string }
 */
app.post('/api/agent/continue/:runId', async (req, res) => {
    const { runId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
        return res.status(400).json({ error: 'message requis' });
    }

    const run = agentState.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run non trouvé' });
    if (run.status === 'running') return res.status(409).json({ error: 'Run déjà en cours' });

    // Enregistrer le message utilisateur
    agentState.addChatMessage(runId, 'user', message);
    agentState.broadcast(runId, {
        type: 'user_message',
        message,
        timestamp: new Date().toISOString()
    });

    // Remettre le run en état "running" (reconnecte le SSE frontend)
    agentState.updateRun(runId, { status: 'running', completedAt: null });

    // Construire un prompt de continuation avec les 3000 derniers caractères de contexte
    const context = run.liveOutput.slice(-3000);
    const continuationPrompt = `Voici la fin de notre échange précédent :\n\n${context}\n\n---\nRéponds maintenant à ceci : ${message}`;

    const separatorMsg = `\n--- Suite de conversation ---\n> Utilisateur : ${message}\n`;
    agentState.appendOutput(runId, separatorMsg);
    agentState.broadcast(runId, { type: 'ai_output', chunk: separatorMsg });

    // Répondre immédiatement au frontend, exécution en background
    res.json({ success: true, runId });

    try {
        await executePromptWithChat(runId, run.actionIds[0] || 'continuation', continuationPrompt, run.provider, run.model);
        agentState.updateRun(runId, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        agentState.broadcast(runId, { type: 'run_completed', runId, results: run.results });
    } catch (e) {
        const errMsg = e.message || 'Erreur inconnue';
        agentState.appendOutput(runId, `\n[Erreur] ${errMsg}\n`);
        agentState.broadcast(runId, { type: 'ai_output', chunk: `\n[Erreur] ${errMsg}\n` });
        agentState.updateRun(runId, {
            status: 'failed',
            completedAt: new Date().toISOString()
        });
        agentState.broadcast(runId, { type: 'run_failed', runId, error: errMsg });
    }
});

/**
 * GET /api/agent/runs
 * Liste tous les runs.
 */
app.get('/api/agent/runs', (req, res) => {
    res.json({ runs: agentState.getAllRuns() });
});

/**
 * GET /api/agent/runs/active
 * Retourne le run actif (s'il y en a un).
 */
app.get('/api/agent/runs/active', (req, res) => {
    const active = agentState.getActiveRun();
    res.json({ run: active || null });
});

/**
 * GET /api/agent/runs/:runId
 * État complet d'un run.
 */
app.get('/api/agent/runs/:runId', (req, res) => {
    const run = agentState.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run non trouvé' });
    res.json({ run });
});

/**
 * GET /api/agent/stream/:runId
 * SSE : stream temps réel d'un run.
 * Si le run est terminé, renvoie l'état final + event 'run_completed'.
 */
app.get('/api/agent/stream/:runId', (req, res) => {
    const { runId } = req.params;
    const run = agentState.getRun(runId);

    if (!run) {
        return res.status(404).json({ error: 'Run non trouvé' });
    }

    // Setup SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Envoyer l'état actuel en premier (replay pour les reconnexions)
    res.write(`data: ${JSON.stringify({
        type: 'state_replay',
        run: {
            id: run.id,
            status: run.status,
            provider: run.provider,
            model: run.model,
            actionIds: run.actionIds,
            currentActionId: run.currentActionId,
            currentActionIndex: run.currentActionIndex,
            results: run.results,
            chatHistory: run.chatHistory,
            liveOutput: run.liveOutput
        }
    })}\n\n`);

    // Si le run est déjà terminé, envoyer l'event final et fermer
    if (run.status !== 'running') {
        res.write(`data: ${JSON.stringify({ type: `run_${run.status}`, runId, results: run.results })}\n\n`);
        res.end();
        return;
    }

    // Sinon, rester connecté et recevoir les events en temps réel
    agentState.addSSEClient(runId, res);

    const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        }
    }, 15000);

    req.on('close', () => {
        clearInterval(heartbeat);
        agentState.removeSSEClient(runId, res);
    });
});

// ============================================================
// Server Startup
// ============================================================

app.listen(PORT, () => {
    console.log(`
+==========================================+
|   Worganic - AGENT Server                |
+==========================================+

  Port:       http://localhost:${PORT}
  Rôle:       Orchestrateur de prompts IA

  Endpoints:
    POST /api/agent/run            → Lancer batch
    POST /api/agent/stop           → Arrêter
    POST /api/agent/chat/:runId    → Envoyer message IA
    GET  /api/agent/runs           → Liste des runs
    GET  /api/agent/stream/:runId  → SSE temps réel

  Press CTRL+C to stop
    `);
});

process.on('SIGINT', () => { console.log('\nShutting down agent server...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\nShutting down agent server...'); process.exit(0); });
process.on('uncaughtException', (err) => { console.error('[AGENT] Uncaught exception:', err); });
process.on('unhandledRejection', (reason) => { console.error('[AGENT] Unhandled rejection:', reason); });
