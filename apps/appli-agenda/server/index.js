/**
 * Worganic — Backend de la sous-application `apps/appli-agenda` (montée dans
 * le portail sur /agenda) : projets, tâches et indisponibilités.
 *
 * Co-localisé avec le frontend (apps/appli-agenda/) plutôt que dans
 * server/modules/ : c'est le contrat "sous-application" (voir
 * docs/architecture-sous-applications.md) — tout ce qui compose l'agenda vit
 * dans ce seul dossier, portable tel quel vers un autre portail.
 *
 * Données en MySQL (tables agenda_*) : ce sont des données transverses,
 * partagées entre tous les utilisateurs du portail (voir CLAUDE.md).
 *
 * Les utilisateurs, groupes et métiers ne sont PAS dupliqués ici : ils sont
 * projetés depuis les tables du portail (`users`, `portal_groupes`,
 * `portal_user_groupes`, `portal_metiers`) au format attendu par les modèles
 * de l'agenda (voir apps/appli-agenda/src/app/core/models/project.model.ts),
 * qui identifient les développeurs par un entier — d'où la colonne technique
 * `users.num_id` (auto-incrément) ajoutée au démarrage.
 *
 * Montage : require('../apps/appli-agenda/server').register(app, { pool, getSessionUser })
 */

const { upsertCatalogEntry, markAppMounted } = require('../../../server/modules/portal-apps');

// Entrée de catalogue `portal_apps` propre à l'agenda (voir upsertCatalogEntry
// ci-dessous) : ce module n'a plus besoin d'être connu par son nom dans
// server/modules/portal-apps.js pour apparaître dans le menu des applications.
const CATALOG_ENTRY = {
    code: 'appli-agenda', nom: 'Agenda', description: 'Planification des projets et des tâches',
    url_path: '/agenda', icone: 'calendar_month', ordre: 2
};

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS agenda_projects (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        code                 VARCHAR(40)   NOT NULL,
        name                 VARCHAR(150)  NOT NULL,
        description          TEXT          DEFAULT NULL,
        status               VARCHAR(20)   DEFAULT 'A_FAIRE',
        risk_level           VARCHAR(20)   DEFAULT 'FAIBLE',
        date_start           DATE          NOT NULL,
        date_end_estimated   DATE          NOT NULL,
        estimated_time_days  DECIMAL(6,1)  NOT NULL DEFAULT 0,
        created_by           VARCHAR(120)  DEFAULT '',
        exclude_weekends     TINYINT(1)    DEFAULT 0,
        exclude_holidays     TINYINT(1)    DEFAULT 0,
        weekends_rule_from   DATE          DEFAULT NULL,
        holidays_rule_from   DATE          DEFAULT NULL,
        created_at           DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at           DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS agenda_project_developers (
        project_id INT NOT NULL,
        user_num_id INT NOT NULL,
        PRIMARY KEY (project_id, user_num_id),
        FOREIGN KEY (project_id) REFERENCES agenda_projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS agenda_project_metiers (
        project_id INT NOT NULL,
        metier_id  INT NOT NULL,
        PRIMARY KEY (project_id, metier_id),
        FOREIGN KEY (project_id) REFERENCES agenda_projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS agenda_tasks (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        project_id         INT           NOT NULL,
        parent_task_id     INT           DEFAULT NULL,
        name               VARCHAR(200)  NOT NULL,
        description        TEXT          DEFAULT NULL,
        status             VARCHAR(20)   DEFAULT 'NON_COMMENCE',
        assigned_user_id   INT           DEFAULT NULL,
        date_start         DATE          NOT NULL,
        date_end           DATE          NOT NULL,
        base_date_end      DATE          DEFAULT NULL,
        half_days_duration DECIMAL(5,1)  NOT NULL DEFAULT 1,
        comments           TEXT          DEFAULT NULL,
        is_risky           TINYINT(1)    DEFAULT 0,
        git_branch         VARCHAR(200)  DEFAULT NULL,
        worked_half_days   LONGTEXT      DEFAULT NULL,
        extensions         LONGTEXT      DEFAULT NULL,
        history            LONGTEXT      DEFAULT NULL,
        sub_tasks          LONGTEXT      DEFAULT NULL,
        created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES agenda_projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS agenda_unavailabilities (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          NOT NULL,
        date_start DATE         NOT NULL,
        date_end   DATE         NOT NULL,
        reason     VARCHAR(255) DEFAULT NULL,
        created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
    )`,
];

/**
 * Crée les tables de l'agenda et la colonne `users.num_id`. Idempotent.
 *
 * `num_id` est un entier auto-incrémenté (clé unique secondaire) : les modèles
 * de l'agenda typent les identifiants de développeur en `number` alors que
 * `users.id` du portail est un UUID. Plutôt que de réécrire une centaine
 * d'usages côté front, on expose cet identifiant numérique stable.
 */
async function ensureSchema(pool) {
    try {
        try {
            await pool.query('ALTER TABLE users ADD COLUMN num_id INT NOT NULL AUTO_INCREMENT UNIQUE');
        } catch (e) {
            if (e.errno !== 1060) throw e; // 1060 = colonne déjà présente
        }
        for (const stmt of SCHEMA) await pool.query(stmt);
        await upsertCatalogEntry(pool, CATALOG_ENTRY);
    } catch (e) {
        console.error('[Agenda] Erreur init schéma:', e.message);
    }
}

function register(app, { pool, getSessionUser }) {
    // Preuve que ce module (donc le dossier apps/appli-agenda/) est bien présent
    // dans cette installation — voir markAppMounted/isAppAvailable dans portal-apps.js.
    markAppMounted(CATALOG_ENTRY.code);

    // ── Helpers ──────────────────────────────────────────────────────────────

    function requireUser(req, res) {
        const user = getSessionUser(req);
        if (!user) { res.status(401).json({ error: 'Non authentifié' }); return null; }
        return user;
    }

    function fail(res, context, e) {
        console.error(`[Agenda] ${context}:`, e.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }

    /** Date SQL (YYYY-MM-DD) à partir d'une Date MySQL ou d'une chaîne ISO. */
    const toIsoDate = v => {
        if (!v) return null;
        if (v instanceof Date) {
            const p = n => String(n).padStart(2, '0');
            return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
        }
        return String(v).slice(0, 10);
    };

    const parseJson = (raw, fallback) => {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch { return fallback; }
    };

    const toBool = v => v === 1 || v === '1' || v === true;

    /**
     * Découpe le nom d'utilisateur du portail en prénom / nom : les écrans de
     * l'agenda affichent systématiquement « prénom NOM ». Un identifiant en un
     * seul mot (« admin ») devient donc simplement le prénom.
     */
    function splitUsername(username) {
        const parts = String(username || '').split(/[\s._-]+/).filter(Boolean);
        if (parts.length <= 1) return { firstname: parts[0] || '', lastname: '' };
        return { firstname: parts[0], lastname: parts.slice(1).join(' ').toUpperCase() };
    }

    function mapUser(r) {
        const { firstname, lastname } = splitUsername(r.username);
        return {
            id: r.num_id,
            matricule: r.username,
            firstname,
            lastname,
            email: r.email || '',
            role: r.role || 'user',
            is_active: true,
            metier_id: r.metier_id ?? null
        };
    }

    function mapTask(r, usersByNumId) {
        return {
            id: r.id,
            projectId: r.project_id,
            parentTaskId: r.parent_task_id ?? null,
            name: r.name,
            description: r.description || '',
            status: r.status,
            assignedUserId: r.assigned_user_id ?? null,
            assignedUser: usersByNumId ? usersByNumId.get(r.assigned_user_id) : undefined,
            dateStart: toIsoDate(r.date_start),
            dateEnd: toIsoDate(r.date_end),
            baseDateEnd: toIsoDate(r.base_date_end) || undefined,
            halfDaysDuration: Number(r.half_days_duration),
            comments: r.comments || '',
            isRisky: toBool(r.is_risky),
            gitBranch: r.git_branch || undefined,
            workedHalfDays: parseJson(r.worked_half_days, []),
            extensions: parseJson(r.extensions, []),
            history: parseJson(r.history, []),
            subTasks: parseJson(r.sub_tasks, [])
        };
    }

    /** Charge tous les utilisateurs du portail indexés par leur identifiant numérique. */
    async function loadUsersByNumId() {
        const [rows] = await pool.query(
            'SELECT num_id, username, email, role, metier_id FROM users WHERE num_id IS NOT NULL'
        );
        return new Map(rows.map(r => [r.num_id, mapUser(r)]));
    }

    /** Reconstruit un projet complet (développeurs, métiers, tâches) pour le front. */
    async function loadProjects(ids = null) {
        const where = ids ? ` WHERE p.id IN (${ids.map(() => '?').join(',')})` : '';
        const params = ids || [];
        const [projects] = await pool.query(`SELECT p.* FROM agenda_projects p${where} ORDER BY p.date_start DESC, p.id DESC`, params);
        if (!projects.length) return [];

        const projectIds = projects.map(p => p.id);
        const ph = projectIds.map(() => '?').join(',');
        const [devs]    = await pool.query(`SELECT * FROM agenda_project_developers WHERE project_id IN (${ph})`, projectIds);
        const [metiers] = await pool.query(`SELECT * FROM agenda_project_metiers WHERE project_id IN (${ph})`, projectIds);
        const [tasks]   = await pool.query(`SELECT * FROM agenda_tasks WHERE project_id IN (${ph}) ORDER BY date_start, id`, projectIds);
        const [metierRows] = await pool.query('SELECT id, nom, color FROM portal_metiers');

        const usersByNumId = await loadUsersByNumId();
        const metiersById = new Map(metierRows.map(m => [m.id, { id: m.id, nom: m.nom, color: m.color || 'blue' }]));

        return projects.map(p => {
            const metierIds = metiers.filter(m => m.project_id === p.id).map(m => m.metier_id);
            return {
                id: p.id,
                code: p.code,
                name: p.name,
                description: p.description || '',
                status: p.status,
                riskLevel: p.risk_level,
                dateStart: toIsoDate(p.date_start),
                dateEndEstimated: toIsoDate(p.date_end_estimated),
                estimatedTimeDays: Number(p.estimated_time_days),
                createdByMatricule: p.created_by || '',
                excludeWeekends: toBool(p.exclude_weekends),
                excludeHolidays: toBool(p.exclude_holidays),
                weekendsRuleFrom: toIsoDate(p.weekends_rule_from),
                holidaysRuleFrom: toIsoDate(p.holidays_rule_from),
                developers: devs
                    .filter(d => d.project_id === p.id)
                    .map(d => usersByNumId.get(d.user_num_id))
                    .filter(Boolean),
                metierIds,
                metiers: metierIds.map(id => metiersById.get(id)).filter(Boolean),
                tasks: tasks.filter(t => t.project_id === p.id).map(t => mapTask(t, usersByNumId))
            };
        });
    }

    /** Remplace les développeurs et métiers rattachés à un projet. */
    async function replaceLinks(projectId, developerIds, metierIds) {
        if (Array.isArray(developerIds)) {
            await pool.query('DELETE FROM agenda_project_developers WHERE project_id = ?', [projectId]);
            for (const id of developerIds) {
                await pool.query(
                    'INSERT IGNORE INTO agenda_project_developers (project_id, user_num_id) VALUES (?,?)',
                    [projectId, Number(id)]
                );
            }
        }
        if (Array.isArray(metierIds)) {
            await pool.query('DELETE FROM agenda_project_metiers WHERE project_id = ?', [projectId]);
            for (const id of metierIds) {
                await pool.query(
                    'INSERT IGNORE INTO agenda_project_metiers (project_id, metier_id) VALUES (?,?)',
                    [projectId, Number(id)]
                );
            }
        }
    }

    /** Colonnes d'une tâche à partir d'un payload front (création comme mise à jour). */
    function taskColumns(projectId, body) {
        return {
            project_id: projectId,
            parent_task_id: body.parentTaskId ?? null,
            name: body.name,
            description: body.description || null,
            status: body.status || 'NON_COMMENCE',
            assigned_user_id: body.assignedUserId ?? null,
            date_start: body.dateStart,
            date_end: body.dateEnd,
            base_date_end: body.baseDateEnd ?? body.dateEnd,
            half_days_duration: body.halfDaysDuration ?? 1,
            comments: body.comments || null,
            is_risky: body.isRisky ? 1 : 0,
            git_branch: body.gitBranch || null,
            worked_half_days: JSON.stringify(body.workedHalfDays || []),
            extensions: JSON.stringify(body.extensions || []),
            history: JSON.stringify(body.history || []),
            sub_tasks: JSON.stringify(body.subTasks || [])
        };
    }

    async function respondTask(res, taskId) {
        const [[row]] = await pool.query('SELECT * FROM agenda_tasks WHERE id = ?', [taskId]);
        if (!row) return res.status(404).json({ error: 'Tâche introuvable' });
        const usersByNumId = await loadUsersByNumId();
        res.json(mapTask(row, usersByNumId));
    }

    // ── Référentiel (projeté depuis le portail) ──────────────────────────────

    app.get('/api/agenda/users', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query(
                'SELECT num_id, username, email, role, metier_id FROM users WHERE num_id IS NOT NULL ORDER BY username'
            );
            res.json(rows.map(mapUser));
        } catch (e) { fail(res, 'get users', e); }
    });

    app.get('/api/agenda/groupes', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, nom FROM portal_groupes WHERE is_active = 1 ORDER BY nom');
            res.json(rows);
        } catch (e) { fail(res, 'get groupes', e); }
    });

    // Appartenance aux groupes, exprimée avec l'identifiant numérique des utilisateurs
    app.get('/api/agenda/user-groupes', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query(
                `SELECT u.num_id AS user_id, ug.groupe_id
                 FROM portal_user_groupes ug
                 JOIN users u ON u.id = ug.user_id`
            );
            res.json(rows);
        } catch (e) { fail(res, 'get user-groupes', e); }
    });

    app.get('/api/agenda/metiers', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT id, nom, color FROM portal_metiers WHERE is_active = 1 ORDER BY nom');
            res.json(rows);
        } catch (e) { fail(res, 'get metiers', e); }
    });

    // ── Projets ──────────────────────────────────────────────────────────────

    app.get('/api/agenda/projects', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            res.json(await loadProjects());
        } catch (e) { fail(res, 'get projects', e); }
    });

    app.post('/api/agenda/projects', async (req, res) => {
        const user = requireUser(req, res);
        if (!user) return;
        const b = req.body || {};
        if (!b.code || !b.name) return res.status(400).json({ error: 'code et name sont requis' });
        try {
            const [r] = await pool.query(
                `INSERT INTO agenda_projects
                 (code, name, description, status, risk_level, date_start, date_end_estimated,
                  estimated_time_days, created_by, exclude_weekends, exclude_holidays)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [b.code, b.name, b.description || '', 'EN_COURS', b.riskLevel || 'FAIBLE',
                 b.dateStart, b.dateEndEstimated, b.estimatedTimeDays || 0, user.username || '',
                 b.excludeWeekends ? 1 : 0, b.excludeHolidays ? 1 : 0]
            );
            await replaceLinks(r.insertId, b.developerIds, b.metierIds);

            for (const t of (b.tasks || [])) {
                const cols = taskColumns(r.insertId, t);
                await pool.query('INSERT INTO agenda_tasks SET ?', [cols]);
            }

            const [projet] = await loadProjects([r.insertId]);
            res.json(projet);
        } catch (e) { fail(res, 'create project', e); }
    });

    app.put('/api/agenda/projects/:id', async (req, res) => {
        if (!requireUser(req, res)) return;
        const b = req.body || {};
        const id = Number(req.params.id);
        try {
            const [[current]] = await pool.query('SELECT * FROM agenda_projects WHERE id = ?', [id]);
            if (!current) return res.status(404).json({ error: 'Projet introuvable' });
            await pool.query(
                `UPDATE agenda_projects SET code=?, name=?, description=?, risk_level=?, date_start=?,
                        date_end_estimated=?, estimated_time_days=?, exclude_weekends=?, exclude_holidays=?,
                        weekends_rule_from=?, holidays_rule_from=?
                 WHERE id=?`,
                [b.code ?? current.code, b.name ?? current.name, b.description ?? current.description,
                 b.riskLevel ?? current.risk_level, b.dateStart ?? current.date_start,
                 b.dateEndEstimated ?? current.date_end_estimated,
                 b.estimatedTimeDays ?? current.estimated_time_days,
                 b.excludeWeekends ? 1 : 0, b.excludeHolidays ? 1 : 0,
                 b.weekendsRuleFrom ?? null, b.holidaysRuleFrom ?? null, id]
            );
            await replaceLinks(id, b.developerIds, b.metierIds);
            const [projet] = await loadProjects([id]);
            res.json(projet);
        } catch (e) { fail(res, 'update project', e); }
    });

    app.delete('/api/agenda/projects/:id', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [r] = await pool.query('DELETE FROM agenda_projects WHERE id = ?', [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Projet introuvable' });
            res.json({ success: true });
        } catch (e) { fail(res, 'delete project', e); }
    });

    // ── Tâches ───────────────────────────────────────────────────────────────

    app.post('/api/agenda/projects/:id/tasks', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const cols = taskColumns(Number(req.params.id), req.body || {});
            const [r] = await pool.query('INSERT INTO agenda_tasks SET ?', [cols]);
            await respondTask(res, r.insertId);
        } catch (e) { fail(res, 'create task', e); }
    });

    app.put('/api/agenda/tasks/:id', async (req, res) => {
        if (!requireUser(req, res)) return;
        const id = Number(req.params.id);
        try {
            const [[current]] = await pool.query('SELECT * FROM agenda_tasks WHERE id = ?', [id]);
            if (!current) return res.status(404).json({ error: 'Tâche introuvable' });
            const b = req.body || {};
            // baseDateEnd omis volontairement par certains appelants (recalcul de retard,
            // déplacement) : on conserve alors l'ancrage existant plutôt que de l'écraser.
            const cols = taskColumns(current.project_id, b);
            if (b.baseDateEnd === undefined) cols.base_date_end = current.base_date_end;
            await pool.query('UPDATE agenda_tasks SET ? WHERE id = ?', [cols, id]);
            await respondTask(res, id);
        } catch (e) { fail(res, 'update task', e); }
    });

    app.patch('/api/agenda/tasks/:id', async (req, res) => {
        if (!requireUser(req, res)) return;
        const { status } = req.body || {};
        if (!status) return res.status(400).json({ error: 'status est requis' });
        try {
            const [r] = await pool.query('UPDATE agenda_tasks SET status = ? WHERE id = ?', [status, req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Tâche introuvable' });
            res.json(true);
        } catch (e) { fail(res, 'patch task status', e); }
    });

    app.delete('/api/agenda/tasks/:id', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [r] = await pool.query('DELETE FROM agenda_tasks WHERE id = ?', [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Tâche introuvable' });
            res.json({ success: true });
        } catch (e) { fail(res, 'delete task', e); }
    });

    // ── Indisponibilités ─────────────────────────────────────────────────────

    app.get('/api/agenda/unavailabilities', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [rows] = await pool.query('SELECT * FROM agenda_unavailabilities ORDER BY date_start');
            res.json(rows.map(r => ({
                id: r.id, userId: r.user_id,
                dateStart: toIsoDate(r.date_start), dateEnd: toIsoDate(r.date_end),
                reason: r.reason || undefined
            })));
        } catch (e) { fail(res, 'get unavailabilities', e); }
    });

    app.post('/api/agenda/unavailabilities', async (req, res) => {
        if (!requireUser(req, res)) return;
        const { userId, dateStart, dateEnd, reason } = req.body || {};
        if (!userId || !dateStart || !dateEnd) {
            return res.status(400).json({ error: 'userId, dateStart et dateEnd sont requis' });
        }
        try {
            const [r] = await pool.query(
                'INSERT INTO agenda_unavailabilities (user_id, date_start, date_end, reason) VALUES (?,?,?,?)',
                [Number(userId), dateStart, dateEnd, reason || null]
            );
            res.json({ id: r.insertId, userId: Number(userId), dateStart, dateEnd, reason });
        } catch (e) { fail(res, 'create unavailability', e); }
    });

    app.delete('/api/agenda/unavailabilities/:id', async (req, res) => {
        if (!requireUser(req, res)) return;
        try {
            const [r] = await pool.query('DELETE FROM agenda_unavailabilities WHERE id = ?', [req.params.id]);
            if (!r.affectedRows) return res.status(404).json({ error: 'Période introuvable' });
            res.json({ success: true });
        } catch (e) { fail(res, 'delete unavailability', e); }
    });

    console.log('[Agenda] Routes /api/agenda/* montées');
}

module.exports = { register, ensureSchema };
