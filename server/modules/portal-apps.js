/**
 * Worganic — Module Portail : sous-applications, groupes, métiers et droits.
 *
 * Toutes les données sont en MySQL (tables portal_*) : ce sont des données
 * d'administration transverses, partagées entre tous les utilisateurs.
 *
 * Montage : require('./modules/portal-apps').register(app, { pool, getSessionUser })
 */

const DROITS_VALIDES = ['lecture', 'ecriture', 'admin'];

// Schéma des tables du portail — identique à celui de server/init-db.js, rejoué
// au démarrage du serveur pour que les routes fonctionnent sans migration manuelle.
const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS portal_metiers (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        nom        VARCHAR(120)  NOT NULL,
        color      VARCHAR(20)   DEFAULT 'blue',
        is_active  TINYINT(1)    DEFAULT 1,
        created_at DATETIME      DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS portal_apps (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        code        VARCHAR(120)  NOT NULL UNIQUE,
        nom         VARCHAR(120)  NOT NULL,
        description TEXT          DEFAULT NULL,
        url_path    VARCHAR(500)  DEFAULT '',
        icone       VARCHAR(120)  DEFAULT 'apps',
        ordre       INT           DEFAULT 0,
        is_active   TINYINT(1)    DEFAULT 1,
        created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS portal_groupes (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        nom         VARCHAR(120)  NOT NULL,
        description TEXT          DEFAULT NULL,
        ordre       INT           DEFAULT 0,
        is_active   TINYINT(1)    DEFAULT 1,
        created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS portal_groupe_apps (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        groupe_id INT NOT NULL,
        app_id    INT NOT NULL,
        UNIQUE KEY uniq_groupe_app (groupe_id, app_id),
        FOREIGN KEY (groupe_id) REFERENCES portal_groupes(id) ON DELETE CASCADE,
        FOREIGN KEY (app_id)    REFERENCES portal_apps(id)    ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS portal_user_groupes (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        user_id   CHAR(36) NOT NULL,
        groupe_id INT NOT NULL,
        UNIQUE KEY uniq_user_groupe (user_id, groupe_id),
        FOREIGN KEY (user_id)   REFERENCES users(id)          ON DELETE CASCADE,
        FOREIGN KEY (groupe_id) REFERENCES portal_groupes(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS portal_user_apps (
        id      INT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(36)    NOT NULL,
        app_id  INT         NOT NULL,
        droits  VARCHAR(20) DEFAULT 'lecture',
        UNIQUE KEY uniq_user_app (user_id, app_id),
        FOREIGN KEY (user_id) REFERENCES users(id)       ON DELETE CASCADE,
        FOREIGN KEY (app_id)  REFERENCES portal_apps(id) ON DELETE CASCADE
    )`,
];

// Sous-applications du monorepo (apps/*), insérées au premier démarrage.
// `projets` est une application Angular autonome (port 4203) : URL absolue.
// `appli-agenda` et `appli-recettes` sont montées dans le portail lui-même
// (routes chargées à la demande, voir apps/portail/src/app/base-routes.ts) :
// route interne, donc pas de port ni de transfert de session à prévoir.
const SEED_APPS = [
    { code: 'projets',        nom: 'Projets',  description: 'Éditeur de projets et de documentation',  url_path: 'http://localhost:4203', icone: 'folder_open',     ordre: 1 },
    { code: 'appli-agenda',   nom: 'Agenda',   description: 'Planification des projets et des tâches', url_path: '/agenda',              icone: 'calendar_month',  ordre: 2 },
    { code: 'appli-recettes', nom: 'Recettes', description: 'Cahiers de recette et campagnes de test', url_path: '/recettes',            icone: 'restaurant_menu', ordre: 3 },
];

// Corrections d'URL rejouées à chaque démarrage : les bases amorcées avant
// l'intégration de l'agenda et des recettes pointaient sur des ports dédiés
// (4204/4205) qui n'ont jamais existé — ces deux applications vivent désormais
// dans le portail. Ciblé sur l'ancienne valeur exacte : une URL modifiée à la
// main dans Admin › Applications n'est jamais écrasée.
const URL_MIGRATIONS = [
    { code: 'appli-agenda',   from: 'http://localhost:4204', to: '/agenda' },
    { code: 'appli-recettes', from: 'http://localhost:4205', to: '/recettes' },
];

/**
 * Crée les tables du portail si besoin, ajoute users.metier_id et amorce les
 * sous-applications au tout premier démarrage. Idempotent.
 */
async function ensureSchema(pool) {
    try {
        for (const stmt of SCHEMA) await pool.query(stmt);

        try {
            await pool.query('ALTER TABLE users ADD COLUMN metier_id INT NULL');
        } catch (e) {
            if (e.errno !== 1060) throw e; // 1060 = colonne déjà présente
        }

        // Amorçage uniquement si la table est vide (ne réécrit jamais l'existant)
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM portal_apps');
        if (total === 0) {
            const [g] = await pool.query(
                'INSERT INTO portal_groupes (nom, description, ordre) VALUES (?,?,?)',
                ['Applications', 'Les sous-applications du portail', 1]
            );
            for (const a of SEED_APPS) {
                const [r] = await pool.query(
                    `INSERT INTO portal_apps (code, nom, description, url_path, icone, ordre)
                     VALUES (?,?,?,?,?,?)`,
                    [a.code, a.nom, a.description, a.url_path, a.icone, a.ordre]
                );
                await pool.query(
                    'INSERT IGNORE INTO portal_groupe_apps (groupe_id, app_id) VALUES (?,?)',
                    [g.insertId, r.insertId]
                );
            }
            console.log(`[Portal] Amorçage : ${SEED_APPS.length} sous-applications créées`);
        }

        for (const m of URL_MIGRATIONS) {
            const [r] = await pool.query(
                'UPDATE portal_apps SET url_path = ? WHERE code = ? AND url_path = ?',
                [m.to, m.code, m.from]
            );
            if (r.affectedRows) console.log(`[Portal] URL de ${m.code} corrigée : ${m.from} → ${m.to}`);
        }
    } catch (e) {
        console.error('[Portal] Erreur init schéma:', e.message);
    }
}

function register(app, { pool, getSessionUser }) {

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Exige une session valide. Renvoie l'utilisateur ou null (réponse 401 déjà envoyée). */
    function requireUser(req, res) {
        const user = getSessionUser(req);
        if (!user) { res.status(401).json({ error: 'Non authentifié' }); return null; }
        return user;
    }

    /** Exige une session admin. Renvoie l'utilisateur ou null (réponse déjà envoyée). */
    function requireAdmin(req, res) {
        const user = requireUser(req, res);
        if (!user) return null;
        if (user.role !== 'admin') { res.status(403).json({ error: 'Accès refusé' }); return null; }
        return user;
    }

    function fail(res, context, e) {
        console.error(`[Portal] ${context}:`, e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }

    const toBool = v => v === 1 || v === '1' || v === true;

    const mapApp = r => ({
        id: r.id, code: r.code, nom: r.nom, description: r.description || '',
        urlPath: r.url_path || '', icone: r.icone || 'apps',
        ordre: r.ordre || 0, isActive: toBool(r.is_active)
    });

    const mapGroupe = r => ({
        id: r.id, nom: r.nom, description: r.description || '',
        ordre: r.ordre || 0, isActive: toBool(r.is_active)
    });

    const mapMetier = r => ({
        id: r.id, nom: r.nom, color: r.color || 'blue', isActive: toBool(r.is_active)
    });

    // ── Applications ─────────────────────────────────────────────────────────

    app.get('/api/portal/apps', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM portal_apps ORDER BY ordre, nom');
            res.json(rows.map(mapApp));
        } catch (e) { fail(res, 'get apps', e); }
    });

    app.post('/api/portal/apps', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { code, nom, description, urlPath, icone, ordre, isActive } = req.body;
        if (!code || !nom) return res.status(400).json({ error: 'code et nom sont requis' });
        try {
            const [r] = await pool.query(
                `INSERT INTO portal_apps (code, nom, description, url_path, icone, ordre, is_active)
                 VALUES (?,?,?,?,?,?,?)`,
                [code.trim(), nom.trim(), description || '', urlPath || '', icone || 'apps',
                 ordre || 0, isActive === false ? 0 : 1]
            );
            const [[row]] = await pool.query('SELECT * FROM portal_apps WHERE id = ?', [r.insertId]);
            res.json(mapApp(row));
        } catch (e) {
            if (e.errno === 1062) return res.status(409).json({ error: 'Ce code d\'application existe déjà' });
            fail(res, 'create app', e);
        }
    });

    app.put('/api/portal/apps/:id', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { code, nom, description, urlPath, icone, ordre, isActive } = req.body;
        try {
            const [[current]] = await pool.query('SELECT * FROM portal_apps WHERE id = ?', [req.params.id]);
            if (!current) return res.status(404).json({ error: 'Application introuvable' });
            await pool.query(
                `UPDATE portal_apps SET code=?, nom=?, description=?, url_path=?, icone=?, ordre=?, is_active=?
                 WHERE id=?`,
                [code ?? current.code, nom ?? current.nom, description ?? current.description,
                 urlPath ?? current.url_path, icone ?? current.icone, ordre ?? current.ordre,
                 isActive === undefined ? current.is_active : (isActive ? 1 : 0), req.params.id]
            );
            const [[row]] = await pool.query('SELECT * FROM portal_apps WHERE id = ?', [req.params.id]);
            res.json(mapApp(row));
        } catch (e) {
            if (e.errno === 1062) return res.status(409).json({ error: 'Ce code d\'application existe déjà' });
            fail(res, 'update app', e);
        }
    });

    app.delete('/api/portal/apps/:id', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            const [r] = await pool.query('DELETE FROM portal_apps WHERE id = ?', [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Application introuvable' });
            res.json({ success: true });
        } catch (e) { fail(res, 'delete app', e); }
    });

    // ── Groupes ──────────────────────────────────────────────────────────────

    app.get('/api/portal/groupes', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM portal_groupes ORDER BY ordre, nom');
            res.json(rows.map(mapGroupe));
        } catch (e) { fail(res, 'get groupes', e); }
    });

    app.post('/api/portal/groupes', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, description, ordre, isActive } = req.body;
        if (!nom) return res.status(400).json({ error: 'nom est requis' });
        try {
            const [r] = await pool.query(
                'INSERT INTO portal_groupes (nom, description, ordre, is_active) VALUES (?,?,?,?)',
                [nom.trim(), description || '', ordre || 0, isActive === false ? 0 : 1]
            );
            const [[row]] = await pool.query('SELECT * FROM portal_groupes WHERE id = ?', [r.insertId]);
            res.json(mapGroupe(row));
        } catch (e) { fail(res, 'create groupe', e); }
    });

    app.put('/api/portal/groupes/:id', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, description, ordre, isActive } = req.body;
        try {
            const [[current]] = await pool.query('SELECT * FROM portal_groupes WHERE id = ?', [req.params.id]);
            if (!current) return res.status(404).json({ error: 'Groupe introuvable' });
            await pool.query(
                'UPDATE portal_groupes SET nom=?, description=?, ordre=?, is_active=? WHERE id=?',
                [nom ?? current.nom, description ?? current.description, ordre ?? current.ordre,
                 isActive === undefined ? current.is_active : (isActive ? 1 : 0), req.params.id]
            );
            const [[row]] = await pool.query('SELECT * FROM portal_groupes WHERE id = ?', [req.params.id]);
            res.json(mapGroupe(row));
        } catch (e) { fail(res, 'update groupe', e); }
    });

    app.delete('/api/portal/groupes/:id', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            const [r] = await pool.query('DELETE FROM portal_groupes WHERE id = ?', [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Groupe introuvable' });
            res.json({ success: true });
        } catch (e) { fail(res, 'delete groupe', e); }
    });

    // ── Métiers ──────────────────────────────────────────────────────────────

    app.get('/api/portal/metiers', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM portal_metiers ORDER BY nom');
            res.json(rows.map(mapMetier));
        } catch (e) { fail(res, 'get metiers', e); }
    });

    app.post('/api/portal/metiers', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, color, isActive } = req.body;
        if (!nom) return res.status(400).json({ error: 'nom est requis' });
        try {
            const [r] = await pool.query(
                'INSERT INTO portal_metiers (nom, color, is_active) VALUES (?,?,?)',
                [nom.trim(), color || 'blue', isActive === false ? 0 : 1]
            );
            const [[row]] = await pool.query('SELECT * FROM portal_metiers WHERE id = ?', [r.insertId]);
            res.json(mapMetier(row));
        } catch (e) { fail(res, 'create metier', e); }
    });

    app.put('/api/portal/metiers/:id', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, color, isActive } = req.body;
        try {
            const [[current]] = await pool.query('SELECT * FROM portal_metiers WHERE id = ?', [req.params.id]);
            if (!current) return res.status(404).json({ error: 'Métier introuvable' });
            await pool.query(
                'UPDATE portal_metiers SET nom=?, color=?, is_active=? WHERE id=?',
                [nom ?? current.nom, color ?? current.color,
                 isActive === undefined ? current.is_active : (isActive ? 1 : 0), req.params.id]
            );
            const [[row]] = await pool.query('SELECT * FROM portal_metiers WHERE id = ?', [req.params.id]);
            res.json(mapMetier(row));
        } catch (e) { fail(res, 'update metier', e); }
    });

    app.delete('/api/portal/metiers/:id', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            // Détache le métier des utilisateurs avant suppression (pas de FK sur users.metier_id)
            await pool.query('UPDATE users SET metier_id = NULL WHERE metier_id = ?', [req.params.id]);
            const [r] = await pool.query('DELETE FROM portal_metiers WHERE id = ?', [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Métier introuvable' });
            res.json({ success: true });
        } catch (e) { fail(res, 'delete metier', e); }
    });

    // ── Utilisateurs (vue portail : rôle + métier) ────────────────────────────

    app.get('/api/portal/users', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query(
                `SELECT u.id, u.username, u.email, u.role, u.metier_id, m.nom AS metier_nom, m.color AS metier_color,
                        u.created_at, u.last_login
                 FROM users u
                 LEFT JOIN portal_metiers m ON m.id = u.metier_id
                 ORDER BY u.username`
            );
            res.json(rows.map(r => ({
                id: r.id, username: r.username, email: r.email, role: r.role,
                metierId: r.metier_id ?? null,
                metierNom: r.metier_nom ?? null,
                metierColor: r.metier_color ?? null,
                createdAt: r.created_at ? r.created_at.toISOString() : null,
                lastLogin: r.last_login ? r.last_login.toISOString() : null
            })));
        } catch (e) { fail(res, 'get users', e); }
    });

    app.put('/api/portal/users/:id/metier', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { metierId } = req.body;
        try {
            const [r] = await pool.query('UPDATE users SET metier_id = ? WHERE id = ?',
                [metierId == null ? null : Number(metierId), req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Utilisateur introuvable' });
            res.json({ success: true, metierId: metierId == null ? null : Number(metierId) });
        } catch (e) { fail(res, 'update user metier', e); }
    });

    // ── Matrice groupes × applications ───────────────────────────────────────

    app.get('/api/portal/groupe-apps', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, groupe_id, app_id FROM portal_groupe_apps');
            res.json(rows.map(r => ({ id: r.id, groupeId: r.groupe_id, appId: r.app_id })));
        } catch (e) { fail(res, 'get groupe-apps', e); }
    });

    app.post('/api/portal/groupe-apps', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { groupeId, appId, linked } = req.body;
        if (!groupeId || !appId) return res.status(400).json({ error: 'groupeId et appId sont requis' });
        try {
            if (linked === false) {
                await pool.query('DELETE FROM portal_groupe_apps WHERE groupe_id = ? AND app_id = ?', [groupeId, appId]);
            } else {
                await pool.query('INSERT IGNORE INTO portal_groupe_apps (groupe_id, app_id) VALUES (?,?)', [groupeId, appId]);
            }
            res.json({ success: true });
        } catch (e) { fail(res, 'toggle groupe-app', e); }
    });

    // ── Matrice utilisateurs × groupes ───────────────────────────────────────

    app.get('/api/portal/user-groupes', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, user_id, groupe_id FROM portal_user_groupes');
            res.json(rows.map(r => ({ id: r.id, userId: r.user_id, groupeId: r.groupe_id })));
        } catch (e) { fail(res, 'get user-groupes', e); }
    });

    app.post('/api/portal/user-groupes', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { userId, groupeId, linked } = req.body;
        if (!userId || !groupeId) return res.status(400).json({ error: 'userId et groupeId sont requis' });
        try {
            if (linked === false) {
                await pool.query('DELETE FROM portal_user_groupes WHERE user_id = ? AND groupe_id = ?', [userId, groupeId]);
            } else {
                await pool.query('INSERT IGNORE INTO portal_user_groupes (user_id, groupe_id) VALUES (?,?)', [userId, groupeId]);
            }
            res.json({ success: true });
        } catch (e) { fail(res, 'toggle user-groupe', e); }
    });

    // ── Droits directs utilisateur × application ─────────────────────────────

    app.get('/api/portal/user-apps', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, user_id, app_id, droits FROM portal_user_apps');
            res.json(rows.map(r => ({ id: r.id, userId: r.user_id, appId: r.app_id, droits: r.droits })));
        } catch (e) { fail(res, 'get user-apps', e); }
    });

    app.post('/api/portal/user-apps', async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { userId, appId, droits, linked } = req.body;
        if (!userId || !appId) return res.status(400).json({ error: 'userId et appId sont requis' });
        if (droits && !DROITS_VALIDES.includes(droits)) {
            return res.status(400).json({ error: `droits doit être parmi : ${DROITS_VALIDES.join(', ')}` });
        }
        try {
            if (linked === false) {
                await pool.query('DELETE FROM portal_user_apps WHERE user_id = ? AND app_id = ?', [userId, appId]);
            } else {
                await pool.query(
                    `INSERT INTO portal_user_apps (user_id, app_id, droits) VALUES (?,?,?)
                     ON DUPLICATE KEY UPDATE droits = VALUES(droits)`,
                    [userId, appId, droits || 'lecture']
                );
            }
            res.json({ success: true });
        } catch (e) { fail(res, 'toggle user-app', e); }
    });

    // ── Dashboard de la page d'accueil ───────────────────────────────────────
    //
    // Renvoie les groupes visibles par l'utilisateur courant, chacun avec ses
    // applications actives. Un admin voit tous les groupes actifs ; un
    // utilisateur standard ne voit que les groupes auxquels il est rattaché.
    // Les droits directs (portal_user_apps) ajoutent des applications
    // supplémentaires, regroupées dans une entrée « Accès directs ».

    app.get('/api/portal/home', async (req, res) => {
        const user = requireUser(req, res);
        if (!user) return;
        try {
            const [apps]      = await pool.query('SELECT * FROM portal_apps WHERE is_active = 1 ORDER BY ordre, nom');
            const [groupes]   = await pool.query('SELECT * FROM portal_groupes WHERE is_active = 1 ORDER BY ordre, nom');
            const [grpApps]   = await pool.query('SELECT groupe_id, app_id FROM portal_groupe_apps');
            const [userGrps]  = await pool.query('SELECT groupe_id FROM portal_user_groupes WHERE user_id = ?', [user.id]);
            const [userApps]  = await pool.query('SELECT app_id, droits FROM portal_user_apps WHERE user_id = ?', [user.id]);

            const isAdmin      = user.role === 'admin';
            const allowedGrps  = new Set(userGrps.map(g => g.groupe_id));
            const appsById     = new Map(apps.map(a => [a.id, mapApp(a)]));
            const droitsByApp  = new Map(userApps.map(ua => [ua.app_id, ua.droits]));

            const visibles = groupes.filter(g => isAdmin || allowedGrps.has(g.id));

            const result = visibles
                .map(g => ({
                    ...mapGroupe(g),
                    apps: grpApps
                        .filter(ga => ga.groupe_id === g.id)
                        .map(ga => appsById.get(ga.app_id))
                        .filter(Boolean)
                        .map(a => ({ ...a, droits: isAdmin ? 'admin' : (droitsByApp.get(a.id) || 'lecture') }))
                }))
                .filter(g => g.apps.length > 0);

            // Applications accordées directement mais absentes des groupes visibles
            const dejaVues = new Set(result.flatMap(g => g.apps.map(a => a.id)));
            const directes = userApps
                .filter(ua => !dejaVues.has(ua.app_id) && appsById.has(ua.app_id))
                .map(ua => ({ ...appsById.get(ua.app_id), droits: ua.droits }));

            if (directes.length) {
                result.push({
                    id: 0, nom: 'Accès directs', description: 'Applications qui vous sont attribuées individuellement',
                    ordre: 999, isActive: true, apps: directes
                });
            }

            res.json({ groupes: result, isAdmin });
        } catch (e) { fail(res, 'home dashboard', e); }
    });

    console.log('[Portal] Routes /api/portal/* montées');
}

module.exports = { register, ensureSchema };
