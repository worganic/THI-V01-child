/**
 * deploy-log.js — Enregistre un déploiement directement en BDD
 *
 * Usage :
 *   node server/deploy-log.js \
 *     --version 0.07 \
 *     --commit "v0.07 - 20260321 - Mon titre" \
 *     --description "Ce qui a été fait" \
 *     --ai "Claude Code" \
 *     --model "claude-sonnet-4-6" \
 *     --mods "mod-291, mod-292" \
 *     --files "server/server-data.js,frankenstein/src/app/app.component.ts"
 *     --scope "frankenstein,server"
 */

const pool = require('./db');

function arg(name) {
    const idx = process.argv.indexOf(`--${name}`);
    return idx !== -1 ? process.argv[idx + 1] : '';
}

async function run() {
    const version     = arg('version');
    const commitName  = arg('commit');
    const description = arg('description');
    const ai          = arg('ai') || 'Claude Code';
    const model       = arg('model') || 'claude-sonnet-4-6';
    const modIds      = arg('mods') || '';
    const filesRaw    = arg('files') || '';
    const scope       = arg('scope') || '';
    const features    = arg('features') || '';
    const deployedBy  = arg('deployed-by') || process.env.USERNAME || process.env.USER || ai;

    if (!version || !commitName) {
        console.error('Usage: node deploy-log.js --version X.XX --commit "titre" [options]');
        process.exit(1);
    }

    const files = filesRaw ? JSON.stringify(filesRaw.split(',').map(f => f.trim())) : '[]';

    await pool.query(
        `INSERT INTO app_deployments
         (version, commit_name, deployed_by, description, files_modified, ai, model, mod_ids, scope, features)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [version, commitName, deployedBy, description, files, ai, model, modIds, scope, features]
    );

    console.log(`[deploy-log] ✓ Déploiement v${version} enregistré en BDD.`);
    process.exit(0);
}

run().catch(e => {
    console.error('[deploy-log] Erreur :', e.message);
    process.exit(1);
});
