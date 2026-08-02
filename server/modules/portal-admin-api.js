/**
 * Worganic — API d'administration du portail, au format attendu par le shell commun.
 *
 * Le shell du portail (`apps/portail/src/app/admin/**` et
 * `apps/portail/src/services/admin.service.ts`) est identique bit-à-bit dans les
 * deux monorepos : il ne connaît aucun chemin en dur et lit tout depuis
 * `environmentGlobal.ts`. Ce module expose, sur les tables `portal_*` et `users`
 * de cette plateforme, exactement les ressources que ce service consomme —
 * en snake_case, comme l'API d'entreprise servie par l'autre portail.
 *
 * Préfixe distinct de `/api/portal/*` volontairement : les routes historiques
 * (camelCase) restent servies par `portal-apps.js` pour l'administration maison
 * accessible sur /admin-outils. Les deux surfaces coexistent sur les mêmes tables.
 *
 * Correspondances de colonnes à retenir :
 *   - `portal_groupe_apps.app_id` et `portal_user_apps.app_id` sont exposés
 *     sous le nom `application_id` attendu par le service commun ;
 *   - `users.id` est un UUID (CHAR(36)) ici et un entier là-bas : le service
 *     commun traite cet identifiant comme une chaîne opaque, jamais comme un
 *     nombre — voir `AppUser.id` dans models/admin.models.ts.
 *
 * Montage : require('./modules/portal-admin-api').register(app, { pool, getSessionUser })
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PREFIXE = '/api/portal-admin';
const DROITS_VALIDES = ['lecture', 'ecriture', 'admin'];

function register(app, { pool, getSessionUser }) {

    // ── Helpers ──────────────────────────────────────────────────────────────

    function requireUser(req, res) {
        const user = getSessionUser(req);
        if (!user) { res.status(401).json({ error: 'Non authentifié' }); return null; }
        return user;
    }

    function requireAdmin(req, res) {
        const user = requireUser(req, res);
        if (!user) return null;
        if (user.role !== 'admin') { res.status(403).json({ error: 'Accès refusé' }); return null; }
        return user;
    }

    function fail(res, context, e) {
        console.error(`[PortalAdminApi] ${context}:`, e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }

    /** Le service commun accepte 1/0, true/false et "1"/"0" — on renvoie 1/0 comme l'API d'entreprise. */
    const toInt = v => (v === 1 || v === '1' || v === true || v === 'true') ? 1 : 0;

    const mapUser = r => ({
        id: r.id,
        matricule: r.matricule ?? '',
        nom: r.nom ?? '',
        prenom: r.prenom ?? '',
        email: r.email ?? '',
        role: r.role ?? 'USER',
        is_active: toInt(r.is_active),
        metier_id: r.metier_id ?? null,
    });

    const mapApplication = r => ({
        id: r.id,
        nom: r.nom ?? '',
        description: r.description ?? '',
        url_path: r.url_path ?? '',
        icone: r.icone ?? 'apps',
        is_active: toInt(r.is_active),
    });

    const mapGroupe = r => ({
        id: r.id,
        nom: r.nom ?? '',
        description: r.description ?? '',
        ordre: r.ordre ?? 0,
        is_active: toInt(r.is_active),
    });

    const mapMetier = r => ({
        id: r.id,
        nom: r.nom ?? '',
        is_active: toInt(r.is_active),
        color: r.color ?? 'slate',
    });

    // ── Utilisateurs ─────────────────────────────────────────────────────────

    app.get(`${PREFIXE}/users/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query(
                `SELECT id, matricule, nom, prenom, email, role, is_active, metier_id
                   FROM users
                  ORDER BY nom, prenom, username`
            );
            res.json(rows.map(mapUser));
        } catch (e) { fail(res, 'get users', e); }
    });

    app.get(`${PREFIXE}/users/matricule/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        const matricule = String(req.query.matricule || '').trim();
        if (!matricule) return res.json([]);
        try {
            // Cette route résout `PortalSessionUser.id` (le shell commun l'appelle
            // avec cette valeur, jamais avec un matricule saisi) — voir
            // libs/core/auth/src/lib/portal-session.ts : « identifiant stable dans
            // le portail hôte ». Ici, cet identifiant EST l'id de compte (UUID),
            // pas le matricule (facultatif) ni l'email — d'où le premier terme.
            const [rows] = await pool.query(
                `SELECT id, matricule, nom, prenom, email, role, is_active, metier_id
                   FROM users
                  WHERE id = ? OR matricule = ? OR email = ? OR username = ?
                  LIMIT 1`,
                [matricule, matricule, matricule, matricule]
            );
            res.json(rows.map(mapUser));
        } catch (e) { fail(res, 'get user by matricule', e); }
    });

    app.post(`${PREFIXE}/users/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { matricule, nom, prenom, email, role, is_active, metier_id } = req.body || {};
        if (!nom || !prenom) return res.status(400).json({ error: 'nom et prenom sont requis' });
        const adresse = (email || '').trim() || `${String(matricule || '').trim().toLowerCase()}@local`;
        try {
            const id = crypto.randomUUID();
            // Compte créé sans mot de passe utilisable : `password_hash` reçoit une
            // valeur qu'aucun hachage bcrypt ne peut produire, donc aucune saisie
            // ne peut correspondre. Le compte existe et peut être rattaché à des
            // groupes, mais reste inutilisable tant qu'un mot de passe n'a pas été
            // défini — c'est le comportement voulu pour une création côté admin.
            await pool.query(
                `INSERT INTO users (id, matricule, nom, prenom, username, email, password_hash, role, is_active, metier_id)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [id, matricule || '', nom, prenom, adresse, adresse, '!', role || 'USER',
                 toInt(is_active), metier_id ?? null]
            );
            const [rows] = await pool.query(
                `SELECT id, matricule, nom, prenom, email, role, is_active, metier_id FROM users WHERE id = ?`, [id]
            );
            res.json(rows.length ? mapUser(rows[0]) : null);
        } catch (e) { fail(res, 'insert user', e); }
    });

    app.post(`${PREFIXE}/users/update/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { id, matricule, nom, prenom, email, role, is_active, metier_id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id requis' });
        try {
            await pool.query(
                `UPDATE users
                    SET matricule = ?, nom = ?, prenom = ?, email = ?, role = ?, is_active = ?, metier_id = ?
                  WHERE id = ?`,
                [matricule || '', nom || '', prenom || '', email || '', role || 'USER',
                 toInt(is_active), metier_id ?? null, id]
            );
            const [rows] = await pool.query(
                `SELECT id, matricule, nom, prenom, email, role, is_active, metier_id FROM users WHERE id = ?`, [id]
            );
            res.json(rows.length ? mapUser(rows[0]) : null);
        } catch (e) { fail(res, 'update user', e); }
    });

    app.delete(`${PREFIXE}/users/delete/:id`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete user', e); }
    });

    // ── Applications ─────────────────────────────────────────────────────────

    /**
     * Dossiers `apps/appli-*` qui ne contribuent qu'un onglet admin (pas de route
     * utilisateur montée), déduits par lecture de `provide-*-admin-tab.ts` — voir
     * docs/architecture-sous-applications.md. Best-effort : un dossier sans ce
     * fichier ou au format inattendu retombe sur un nom/icône par défaut plutôt que
     * d'être ignoré.
     */
    function scanAvailableApps() {
        const appsDir = path.join(__dirname, '..', '..', 'apps');
        let entries;
        try {
            entries = fs.readdirSync(appsDir, { withFileTypes: true });
        } catch {
            return [];
        }
        return entries
            .filter(e => e.isDirectory() && /^appli-.+/.test(e.name) && !e.name.endsWith('-e2e'))
            .map(e => {
                const adminDir = path.join(appsDir, e.name, 'src/app/admin');
                let nom = e.name.replace(/^appli-/, '').replace(/-/g, ' ');
                nom = nom.charAt(0).toUpperCase() + nom.slice(1);
                let icone = 'apps';
                try {
                    const fichierTab = fs.readdirSync(adminDir).find(f => /^provide-.*-admin-tab\.ts$/.test(f));
                    if (fichierTab) {
                        const source = fs.readFileSync(path.join(adminDir, fichierTab), 'utf8');
                        const labelMatch = source.match(/label:\s*'([^']+)'/);
                        const iconMatch = source.match(/icon:\s*'([^']+)'/);
                        if (labelMatch) nom = labelMatch[1];
                        if (iconMatch) icone = iconMatch[1];
                    }
                } catch { /* pas de dossier admin/ : garde les défauts */ }
                return { nom, description: '', url_path: '', icone, dossier: e.name };
            });
    }

    app.get(`${PREFIXE}/applications/available`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT nom FROM portal_apps');
            const nomsExistants = new Set(rows.map(r => String(r.nom || '').trim().toLowerCase()));
            const disponibles = scanAvailableApps().filter(a => !nomsExistants.has(a.nom.trim().toLowerCase()));
            res.json(disponibles);
        } catch (e) { fail(res, 'get available applications', e); }
    });

    app.get(`${PREFIXE}/applications/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM portal_apps ORDER BY ordre, nom');
            res.json(rows.map(mapApplication));
        } catch (e) { fail(res, 'get applications', e); }
    });

    app.post(`${PREFIXE}/applications/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, description, url_path, icone, is_active } = req.body || {};
        if (!nom) return res.status(400).json({ error: 'nom requis' });
        try {
            // `code` est NOT NULL UNIQUE dans cette base et n'existe pas dans le
            // modèle commun : dérivé du nom, suffixé si déjà pris.
            const base = String(nom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
            let code = base;
            let libre = false;
            // Bornée : au-delà, on suffixe par un aléa plutôt que de boucler
            // indéfiniment sur une saisie qui collisionnerait toujours.
            for (let i = 2; i < 50; i++) {
                const [dup] = await pool.query('SELECT 1 FROM portal_apps WHERE code = ? LIMIT 1', [code]);
                if (!dup.length) { libre = true; break; }
                code = `${base}-${i}`;
            }
            if (!libre) code = `${base}-${crypto.randomUUID().slice(0, 8)}`;
            const [r] = await pool.query(
                `INSERT INTO portal_apps (code, nom, description, url_path, icone, is_active)
                 VALUES (?,?,?,?,?,?)`,
                [code, nom, description || '', url_path || '', icone || 'apps', toInt(is_active)]
            );
            const [rows] = await pool.query('SELECT * FROM portal_apps WHERE id = ?', [r.insertId]);
            res.json(rows.length ? mapApplication(rows[0]) : null);
        } catch (e) { fail(res, 'insert application', e); }
    });

    app.post(`${PREFIXE}/applications/update/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { id, nom, description, url_path, icone, is_active } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id requis' });
        try {
            await pool.query(
                `UPDATE portal_apps SET nom = ?, description = ?, url_path = ?, icone = ?, is_active = ? WHERE id = ?`,
                [nom || '', description || '', url_path || '', icone || 'apps', toInt(is_active), id]
            );
            const [rows] = await pool.query('SELECT * FROM portal_apps WHERE id = ?', [id]);
            res.json(rows.length ? mapApplication(rows[0]) : null);
        } catch (e) { fail(res, 'update application', e); }
    });

    app.delete(`${PREFIXE}/applications/delete/:id`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            await pool.query('DELETE FROM portal_apps WHERE id = ?', [req.params.id]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete application', e); }
    });

    // ── Groupes ──────────────────────────────────────────────────────────────

    app.get(`${PREFIXE}/groupes/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM portal_groupes ORDER BY ordre, nom');
            res.json(rows.map(mapGroupe));
        } catch (e) { fail(res, 'get groupes', e); }
    });

    app.post(`${PREFIXE}/groupes/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, description, ordre, is_active } = req.body || {};
        if (!nom) return res.status(400).json({ error: 'nom requis' });
        try {
            const [r] = await pool.query(
                `INSERT INTO portal_groupes (nom, description, ordre, is_active) VALUES (?,?,?,?)`,
                [nom, description || '', Number(ordre) || 0, toInt(is_active)]
            );
            const [rows] = await pool.query('SELECT * FROM portal_groupes WHERE id = ?', [r.insertId]);
            res.json(rows.length ? mapGroupe(rows[0]) : null);
        } catch (e) { fail(res, 'insert groupe', e); }
    });

    app.post(`${PREFIXE}/groupes/update/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { id, nom, description, ordre, is_active } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id requis' });
        try {
            await pool.query(
                `UPDATE portal_groupes SET nom = ?, description = ?, ordre = ?, is_active = ? WHERE id = ?`,
                [nom || '', description || '', Number(ordre) || 0, toInt(is_active), id]
            );
            const [rows] = await pool.query('SELECT * FROM portal_groupes WHERE id = ?', [id]);
            res.json(rows.length ? mapGroupe(rows[0]) : null);
        } catch (e) { fail(res, 'update groupe', e); }
    });

    app.delete(`${PREFIXE}/groupes/delete/:id`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            await pool.query('DELETE FROM portal_groupes WHERE id = ?', [req.params.id]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete groupe', e); }
    });

    // ── Métiers ──────────────────────────────────────────────────────────────

    app.get(`${PREFIXE}/metiers/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM portal_metiers ORDER BY nom');
            res.json(rows.map(mapMetier));
        } catch (e) { fail(res, 'get metiers', e); }
    });

    app.post(`${PREFIXE}/metiers/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { nom, color, is_active } = req.body || {};
        if (!nom) return res.status(400).json({ error: 'nom requis' });
        try {
            const [r] = await pool.query(
                'INSERT INTO portal_metiers (nom, color, is_active) VALUES (?,?,?)',
                [nom, color || 'slate', toInt(is_active)]
            );
            const [rows] = await pool.query('SELECT * FROM portal_metiers WHERE id = ?', [r.insertId]);
            res.json(rows.length ? mapMetier(rows[0]) : null);
        } catch (e) { fail(res, 'insert metier', e); }
    });

    app.post(`${PREFIXE}/metiers/update/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { id, nom, color, is_active } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id requis' });
        try {
            await pool.query(
                'UPDATE portal_metiers SET nom = ?, color = ?, is_active = ? WHERE id = ?',
                [nom || '', color || 'slate', toInt(is_active), id]
            );
            const [rows] = await pool.query('SELECT * FROM portal_metiers WHERE id = ?', [id]);
            res.json(rows.length ? mapMetier(rows[0]) : null);
        } catch (e) { fail(res, 'update metier', e); }
    });

    app.delete(`${PREFIXE}/metiers/delete/:id`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            await pool.query('DELETE FROM portal_metiers WHERE id = ?', [req.params.id]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete metier', e); }
    });

    // ── Affectations utilisateur ↔ application ───────────────────────────────
    // Table portal_user_apps : colonne `app_id`, exposée en `application_id`.

    app.get(`${PREFIXE}/user_applications/selectAll/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        const userId = req.query.user_id ? String(req.query.user_id) : null;
        try {
            const [rows] = userId
                ? await pool.query('SELECT id, user_id, app_id, droits FROM portal_user_apps WHERE user_id = ?', [userId])
                : await pool.query('SELECT id, user_id, app_id, droits FROM portal_user_apps');
            res.json(rows.map(r => ({
                id: r.id, user_id: r.user_id, application_id: r.app_id, droits: r.droits || 'lecture'
            })));
        } catch (e) { fail(res, 'get user_applications', e); }
    });

    app.post(`${PREFIXE}/user_applications/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { user_id, application_id, droits } = req.body || {};
        if (!user_id || !application_id) return res.status(400).json({ error: 'user_id et application_id requis' });
        const droit = DROITS_VALIDES.includes(droits) ? droits : 'lecture';
        try {
            await pool.query(
                `INSERT INTO portal_user_apps (user_id, app_id, droits) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE droits = VALUES(droits)`,
                [String(user_id), Number(application_id), droit]
            );
            // Le service commun lit cette réponse en texte brut (responseType: 'text').
            res.type('text/plain').send('ok');
        } catch (e) { fail(res, 'insert user_application', e); }
    });

    app.post(`${PREFIXE}/user_applications/update/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { user_id, application_id, droits } = req.body || {};
        if (!user_id || !application_id) return res.status(400).json({ error: 'user_id et application_id requis' });
        const droit = DROITS_VALIDES.includes(droits) ? droits : 'lecture';
        try {
            await pool.query(
                `INSERT INTO portal_user_apps (user_id, app_id, droits) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE droits = VALUES(droits)`,
                [String(user_id), Number(application_id), droit]
            );
            res.type('text/plain').send('ok');
        } catch (e) { fail(res, 'update user_application', e); }
    });

    app.delete(`${PREFIXE}/user_applications/delete/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { user_id, appId } = req.query;
        if (!user_id || !appId) return res.status(400).json({ error: 'user_id et appId requis' });
        try {
            await pool.query('DELETE FROM portal_user_apps WHERE user_id = ? AND app_id = ?',
                [String(user_id), Number(appId)]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete user_application', e); }
    });

    // ── Affectations groupe ↔ application ────────────────────────────────────
    // Table portal_groupe_apps : colonne `app_id`, exposée en `application_id`.

    app.get(`${PREFIXE}/groupe_applications/get/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, groupe_id, app_id FROM portal_groupe_apps');
            res.json(rows.map(r => ({ id: r.id, groupe_id: r.groupe_id, application_id: r.app_id })));
        } catch (e) { fail(res, 'get groupe_applications', e); }
    });

    app.post(`${PREFIXE}/groupe_applications/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { groupe_id, application_id } = req.body || {};
        if (!groupe_id || !application_id) return res.status(400).json({ error: 'groupe_id et application_id requis' });
        try {
            await pool.query(
                'INSERT IGNORE INTO portal_groupe_apps (groupe_id, app_id) VALUES (?,?)',
                [Number(groupe_id), Number(application_id)]
            );
            res.json({ ok: true });
        } catch (e) { fail(res, 'insert groupe_application', e); }
    });

    app.delete(`${PREFIXE}/groupe_applications/del/:groupe_id/:application_id`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            await pool.query('DELETE FROM portal_groupe_apps WHERE groupe_id = ? AND app_id = ?',
                [Number(req.params.groupe_id), Number(req.params.application_id)]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete groupe_application', e); }
    });

    // ── Affectations utilisateur ↔ groupe ────────────────────────────────────

    app.get(`${PREFIXE}/user_groupes/`, async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, user_id, groupe_id FROM portal_user_groupes');
            res.json(rows.map(r => ({ id: r.id, user_id: r.user_id, groupe_id: r.groupe_id })));
        } catch (e) { fail(res, 'get user_groupes', e); }
    });

    app.post(`${PREFIXE}/user_groupes/`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        const { user_id, groupe_id } = req.body || {};
        if (!user_id || !groupe_id) return res.status(400).json({ error: 'user_id et groupe_id requis' });
        try {
            await pool.query(
                'INSERT IGNORE INTO portal_user_groupes (user_id, groupe_id) VALUES (?,?)',
                [String(user_id), Number(groupe_id)]
            );
            res.json({ ok: true });
        } catch (e) { fail(res, 'insert user_groupe', e); }
    });

    app.delete(`${PREFIXE}/user_groupes/delete/:user_id/:groupe_id`, async (req, res) => {
        if (!requireAdmin(req, res)) return;
        try {
            await pool.query('DELETE FROM portal_user_groupes WHERE user_id = ? AND groupe_id = ?',
                [String(req.params.user_id), Number(req.params.groupe_id)]);
            res.json({ ok: true });
        } catch (e) { fail(res, 'delete user_groupe', e); }
    });

    console.log(`[PortalAdminApi] Routes ${PREFIXE}/* montées`);
}

module.exports = { register };
