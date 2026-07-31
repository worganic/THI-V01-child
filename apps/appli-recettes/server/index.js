/**
 * Worganic — Backend de la sous-application `apps/appli-recettes` (montée dans
 * le portail sur /recettes) : cahiers de recette, campagnes et sessions de test.
 *
 * Co-localisé avec le frontend (apps/appli-recettes/) plutôt que dans
 * server/modules/ : c'est le contrat "sous-application" (voir
 * docs/architecture-sous-applications.md) — tout ce qui compose les recettes
 * vit dans ce seul dossier, portable tel quel vers un autre portail.
 *
 * Données en MySQL (tables recette_*) : données transverses partagées entre tous
 * les utilisateurs du portail (voir CLAUDE.md).
 *
 * Les identifiants sont générés côté client (chaînes du type `book-1712…`) : les
 * routes font donc systématiquement un upsert (INSERT … ON DUPLICATE KEY UPDATE)
 * plutôt qu'un INSERT/UPDATE distinct — c'est le contrat de l'API d'origine, que
 * `RecipeService` appelle avec les mêmes payloads en création et en édition.
 *
 * Montage : require('../apps/appli-recettes/server').register(app, { pool, getSessionUser })
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { upsertCatalogEntry, markAppMounted } = require('../../../server/modules/portal-apps');

// Entrée de catalogue `portal_apps` propre aux recettes (voir upsertCatalogEntry
// ci-dessous) : ce module n'a plus besoin d'être connu par son nom dans
// server/modules/portal-apps.js pour apparaître dans le menu des applications.
const CATALOG_ENTRY = {
    code: 'appli-recettes', nom: 'Recettes', description: 'Cahiers de recette et campagnes de test',
    url_path: '/recettes', icone: 'restaurant_menu', ordre: 3
};

// Dossier des captures d'écran annotées, servi par express.static('/data')
// (__dirname = apps/appli-recettes/server/, 3 niveaux jusqu'à la racine du repo
// depuis le déménagement hors de server/modules/ — contrat "sous-application",
// voir docs/architecture-sous-applications.md)
const CAPTURES_DIR = path.join(__dirname, '..', '..', '..', 'data', 'recettes', 'captures');
const CAPTURES_URL = '/data/recettes/captures';

/**
 * Registre des entités : une entrée = une table + ses colonnes. Toutes les routes
 * CRUD sont générées à partir de ce registre (voir register()).
 *
 * `key` : colonnes formant l'identité d'une ligne (clé primaire). Les réponses de
 * test sont identifiées par le couple session/test (ou session/tâche), pas par un id.
 */
const ENTITIES = [
    {
        name: 'recipe_book',
        table: 'recette_books',
        key: ['id'],
        columns: ['id', 'name', 'description', 'date_created'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_books (
            id           VARCHAR(64) PRIMARY KEY,
            name         VARCHAR(200) NOT NULL,
            description  TEXT DEFAULT NULL,
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    },
    {
        name: 'recipe_category',
        table: 'recette_categories',
        key: ['id'],
        columns: ['id', 'recipe_book_id', 'name', 'comment', 'url', 'created_by'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_categories (
            id             VARCHAR(64) PRIMARY KEY,
            recipe_book_id VARCHAR(64) NOT NULL,
            name           VARCHAR(200) NOT NULL,
            comment        TEXT DEFAULT NULL,
            url            VARCHAR(500) DEFAULT NULL,
            created_by     VARCHAR(120) DEFAULT NULL,
            INDEX idx_cat_book (recipe_book_id)
        )`
    },
    {
        name: 'recipe_applicatif',
        table: 'recette_applicatifs',
        key: ['id'],
        columns: ['id', 'category_id', 'name', 'description', 'url', 'created_by'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_applicatifs (
            id          VARCHAR(64) PRIMARY KEY,
            category_id VARCHAR(64) NOT NULL,
            name        VARCHAR(200) NOT NULL,
            description TEXT DEFAULT NULL,
            url         VARCHAR(500) DEFAULT NULL,
            created_by  VARCHAR(120) DEFAULT NULL,
            INDEX idx_app_cat (category_id)
        )`
    },
    {
        name: 'recipe_section',
        table: 'recette_sections',
        key: ['id'],
        columns: ['id', 'applicatif_id', 'name', 'description', 'url', 'created_by', 'order_index'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_sections (
            id            VARCHAR(64) PRIMARY KEY,
            applicatif_id VARCHAR(64) NOT NULL,
            name          VARCHAR(200) NOT NULL,
            description   TEXT DEFAULT NULL,
            url           VARCHAR(500) DEFAULT NULL,
            created_by    VARCHAR(120) DEFAULT NULL,
            order_index   INT DEFAULT 0,
            INDEX idx_sec_app (applicatif_id)
        )`
    },
    {
        name: 'recipe_test',
        table: 'recette_tests',
        key: ['id'],
        columns: ['id', 'section_id', 'name', 'description', 'criticality', 'url', 'created_by', 'order_index'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_tests (
            id          VARCHAR(64) PRIMARY KEY,
            section_id  VARCHAR(64) NOT NULL,
            name        VARCHAR(300) NOT NULL,
            description TEXT DEFAULT NULL,
            criticality VARCHAR(20) DEFAULT 'Majeur',
            url         VARCHAR(500) DEFAULT NULL,
            created_by  VARCHAR(120) DEFAULT NULL,
            order_index INT DEFAULT 0,
            INDEX idx_test_sec (section_id)
        )`
    },
    {
        name: 'recipe_task',
        table: 'recette_tasks',
        key: ['id'],
        columns: ['id', 'test_id', 'name', 'order_index'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_tasks (
            id          VARCHAR(64) PRIMARY KEY,
            test_id     VARCHAR(64) NOT NULL,
            name        VARCHAR(300) NOT NULL,
            order_index INT DEFAULT 0,
            INDEX idx_task_test (test_id)
        )`
    },
    {
        name: 'test_campaign',
        table: 'recette_campaigns',
        key: ['id'],
        columns: ['id', 'recipe_book_id', 'name', 'created_by', 'date_created', 'status', 'environment'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_campaigns (
            id             VARCHAR(64) PRIMARY KEY,
            recipe_book_id VARCHAR(64) NOT NULL,
            name           VARCHAR(200) NOT NULL,
            created_by     VARCHAR(120) DEFAULT NULL,
            date_created   DATETIME DEFAULT CURRENT_TIMESTAMP,
            status         VARCHAR(30) DEFAULT 'IN_PROGRESS',
            environment    VARCHAR(20) DEFAULT 'VAL',
            INDEX idx_camp_book (recipe_book_id)
        )`
    },
    {
        name: 'test_session',
        table: 'recette_sessions',
        key: ['id'],
        columns: ['id', 'recipe_book_id', 'campaign_id', 'tester_name', 'title', 'mode', 'date_executed', 'status', 'environment'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_sessions (
            id             VARCHAR(64) PRIMARY KEY,
            recipe_book_id VARCHAR(64) NOT NULL,
            campaign_id    VARCHAR(64) DEFAULT NULL,
            tester_name    VARCHAR(160) DEFAULT NULL,
            title          VARCHAR(300) DEFAULT NULL,
            mode           VARCHAR(30) DEFAULT 'Manuel',
            date_executed  DATETIME DEFAULT NULL,
            status         VARCHAR(30) DEFAULT 'PENDING',
            environment    VARCHAR(20) DEFAULT 'VAL',
            INDEX idx_sess_book (recipe_book_id)
        )`
    },
    {
        name: 'test_response',
        table: 'recette_responses',
        key: ['session_id', 'test_id'],
        columns: ['session_id', 'test_id', 'status', 'notes', 'date_responded', 'capture_path'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_responses (
            session_id     VARCHAR(64) NOT NULL,
            test_id        VARCHAR(64) NOT NULL,
            status         VARCHAR(30) DEFAULT NULL,
            notes          TEXT DEFAULT NULL,
            date_responded DATETIME DEFAULT NULL,
            capture_path   VARCHAR(500) DEFAULT NULL,
            PRIMARY KEY (session_id, test_id)
        )`
    },
    {
        name: 'test_task_response',
        table: 'recette_task_responses',
        key: ['session_id', 'task_id'],
        columns: ['session_id', 'task_id', 'status', 'notes', 'capture_path'],
        ddl: `CREATE TABLE IF NOT EXISTS recette_task_responses (
            session_id   VARCHAR(64) NOT NULL,
            task_id      VARCHAR(64) NOT NULL,
            status       VARCHAR(30) DEFAULT NULL,
            notes        TEXT DEFAULT NULL,
            capture_path VARCHAR(500) DEFAULT NULL,
            PRIMARY KEY (session_id, task_id)
        )`
    },
];

async function ensureSchema(pool) {
    try {
        for (const e of ENTITIES) await pool.query(e.ddl);
        fs.mkdirSync(CAPTURES_DIR, { recursive: true });
        await upsertCatalogEntry(pool, CATALOG_ENTRY);
    } catch (e) {
        console.error('[Recettes] Erreur init schéma:', e.message);
    }
}

function register(app, { pool, getSessionUser }) {
    // Preuve que ce module (donc le dossier apps/appli-recettes/) est bien présent
    // dans cette installation — voir markAppMounted/isAppAvailable dans portal-apps.js.
    markAppMounted(CATALOG_ENTRY.code);

    function requireUser(req, res) {
        const user = getSessionUser(req);
        if (!user) { res.status(401).json({ error: 'Non authentifié' }); return null; }
        return user;
    }

    function fail(res, context, e) {
        console.error(`[Recettes] ${context}:`, e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }

    /** Convertit les DATETIME MySQL en chaîne ISO — le front les reformate lui-même. */
    function serialize(row) {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            out[k] = v instanceof Date ? v.toISOString() : v;
        }
        return out;
    }

    /** Upsert d'une ligne à partir du payload front, en ne gardant que les colonnes connues. */
    async function upsert(entity, body) {
        const cols = entity.columns.filter(c => body[c] !== undefined);
        if (!cols.length) throw new Error('payload vide');
        for (const k of entity.key) {
            if (!cols.includes(k)) throw new Error(`${k} est requis`);
        }
        const values = cols.map(c => (body[c] === '' ? null : body[c]));
        const updatable = cols.filter(c => !entity.key.includes(c));
        const updateClause = updatable.length
            ? updatable.map(c => `${c} = VALUES(${c})`).join(', ')
            // Ligne sans colonne modifiable (clé seule) : on réaffirme la clé pour que
            // ON DUPLICATE KEY reste syntaxiquement valide et l'appel idempotent.
            : `${entity.key[0]} = VALUES(${entity.key[0]})`;

        await pool.query(
            `INSERT INTO ${entity.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${updateClause}`,
            values
        );
    }

    // ── Routes CRUD générées pour chaque entité ──────────────────────────────
    //
    // Verbes conservés depuis l'API d'origine (le front les appelle tels quels) :
    //   GET  <entité>/            → liste (filtrable par n'importe quelle colonne en query)
    //   POST <entité>/            → création (upsert)
    //   POST <entité>/update/     → mise à jour (upsert)
    //   POST <entité>/update2/    → idem, variante utilisée pour les réponses de test
    //   POST <entité>/del/        → suppression par clé

    for (const entity of ENTITIES) {
        const base = `/api/recettes/${entity.name}`;

        app.get(`${base}/`, async (req, res) => {
            if (!requireUser(req, res)) return;
            try {
                const filters = entity.columns.filter(c => req.query[c] !== undefined);
                const where = filters.length ? ` WHERE ${filters.map(c => `${c} = ?`).join(' AND ')}` : '';
                const [rows] = await pool.query(
                    `SELECT * FROM ${entity.table}${where}`,
                    filters.map(c => req.query[c])
                );
                res.json(rows.map(serialize));
            } catch (e) { fail(res, `get ${entity.name}`, e); }
        });

        const save = async (req, res) => {
            if (!requireUser(req, res)) return;
            try {
                await upsert(entity, req.body || {});
                res.json({ success: true });
            } catch (e) {
                if (/est requis|payload vide/.test(e.message)) {
                    return res.status(400).json({ error: e.message });
                }
                fail(res, `save ${entity.name}`, e);
            }
        };

        app.post(`${base}/`, save);
        app.post(`${base}/update/`, save);
        app.post(`${base}/update2/`, save);

        app.post(`${base}/del/`, async (req, res) => {
            if (!requireUser(req, res)) return;
            const body = req.body || {};
            const missing = entity.key.filter(k => body[k] === undefined);
            if (missing.length) return res.status(400).json({ error: `${missing.join(', ')} requis` });
            try {
                await pool.query(
                    `DELETE FROM ${entity.table} WHERE ${entity.key.map(k => `${k} = ?`).join(' AND ')}`,
                    entity.key.map(k => body[k])
                );
                res.json({ success: true });
            } catch (e) { fail(res, `delete ${entity.name}`, e); }
        });
    }

    // ── Testeurs (utilisateurs du portail) ───────────────────────────────────

    app.get('/api/recettes/users/', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, username, email FROM users ORDER BY username');
            // Le front attend { id, nom, prenom, matricule } : le portail n'a qu'un
            // nom d'utilisateur, découpé ici de la même façon que dans le module agenda.
            res.json(rows.map(r => {
                const parts = String(r.username || '').split(/[\s._-]+/).filter(Boolean);
                return {
                    id: String(r.id),
                    prenom: parts[0] || r.username || '',
                    nom: parts.slice(1).join(' ').toUpperCase(),
                    matricule: r.username || ''
                };
            }));
        } catch (e) { fail(res, 'get users', e); }
    });

    // ── Captures d'écran annotées ────────────────────────────────────────────

    app.post('/api/recettes/capture/upload/', async (req, res) => {
        if (!requireUser(req, res)) return;
        const { dataUrl } = req.body || {};
        const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl || '');
        if (!match) return res.status(400).json({ error: 'dataUrl image attendue' });
        try {
            const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
            const file = `capture-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
            fs.mkdirSync(CAPTURES_DIR, { recursive: true });
            fs.writeFileSync(path.join(CAPTURES_DIR, file), Buffer.from(match[2], 'base64'));
            // URL absolue : la capture est affichée directement en <img [src]>, depuis
            // le portail servi sur un autre port que l'API.
            res.json({ path: `${req.protocol}://${req.get('host')}${CAPTURES_URL}/${file}` });
        } catch (e) { fail(res, 'upload capture', e); }
    });

    console.log('[Recettes] Routes /api/recettes/* montées');
}

module.exports = { register, ensureSchema };
