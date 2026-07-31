/**
 * Worganic — Backend de la sous-application `apps/appli-projets` (éditeur de
 * projets/documentation, app NX autonome sur son propre port — voir
 * apps/appli-projets/src/environments/environment.ts).
 *
 * Co-localisé avec le frontend (apps/appli-projets/) plutôt que dans
 * server/modules/ : c'est le contrat "sous-application" (voir
 * docs/architecture-sous-applications.md) — tout ce qui compose le backend
 * de projets vit dans ce seul dossier. `projets` reste néanmoins une
 * application NX séparée (Mode "autonome", pas "intégré" comme agenda/
 * recettes) : son catalogue `portal_apps.url_path` pointe vers son port
 * dédié (http://localhost:4203), pas une route interne du portail.
 *
 * Regroupe : Mes Projets (frank_projects), l'éditeur de fichiers-projets
 * (file_project_meta, versions, brouillons, corbeille), les commentaires F6,
 * les conversations Zone 5, la collaboration temps réel (SSE), le git par
 * projet, les Méga-Outils (Trello/Mockup/Array/Prompt) et l'outil de tests
 * par projet (Cahier de recette embarqué dans l'éditeur).
 *
 * Montage : require('../apps/appli-projets/server').register(app, { pool, getSessionUser, logEdition, getPlatformSetting, setPlatformSetting, insertContentVersion, getLatestVersion, getLatestVersionsMap, computeEditionDiff })
 *
 * `insertContentVersion`/`getLatestVersion`/`getLatestVersionsMap`/`computeEditionDiff`
 * restent définies dans server-data.js (pas dupliquées ici) car le suivi de
 * versions de fichiers-projets est aussi consulté par la fonctionnalité
 * transverse "WO Action History" (undo d'une action ayant modifié un fichier).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ftp = require('basic-ftp');
const projetGit = require('../../../server/modules/projet-git');
const githubService = require('../../../server/modules/github-service');
const ftpService = require('../../../server/modules/ftp-service');
const { upsertCatalogEntry, markAppMounted } = require('../../../server/modules/portal-apps');

// Entrée de catalogue `portal_apps` propre à projets (voir upsertCatalogEntry
// ci-dessous) : ce module n'a plus besoin d'être connu par son nom dans
// server/modules/portal-apps.js pour apparaître dans le menu des applications.
// URL absolue (port dédié 4203) : contrairement à agenda/recettes, projets
// est une application NX séparée, pas une route interne du portail.
const CATALOG_ENTRY = {
    code: 'projets', nom: 'Projets', description: 'Éditeur de projets et de documentation',
    url_path: 'http://localhost:4203', icone: 'folder_open', ordre: 1
};

const BASE_DIR = path.join(__dirname, '..', '..', '..', 'data');
const PROJECTS_DIR = path.join(BASE_DIR, 'projets');
const CONVERSATIONS_DIR = path.join(PROJECTS_DIR, 'conversations');

/**
 * Crée les tables de projets et amorce le catalogue. Idempotent.
 *
 * `frank_projects` est la seule table encore créée par l'ancien script manuel
 * `server/init-db.js` (jamais rejoué automatiquement) — reprise ici pour que
 * ce module soit auto-suffisant sur une installation neuve (contrat
 * "sous-application" : chaque ensureSchema() doit pouvoir tourner seul).
 */
async function ensureSchema(pool) {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS frank_projects (
                id          CHAR(36)      PRIMARY KEY,
                title       VARCHAR(500)  NOT NULL,
                description TEXT          DEFAULT '',
                content     LONGTEXT      DEFAULT '',
                status      VARCHAR(50)   DEFAULT 'draft',
                user_id     CHAR(36)      NULL,
                created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_frank_projects_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `).catch(e => console.error('[DB] frank_projects init error:', e.message));

    // Partage d'un projet "Mes Projets" (frank_projects) avec d'autres users
    await pool.query(`
        CREATE TABLE IF NOT EXISTS frank_project_shares (
            project_id  CHAR(36)     NOT NULL,
            user_id     CHAR(36)     NOT NULL,
            created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, user_id),
            FOREIGN KEY (project_id) REFERENCES frank_projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(e => console.error('[DB] frank_project_shares init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS frank_project_steps (
            id CHAR(36) PRIMARY KEY,
            project_id CHAR(36) NOT NULL,
            step_number INT NOT NULL DEFAULT 1,
            content LONGTEXT,
            linked_doc_id VARCHAR(64) DEFAULT NULL,
            linked_doc_title VARCHAR(255) DEFAULT NULL,
            result LONGTEXT DEFAULT NULL,
            result_status VARCHAR(50) DEFAULT 'pending',
            user_id VARCHAR(64) NOT NULL,
            username VARCHAR(128) NOT NULL,
            notes TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_frank_steps_project (project_id)
        )
    `).catch(e => console.error('[DB] frank_project_steps init error:', e.message));

    // Métadonnées et structure des file-projects (source de vérité partagée entre children)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS file_project_meta (
            id              VARCHAR(255) PRIMARY KEY,
            display_name    VARCHAR(255) NOT NULL,
            git_remote_url  VARCHAR(500) DEFAULT NULL,
            structure       JSON         NOT NULL DEFAULT (JSON_ARRAY()),
            owner_user_id   VARCHAR(64)  DEFAULT NULL,
            created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_fpm_owner (owner_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] file_project_meta init error:', e.message));

    // F6 — Commentaires inline par section
    await pool.query(`
        CREATE TABLE IF NOT EXISTS project_comments (
            id          VARCHAR(36)  PRIMARY KEY,
            project_id  VARCHAR(255) NOT NULL,
            folder_id   VARCHAR(255) NOT NULL,
            user_id     VARCHAR(64)  NOT NULL,
            username    VARCHAR(255) NOT NULL,
            text        TEXT         NOT NULL,
            created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_pc_project (project_id),
            INDEX idx_pc_folder  (project_id, folder_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] project_comments init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_instances (
            id          VARCHAR(64)  PRIMARY KEY,
            type        VARCHAR(64)  NOT NULL,
            name        VARCHAR(255) NOT NULL,
            project_id  VARCHAR(255) NOT NULL,
            outil_id    VARCHAR(64)  DEFAULT NULL,
            created_by  VARCHAR(64)  DEFAULT NULL,
            created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_moi_project (project_id),
            INDEX idx_moi_type    (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_instances init error:', e.message));

    await pool.query(`ALTER TABLE mega_outil_instances ADD COLUMN IF NOT EXISTS folder_id VARCHAR(64) DEFAULT NULL`).catch(e => console.warn('[DB] mega_outil_instances migration folder_id:', e.message));
    await pool.query(`ALTER TABLE mega_outil_instances ADD COLUMN IF NOT EXISTS thumbnail_data MEDIUMTEXT DEFAULT NULL`).catch(e => console.warn('[DB] mega_outil_instances migration thumbnail_data:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_trello_cards (
            id           VARCHAR(64)   PRIMARY KEY,
            instance_id  VARCHAR(64)   NOT NULL,
            title        VARCHAR(500)  NOT NULL,
            description  TEXT          DEFAULT NULL,
            status       VARCHAR(32)   DEFAULT 'todo',
            priority     VARCHAR(32)   DEFAULT 'medium',
            order_index  INT           DEFAULT 0,
            creator_id   VARCHAR(64)   DEFAULT NULL,
            creator_name VARCHAR(255)  DEFAULT NULL,
            created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_motc_instance (instance_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_trello_cards init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_mockup_elements (
            id          VARCHAR(64)   PRIMARY KEY,
            instance_id VARCHAR(64)   NOT NULL,
            type        VARCHAR(32)   NOT NULL,
            x           INT           NOT NULL DEFAULT 0,
            y           INT           NOT NULL DEFAULT 0,
            width       INT           NOT NULL DEFAULT 100,
            height      INT           NOT NULL DEFAULT 40,
            label       VARCHAR(500)  NOT NULL DEFAULT '',
            created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mome_instance (instance_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_mockup_elements init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_mockup_comments (
            id          VARCHAR(64)   PRIMARY KEY,
            instance_id VARCHAR(64)   NOT NULL,
            element_id  VARCHAR(64)   NOT NULL,
            text        TEXT          NOT NULL,
            author_id   VARCHAR(64)   DEFAULT NULL,
            author_name VARCHAR(255)  DEFAULT NULL,
            created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_momc_instance (instance_id),
            INDEX idx_momc_element  (element_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_mockup_comments init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_mockup_connections (
            id                VARCHAR(64)   PRIMARY KEY,
            project_name      VARCHAR(255)  NOT NULL,
            from_instance_id  VARCHAR(64)   NOT NULL,
            to_instance_id    VARCHAR(64)   NOT NULL,
            label             VARCHAR(255)  DEFAULT NULL,
            created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_momconn_project (project_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_mockup_connections init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_mockup_diagram_positions (
            instance_id   VARCHAR(64)   NOT NULL,
            project_name  VARCHAR(255)  NOT NULL,
            x             INT           NOT NULL DEFAULT 0,
            y             INT           NOT NULL DEFAULT 0,
            PRIMARY KEY (instance_id, project_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_mockup_diagram_positions init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_array_grids (
            instance_id   VARCHAR(36)   PRIMARY KEY,
            cells         JSON          NOT NULL DEFAULT '[]',
            col_widths    JSON          NOT NULL DEFAULT '[]',
            row_heights   JSON          NOT NULL DEFAULT '[]',
            col_count     INT           NOT NULL DEFAULT 3,
            row_count     INT           NOT NULL DEFAULT 5,
            updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_array_grids init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_prompt_history (
            id           VARCHAR(64)   PRIMARY KEY,
            instance_id  VARCHAR(64)   NOT NULL,
            user_prompt  TEXT          NOT NULL,
            system_prompt TEXT         DEFAULT NULL,
            result       LONGTEXT      NOT NULL,
            provider     VARCHAR(64)   DEFAULT 'claude',
            model        VARCHAR(128)  DEFAULT NULL,
            executed_by  VARCHAR(64)   DEFAULT NULL,
            executed_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mph_instance (instance_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_prompt_history init error:', e.message));

    // Conversations du mode Tchat — table dédiée (distincte de mega_outil_prompt_history
    // qui est un couple question/réponse unique, pas adaptée à une conversation multi-tours).
    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_prompt_chat_sessions (
            id           VARCHAR(64)  PRIMARY KEY,
            instance_id  VARCHAR(64)  NOT NULL,
            provider     VARCHAR(64)  DEFAULT 'claude',
            model        VARCHAR(128) DEFAULT NULL,
            created_by   VARCHAR(64)  DEFAULT NULL,
            created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_mpcs_instance (instance_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_prompt_chat_sessions init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_prompt_chat_messages (
            id          VARCHAR(64)  PRIMARY KEY,
            session_id  VARCHAR(64)  NOT NULL,
            role        VARCHAR(16)  NOT NULL,
            text        LONGTEXT     NOT NULL,
            seq         INT          NOT NULL,
            created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mpcm_session (session_id, seq)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_prompt_chat_messages init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS mega_outil_prompt_config (
            key_name   VARCHAR(64)  PRIMARY KEY,
            value      LONGTEXT     DEFAULT NULL,
            updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] mega_outil_prompt_config init error:', e.message));

    await pool.query(`
        CREATE TABLE IF NOT EXISTS projet_section_lock (
            node_id        VARCHAR(64)   NOT NULL,
            projet_id      VARCHAR(128)  NOT NULL,
            locked_by_id   VARCHAR(128)  NOT NULL,
            locked_by_name VARCHAR(128)  NOT NULL DEFAULT '',
            locked_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (node_id, locked_by_id),
            INDEX idx_psl_projet (projet_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(e => console.error('[DB] projet_section_lock init error:', e.message));

    // Migration : anciennes installations où la PK était sur node_id seul (un seul
    // éditeur connu par section). Passage à une PK composite pour supporter plusieurs
    // présences simultanées sur le même nœud. Idempotent — no-op si déjà migré.
    await pool.query(`
        ALTER TABLE projet_section_lock DROP PRIMARY KEY, ADD PRIMARY KEY (node_id, locked_by_id)
    `).catch(() => { /* déjà migré, ou PK déjà composite */ });

    // Historique immuable du contenu des fichiers de projet (source de vérité,
    // remplace fileVersions en mémoire + les écrasements disque à l'aveugle).
    // Jamais d'UPDATE/DELETE sur cette table — toute correction insère une nouvelle ligne.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS projet_content_version (
            id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            version_id             VARCHAR(36)   NOT NULL UNIQUE,
            project_id             VARCHAR(255)  NOT NULL,
            node_id                VARCHAR(64)   NOT NULL,
            file_path               VARCHAR(500)  DEFAULT NULL,
            content                LONGTEXT      NOT NULL,
            content_hash           CHAR(64)      NOT NULL,
            base_version_id        VARCHAR(36)   DEFAULT NULL,
            merged_from_version_id VARCHAR(36)   DEFAULT NULL,
            origin                 VARCHAR(24)   NOT NULL DEFAULT 'checkpoint',
            author_id              VARCHAR(64)   DEFAULT NULL,
            author_name            VARCHAR(255)  DEFAULT '',
            created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            INDEX idx_pcv_node_latest (project_id, node_id, id DESC),
            INDEX idx_pcv_base (base_version_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(e => console.error('[DB] projet_content_version init error:', e.message));

    // Brouillon local par utilisateur : contenu tapé mais pas encore validé via
    // "Enregistrer et partager". N'alimente jamais projet_content_version — sert
    // uniquement de zone de travail privée par (projet, nœud, utilisateur), pour
    // que deux utilisateurs puissent éditer la même section sans s'écraser.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS projet_local_draft (
            project_id       VARCHAR(255) NOT NULL,
            node_id          VARCHAR(64)  NOT NULL,
            user_id          VARCHAR(64)  NOT NULL,
            folder_id        VARCHAR(64)  DEFAULT NULL,
            content          LONGTEXT     NOT NULL,
            base_version_id  VARCHAR(36)  DEFAULT NULL,
            updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (project_id, node_id, user_id),
            INDEX idx_pld_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(e => console.error('[DB] projet_local_draft init error:', e.message));

    // Corbeille (soft-delete) : toute suppression de fichier/dossier déplace le
    // contenu physique vers .trash/ au lieu de le supprimer, et enregistre ici un
    // snapshot restaurable. Purge définitive automatique après 30 jours (voir
    // balayage périodique plus bas), ou manuelle via DELETE .../trash/:trashId.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS projet_trash_entry (
            id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
            project_id         VARCHAR(255)  NOT NULL,
            node_id            VARCHAR(64)   NOT NULL,
            node_type          VARCHAR(10)   NOT NULL,
            name               VARCHAR(255)  NOT NULL,
            original_path      VARCHAR(500)  NOT NULL,
            original_parent_id VARCHAR(64)   DEFAULT NULL,
            structure_snapshot JSON          NOT NULL,
            trash_disk_path    VARCHAR(500)  NOT NULL,
            deleted_by_id      VARCHAR(64)   DEFAULT NULL,
            deleted_by_name    VARCHAR(255)  DEFAULT '',
            deleted_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            purge_at           DATETIME      NOT NULL,
            restored_at        DATETIME      DEFAULT NULL,
            restored_by_id     VARCHAR(64)   DEFAULT NULL,
            purged_at          DATETIME      DEFAULT NULL,
            INDEX idx_pte_project (project_id),
            INDEX idx_pte_purge (purge_at, restored_at, purged_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(e => console.error('[DB] projet_trash_entry init error:', e.message));

    await pool.query(`
        ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS linked_doc_id VARCHAR(64) DEFAULT NULL
    `).catch(e => console.error('[DB] frank_projects migration linked_doc_id:', e.message));

    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_type VARCHAR(20) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_type:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_server VARCHAR(255) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_server:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_password VARCHAR(500) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_password:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_directory VARCHAR(500) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_directory:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_owner_type VARCHAR(50) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_owner_type:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_repo_name VARCHAR(255) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_repo_name:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_visibility VARCHAR(50) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_visibility:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_username VARCHAR(128) DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_username:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS backup_port INT DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration backup_port:', e.message));
    await pool.query(`ALTER TABLE frank_projects ADD COLUMN IF NOT EXISTS ia_instructions TEXT DEFAULT NULL`).catch(e => console.error('[DB] frank_projects migration ia_instructions:', e.message));

    await pool.query(`ALTER TABLE file_project_meta ADD COLUMN IF NOT EXISTS outils JSON DEFAULT NULL`).catch(e => console.warn('[DB] file_project_meta migration outils:', e.message));


    // Migration one-shot : nettoyer les branches wip/* laissées par l'ancien
    // mécanisme de checkout live (le contenu de référence vit désormais en BDD).
    try {
        if (fs.existsSync(PROJECTS_DIR)) {
            const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
            let totalCleaned = 0;
            for (const d of projectDirs) {
                const projetPath = path.join(PROJECTS_DIR, d.name);
                if (!projetGit.isRepo(projetPath)) continue;
                const result = projetGit.cleanupOrphanWipBranches(projetPath);
                if (result.success) totalCleaned += result.cleaned || 0;
            }
            if (totalCleaned) console.log(`[MIGRATION] ${totalCleaned} branche(s) git wip orpheline(s) nettoyée(s)`);
        }
    } catch (e) { console.warn('[MIGRATION] wip branches cleanup:', e.message); }

    fs.mkdirSync(PROJECTS_DIR, { recursive: true });

    await upsertCatalogEntry(pool, CATALOG_ENTRY);
    } catch (e) {
        console.error('[Projets] Erreur init schéma:', e.message);
    }
}

function register(app, { pool, getSessionUser, logEdition, getPlatformSetting, setPlatformSetting, insertContentVersion, getLatestVersion, getLatestVersionsMap, computeEditionDiff }) {
    // Preuve que ce module (donc le dossier apps/appli-projets/) est bien présent
    // dans cette installation — voir markAppMounted/isAppAvailable dans portal-apps.js.
    // (Sans effet réel sur la disponibilité affichée : projets est une app externe,
    // toujours considérée disponible — voir isAppAvailable — mais on l'appelle par
    // cohérence avec le contrat "sous-application".)
    markAppMounted(CATALOG_ENTRY.code);

// ============================================================
// Frankenstein Projects — CRUD (documents markdown, stockés en pg)
// ============================================================

function stepRowToObj(r) {
    return {
        id: r.id,
        projectId: r.project_id,
        stepNumber: r.step_number,
        content: r.content || '',
        linkedDocId: r.linked_doc_id || null,
        linkedDocTitle: r.linked_doc_title || null,
        result: r.result || null,
        resultStatus: r.result_status || 'pending',
        userId: r.user_id,
        username: r.username,
        notes: r.notes || null,
        createdAt: r.created_at
    };
}

function frankRowToObj(r) {
    return {
        id: r.id, title: r.title, description: r.description, content: r.content,
        status: r.status, userId: r.user_id,
        linkedDocId: r.linked_doc_id || null,
        _ownerUsername: r.owner_username || null,
        _sharedWithMe: !!r._sharedWithMe,
        createdAt: r.created_at, updatedAt: r.updated_at,
        iaInstructions: r.ia_instructions || null,
        backupType: r.backup_type || null,
        backupServer: r.backup_server || null,
        backupUsername: r.backup_username || null,
        backupPassword: r.backup_password || null,
        backupPort: r.backup_port || null,
        backupDirectory: r.backup_directory || null,
        backupOwnerType: r.backup_owner_type || null,
        backupRepoName: r.backup_repo_name || null,
        backupVisibility: r.backup_visibility || null
    };
}

// Vérifie si un user a accès à un projet frank (propriétaire, partagé, ou admin)
async function frankUserHasAccess(projectRow, user) {
    if (user.role === 'admin' || projectRow.user_id === user.id) return true;
    const [shares] = await pool.query(
        'SELECT 1 FROM frank_project_shares WHERE project_id = ? AND user_id = ? LIMIT 1',
        [projectRow.id, user.id]
    );
    return shares.length > 0;
}

// GET /api/frank/projects — liste (admin: tous, user: les siens + ceux partagés avec lui)
app.get('/api/frank/projects', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        let query, params;
        if (user.role === 'admin') {
            query = `SELECT fp.*, u.username AS owner_username, 0 AS _sharedWithMe FROM frank_projects fp
                     LEFT JOIN users u ON fp.user_id = u.id
                     ORDER BY COALESCE(fp.updated_at, fp.created_at) DESC`;
            params = [];
        } else {
            query = `SELECT fp.*, u.username AS owner_username, (fp.user_id != ?) AS _sharedWithMe FROM frank_projects fp
                     LEFT JOIN users u ON fp.user_id = u.id
                     WHERE fp.user_id = ? OR fp.id IN (SELECT project_id FROM frank_project_shares WHERE user_id = ?)
                     ORDER BY COALESCE(fp.updated_at, fp.created_at) DESC`;
            params = [user.id, user.id, user.id];
        }
        const [rows] = await pool.query(query, params);
        res.json(rows.map(frankRowToObj));
    } catch (e) {
        console.error('[FRANK] List error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/frank/projects/:id
app.get('/api/frank/projects/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT fp.*, u.username AS owner_username FROM frank_projects fp
             LEFT JOIN users u ON fp.user_id = u.id WHERE fp.id = ?`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (!(await frankUserHasAccess(rows[0], user)))
            return res.status(403).json({ error: 'Accès refusé' });
        res.json(frankRowToObj(rows[0]));
    } catch (e) {
        console.error('[FRANK] Get error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/frank/projects/:id/shares — liste des users avec qui le projet est partagé
app.get('/api/frank/projects/:id/shares', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query('SELECT user_id FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (user.role !== 'admin' && rows[0].user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        const [shares] = await pool.query(
            `SELECT s.user_id AS id, u.username, u.email FROM frank_project_shares s
             JOIN users u ON u.id = s.user_id WHERE s.project_id = ? ORDER BY u.username`,
            [req.params.id]
        );
        res.json(shares);
    } catch (e) {
        console.error('[FRANK] List shares error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/frank/projects/:id/shares — partager avec un user (par email)
app.post('/api/frank/projects/:id/shares', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email requis' });
    try {
        const [rows] = await pool.query('SELECT user_id FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (user.role !== 'admin' && rows[0].user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });

        const [targetRows] = await pool.query('SELECT id, username, email FROM users WHERE email = ?', [email]);
        const target = targetRows[0];
        if (!target) return res.status(404).json({ error: 'Utilisateur introuvable avec cet email' });
        if (target.id === rows[0].user_id) return res.status(400).json({ error: 'Impossible de partager avec le propriétaire du projet' });

        await pool.query(
            'INSERT IGNORE INTO frank_project_shares (project_id, user_id) VALUES (?, ?)',
            [req.params.id, target.id]
        );
        res.json({ success: true, user: { id: target.id, username: target.username, email: target.email } });
    } catch (e) {
        console.error('[FRANK] Share error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/frank/projects/:id/shares/:userId — retirer le partage
app.delete('/api/frank/projects/:id/shares/:userId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query('SELECT user_id FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (user.role !== 'admin' && rows[0].user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        await pool.query(
            'DELETE FROM frank_project_shares WHERE project_id = ? AND user_id = ?',
            [req.params.id, req.params.userId]
        );
        res.json({ success: true });
    } catch (e) {
        console.error('[FRANK] Unshare error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/frank/projects — créer
app.post('/api/frank/projects', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { title, description, content, status } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est requis' });
    try {
        const now = new Date().toISOString();
        const newProject = {
            id: crypto.randomUUID(),
            title: title.trim(),
            description: description || '',
            content: content || '',
            status: status || 'draft',
            userId: user.id,
            createdAt: now,
            updatedAt: now
        };
        await pool.query(
            `INSERT INTO frank_projects (id, title, description, content, status, user_id, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [newProject.id, newProject.title, newProject.description, newProject.content,
             newProject.status, newProject.userId, newProject.createdAt, newProject.updatedAt]
        );
        res.status(201).json(newProject);
    } catch (e) {
        console.error('[FRANK] Create error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/frank/projects/:id — mettre à jour
app.put('/api/frank/projects/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query('SELECT * FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        const p = rows[0];
        if (!(await frankUserHasAccess(p, user)))
            return res.status(403).json({ error: 'Accès refusé' });
        const { title, description, status, iaInstructions, backupType, backupServer, backupUsername, backupPassword, backupPort, backupDirectory, backupOwnerType, backupRepoName, backupVisibility } = req.body;
        const updatedAt = new Date().toISOString();
        const updated = {
            title: title !== undefined ? title.trim() : p.title,
            description: description !== undefined ? description : p.description,
            status: status !== undefined ? status : p.status,
            ia_instructions: iaInstructions !== undefined ? (iaInstructions || null) : p.ia_instructions,
            backup_type: backupType !== undefined ? backupType : p.backup_type,
            backup_server: backupServer !== undefined ? backupServer : p.backup_server,
            backup_username: backupUsername !== undefined ? backupUsername : p.backup_username,
            backup_password: backupPassword !== undefined ? backupPassword : p.backup_password,
            backup_port: backupPort !== undefined ? (backupPort ? parseInt(backupPort) : null) : p.backup_port,
            backup_directory: backupDirectory !== undefined ? backupDirectory : p.backup_directory,
            backup_owner_type: backupOwnerType !== undefined ? backupOwnerType : p.backup_owner_type,
            backup_repo_name: backupRepoName !== undefined ? backupRepoName : p.backup_repo_name,
            backup_visibility: backupVisibility !== undefined ? backupVisibility : p.backup_visibility
        };
        await pool.query(
            `UPDATE frank_projects SET title=?, description=?, status=?, ia_instructions=?, backup_type=?, backup_server=?, backup_username=?, backup_password=?, backup_port=?, backup_directory=?, backup_owner_type=?, backup_repo_name=?, backup_visibility=?, updated_at=? WHERE id=?`,
            [updated.title, updated.description, updated.status, updated.ia_instructions, updated.backup_type, updated.backup_server, updated.backup_username, updated.backup_password, updated.backup_port, updated.backup_directory, updated.backup_owner_type, updated.backup_repo_name, updated.backup_visibility, updatedAt, req.params.id]
        );
        res.json({
            id: req.params.id, title: updated.title, description: updated.description, status: updated.status,
            userId: p.user_id, linkedDocId: p.linked_doc_id || null,
            iaInstructions: updated.ia_instructions || null,
            backupType: updated.backup_type || null, backupServer: updated.backup_server || null,
            backupUsername: updated.backup_username || null, backupPassword: updated.backup_password || null,
            backupPort: updated.backup_port || null, backupDirectory: updated.backup_directory || null,
            backupOwnerType: updated.backup_owner_type || null, backupRepoName: updated.backup_repo_name || null,
            backupVisibility: updated.backup_visibility || null,
            createdAt: p.created_at, updatedAt, _ownerUsername: null
        });
    } catch (e) {
        console.error('[FRANK] Update error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/frank/projects/:id
app.delete('/api/frank/projects/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query('SELECT user_id FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (user.role !== 'admin' && rows[0].user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        await pool.query('DELETE FROM frank_projects WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FRANK] Delete error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/frank/projects/:id/test-ftp
app.post('/api/frank/projects/:id/test-ftp', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { host, username, password, port, directory } = req.body;
    if (!host || !username || !password) return res.status(400).json({ error: 'host, username et password sont requis' });
    const client = new ftp.Client(10000);
    client.ftp.verbose = false;
    try {
        await client.access({
            host: host.trim(),
            user: username.trim(),
            password: password,
            port: port ? parseInt(port) : 21,
            secure: false
        });
        let dirResult = null;
        if (directory && directory.trim()) {
            try {
                await client.cd(directory.trim());
                const list = await client.list();
                dirResult = { accessible: true, files: list.length };
            } catch (dirErr) {
                dirResult = { accessible: false, error: dirErr.message };
            }
        }
        res.json({ success: true, message: 'Connexion FTP réussie', directory: dirResult });
    } catch (e) {
        res.json({ success: false, message: `Échec de connexion : ${e.message}` });
    } finally {
        client.close();
    }
});

// ── Frankenstein Project Steps ───────────────────────────────

// GET /api/frank/projects/:id/steps
app.get('/api/frank/projects/:id/steps', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [proj] = await pool.query('SELECT user_id FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!proj[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (user.role !== 'admin' && proj[0].user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        const [rows] = await pool.query(
            'SELECT * FROM frank_project_steps WHERE project_id = ? ORDER BY step_number DESC',
            [req.params.id]
        );
        res.json(rows.map(stepRowToObj));
    } catch (e) {
        console.error('[FRANK] Steps list error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/frank/projects/:id/steps
app.post('/api/frank/projects/:id/steps', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [proj] = await pool.query('SELECT user_id FROM frank_projects WHERE id = ?', [req.params.id]);
        if (!proj[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        if (user.role !== 'admin' && proj[0].user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        const { content, linkedDocId, linkedDocTitle, notes } = req.body;
        const [maxRows] = await pool.query(
            'SELECT COALESCE(MAX(step_number), 0) AS maxn FROM frank_project_steps WHERE project_id = ?',
            [req.params.id]
        );
        const stepNumber = (maxRows[0].maxn || 0) + 1;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await pool.query(
            `INSERT INTO frank_project_steps
             (id, project_id, step_number, content, linked_doc_id, linked_doc_title, result, result_status, user_id, username, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?, ?)`,
            [id, req.params.id, stepNumber, content || '', linkedDocId || null, linkedDocTitle || null,
             user.id, user.username, notes || null, now]
        );
        const [newRows] = await pool.query('SELECT * FROM frank_project_steps WHERE id = ?', [id]);
        res.status(201).json(stepRowToObj(newRows[0]));
    } catch (e) {
        console.error('[FRANK] Steps create error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PUT /api/frank/projects/:id/steps/:stepId
app.put('/api/frank/projects/:id/steps/:stepId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT fps.*, fp.user_id AS proj_user_id
             FROM frank_project_steps fps
             JOIN frank_projects fp ON fp.id = fps.project_id
             WHERE fps.id = ? AND fps.project_id = ?`,
            [req.params.stepId, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Étape non trouvée' });
        if (user.role !== 'admin' && rows[0].proj_user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        const s = rows[0];
        const content       = req.body.content       !== undefined ? req.body.content       : s.content;
        const linkedDocId   = req.body.linkedDocId   !== undefined ? (req.body.linkedDocId || null)   : s.linked_doc_id;
        const linkedDocTitle= req.body.linkedDocTitle!== undefined ? (req.body.linkedDocTitle || null) : s.linked_doc_title;
        const result        = req.body.result        !== undefined ? req.body.result        : s.result;
        const resultStatus  = req.body.resultStatus  !== undefined ? req.body.resultStatus  : s.result_status;
        const notes         = req.body.notes         !== undefined ? req.body.notes         : s.notes;
        await pool.query(
            `UPDATE frank_project_steps
             SET content=?, linked_doc_id=?, linked_doc_title=?, result=?, result_status=?, notes=?
             WHERE id=?`,
            [content, linkedDocId, linkedDocTitle, result, resultStatus, notes, req.params.stepId]
        );
        const [updatedRows] = await pool.query('SELECT * FROM frank_project_steps WHERE id = ?', [req.params.stepId]);
        res.json(stepRowToObj(updatedRows[0]));
    } catch (e) {
        console.error('[FRANK] Steps update error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/frank/projects/:id/steps/:stepId
app.delete('/api/frank/projects/:id/steps/:stepId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT fps.user_id, fp.user_id AS proj_user_id
             FROM frank_project_steps fps
             JOIN frank_projects fp ON fp.id = fps.project_id
             WHERE fps.id = ? AND fps.project_id = ?`,
            [req.params.stepId, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Étape non trouvée' });
        if (user.role !== 'admin' && rows[0].proj_user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });
        await pool.query('DELETE FROM frank_project_steps WHERE id = ?', [req.params.stepId]);
        res.json({ success: true });
    } catch (e) {
        console.error('[FRANK] Steps delete error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============================================================
// File-based Projects (data/projets/)
// ============================================================


// POST /api/frank/projects/:id/copy — copie complète (DB + steps + fichiers)
app.post('/api/frank/projects/:id/copy', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        // 1. Récupérer le projet source
        const [rows] = await pool.query(
            `SELECT fp.*, u.username AS owner_username FROM frank_projects fp
             LEFT JOIN users u ON fp.user_id = u.id WHERE fp.id = ?`,
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Projet non trouvé' });
        const src = rows[0];
        if (user.role !== 'admin' && src.user_id !== user.id)
            return res.status(403).json({ error: 'Accès refusé' });

        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        const newTitle = (req.body.title || `${src.title}_v2`).trim();

        // 2. Copier le projet en BDD
        await pool.query(
            `INSERT INTO frank_projects
             (id, title, description, content, status, user_id, ia_instructions,
              backup_type, backup_server, backup_username, backup_password, backup_port,
              backup_directory, backup_owner_type, backup_repo_name, backup_visibility,
              created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [newId, newTitle, src.description || '', src.content || '', src.status || 'draft',
             user.id, src.ia_instructions || null,
             src.backup_type || null, src.backup_server || null, src.backup_username || null,
             src.backup_password || null, src.backup_port || null, src.backup_directory || null,
             src.backup_owner_type || null, src.backup_repo_name || null, src.backup_visibility || null,
             now, now]
        );

        // 3. Copier les steps
        const [steps] = await pool.query(
            'SELECT * FROM frank_project_steps WHERE project_id = ? ORDER BY step_number',
            [req.params.id]
        );
        for (const step of steps) {
            await pool.query(
                `INSERT INTO frank_project_steps
                 (id, project_id, step_number, content, linked_doc_id, linked_doc_title,
                  result, result_status, user_id, username, notes, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [crypto.randomUUID(), newId, step.step_number, step.content || '',
                 step.linked_doc_id || null, step.linked_doc_title || null,
                 step.result || null, step.result_status || 'pending',
                 step.user_id, step.username, step.notes || null, step.created_at]
            );
        }

        // 4. Copier les fichiers (data/projets/<id>/) sans le dossier .git
        const srcDir = path.join(PROJECTS_DIR, req.params.id);
        const dstDir = path.join(PROJECTS_DIR, newId);
        if (fs.existsSync(srcDir)) {
            fs.cpSync(srcDir, dstDir, {
                recursive: true,
                filter: (src) => !src.replace(/\\/g, '/').includes('/.git')
            });
            // Mettre à jour config.json avec le nouveau nom et timestamps
            const configPath = path.join(dstDir, 'config.json');
            if (fs.existsSync(configPath)) {
                try {
                    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    cfg.projectName = newTitle;
                    cfg.createdAt = now;
                    cfg.updatedAt = now;
                    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
                } catch {}
            }
            // Copier file_project_meta si présent
            try {
                const [metaRows] = await pool.query(
                    'SELECT * FROM file_project_meta WHERE id = ?', [req.params.id]
                );
                if (metaRows[0]) {
                    const m = metaRows[0];
                    await pool.query(
                        `INSERT INTO file_project_meta
                         (id, display_name, git_remote_url, structure, owner_user_id, created_at, updated_at)
                         VALUES (?,?,?,?,?,?,?)`,
                        [newId, newTitle, null,
                         typeof m.structure === 'string' ? m.structure : JSON.stringify(m.structure || []),
                         user.id, now, now]
                    );
                }
            } catch {}
        }

        // 5. Retourner le nouveau projet
        const [newRows] = await pool.query(
            `SELECT fp.*, u.username AS owner_username FROM frank_projects fp
             LEFT JOIN users u ON fp.user_id = u.id WHERE fp.id = ?`,
            [newId]
        );
        res.status(201).json(frankRowToObj(newRows[0]));
    } catch (e) {
        console.error('[FRANK] Copy error:', e);
        res.status(500).json({ error: 'Erreur lors de la copie du projet' });
    }
});

if (!fs.existsSync(CONVERSATIONS_DIR)) {
    fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

function slugify(text) {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
        .replace(/-+/g, '-').trim();
}

function cleanStructure(items) {
    if (!items) return [];
    const seen = new Set();
    const cleaned = [];
    for (const item of items) {
        const key = `${item.type}:${item.name.toLowerCase()}`;
        if (!seen.has(key)) {
            seen.add(key);
            if (item.children) {
                item.children = cleanStructure(item.children);
            }
            cleaned.push(item);
        }
    }
    return cleaned;
}

function migrateOutils(config) {
    const topFolderIds = (config.structure || []).filter(n => n.type === 'folder').map(n => n.id);
    if (config.outils && config.outils.length > 0) {
        // Repair: si un outil edition a rootFolderIds vide mais que des dossiers existent en structure, auto-populer
        for (const outil of config.outils) {
            if (outil.type === 'edition' && (!outil.rootFolderIds || outil.rootFolderIds.length === 0) && topFolderIds.length > 0) {
                outil.rootFolderIds = topFolderIds;
            }
        }
        return config;
    }
    config.outils = [{
        id: require('crypto').randomUUID(),
        type: 'edition',
        name: 'Edition',
        rootFolderIds: topFolderIds,
        createdAt: config.createdAt || new Date().toISOString()
    }];
    return config;
}

async function getProjectConfig(projectName) {
    // Lire le config.json local en parallèle (peut être plus riche que MySQL si migration partielle)
    const cfgPath = path.join(PROJECTS_DIR, projectName, 'config.json');
    let localConfig = null;
    if (fs.existsSync(cfgPath)) {
        try {
            localConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            if (localConfig.structure) localConfig.structure = cleanStructure(localConfig.structure);
        } catch {}
    }

    let mysqlRow = null;
    try {
        const [rows] = await pool.query(
            'SELECT display_name, git_remote_url, structure, outils, created_at, updated_at FROM file_project_meta WHERE id = ?',
            [projectName]
        );
        if (rows.length > 0) mysqlRow = rows[0];
    } catch (e) {
        console.warn('[getProjectConfig] MySQL error, fallback filesystem:', e.message);
    }

    if (mysqlRow) {
        const mysqlStructure = cleanStructure(
            typeof mysqlRow.structure === 'string' ? JSON.parse(mysqlRow.structure) : (mysqlRow.structure || [])
        );
        const mysqlOutils = mysqlRow.outils
            ? (typeof mysqlRow.outils === 'string' ? JSON.parse(mysqlRow.outils) : mysqlRow.outils)
            : null;
        const localStructure = localConfig?.structure || [];
        // Préférer le filesystem uniquement si MySQL est vide (migration/bootstrap).
        // Ne plus jamais basculer silencieusement vers le disque quand les deux structures
        // existent mais divergent (ex: config.json obsolète avec un timestamp plus récent
        // suite à une horloge décalée ou une restauration manuelle malheureuse) : ça écraserait
        // MySQL — source de vérité — avec des données potentiellement périmées. On se contente
        // de logger l'anomalie ; une réparation manuelle reste possible via un traitement admin dédié.
        const localUpdatedAt = localConfig?.updatedAt ? new Date(localConfig.updatedAt).getTime() : 0;
        const mysqlUpdatedAt = mysqlRow.updated_at ? new Date(mysqlRow.updated_at).getTime() : 0;
        const preferLocal = mysqlStructure.length === 0 && localStructure.length > 0;
        if (!preferLocal && localStructure.length > 0 && mysqlStructure.length > 0 && localUpdatedAt > mysqlUpdatedAt) {
            console.warn(`[CONFIG-DRIFT] projet=${projectName} disque plus récent que MySQL (disk=${localConfig?.updatedAt} mysql=${mysqlRow.updated_at}, nodes disk=${localStructure.length} nodes mysql=${mysqlStructure.length}) — MySQL reste la source de vérité, disque ignoré`);
        }
        if (preferLocal) {
            try {
                await pool.query(
                    'UPDATE file_project_meta SET structure = ?, outils = ?, display_name = ?, updated_at = ? WHERE id = ?',
                    [JSON.stringify(localStructure), JSON.stringify(localConfig?.outils || null), localConfig.projectName || mysqlRow.display_name, new Date(), projectName]
                );
            } catch (e2) { console.warn('[getProjectConfig] MySQL structure update failed:', e2.message); }
            return migrateOutils({ projectName: localConfig.projectName || mysqlRow.display_name, gitRemoteUrl: mysqlRow.git_remote_url || null, createdAt: mysqlRow.created_at, updatedAt: localConfig.updatedAt || mysqlRow.updated_at, structure: localStructure, outils: mysqlOutils || localConfig?.outils || null });
        }
        return migrateOutils({ projectName: mysqlRow.display_name, gitRemoteUrl: mysqlRow.git_remote_url || null, createdAt: mysqlRow.created_at, updatedAt: mysqlRow.updated_at, structure: mysqlStructure, outils: mysqlOutils });
    }

    // Pas d'entrée MySQL → migration depuis le filesystem
    if (!localConfig) return null;
    try {
        await pool.query(
            'INSERT INTO file_project_meta (id, display_name, structure, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE structure = IF(JSON_LENGTH(VALUES(structure)) > JSON_LENGTH(structure), VALUES(structure), structure), display_name = VALUES(display_name), updated_at = VALUES(updated_at)',
            [projectName, localConfig.projectName || projectName, JSON.stringify(localConfig.structure || []), localConfig.createdAt || new Date(), localConfig.updatedAt || new Date()]
        );
    } catch (e2) { console.warn('[getProjectConfig] auto-migration failed:', e2.message); }
    return migrateOutils(localConfig);
}

async function saveProjectConfig(projectName, config) {
    config.updatedAt = new Date().toISOString();
    try {
        await pool.query(
            'UPDATE file_project_meta SET structure = ?, outils = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(config.structure || []), JSON.stringify(config.outils || null), config.updatedAt, projectName]
        );
    } catch (e) { console.warn('[saveProjectConfig] MySQL write error:', e.message); }
    // Backup filesystem
    const cfgPath = path.join(PROJECTS_DIR, projectName, 'config.json');
    if (fs.existsSync(path.dirname(cfgPath))) {
        try { fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8'); } catch {}
    }
}

function findNodeById(items, id) {
    for (const item of items) {
        if (item.id === id) return item;
        if (item.children) { const f = findNodeById(item.children, id); if (f) return f; }
    }
    return null;
}

function findNodeByPath(items, targetPath) {
    for (const item of items) {
        if (item.path === targetPath) return item;
        if (item.children) { const f = findNodeByPath(item.children, targetPath); if (f) return f; }
    }
    return null;
}

function removeNodeById(items, id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) { items.splice(idx, 1); return true; }
    for (const item of items) {
        if (item.children && removeNodeById(item.children, id)) return true;
    }
    return false;
}

/** Retourne l'id du dossier parent du noeud `targetId` (null si racine, undefined si introuvable). */
function findParentId(items, targetId, parentId = null) {
    for (const item of items) {
        if (item.id === targetId) return parentId;
        if (item.children) {
            const found = findParentId(item.children, targetId, item.id);
            if (found !== undefined) return found;
        }
    }
    return undefined;
}

/** Supprime le dossier .trash/<horodatage>-<id>/ s'il est devenu vide (après restore ou purge). */
function removeEmptyTrashParentDir(trashItemFull) {
    try {
        const parentDir = path.dirname(trashItemFull);
        if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) fs.rmdirSync(parentDir);
    } catch (_) {}
}

/**
 * Corbeille (soft-delete) : déplace un fichier/dossier vers .trash/<horodatage>-<id>/
 * au lieu de le supprimer définitivement, et enregistre un snapshot restaurable en
 * base (structure + emplacement d'origine). Utilisé par les deux routes DELETE
 * (fichier/dossier) — suppression manuelle comme nettoyage auto de fichiers
 * additionnels orphelins passent par le même mécanisme, donc protégés de la même façon.
 */
async function moveNodeToTrash(projectName, item, originalParentId, user) {
    const trashId = crypto.randomUUID();
    const trashRelDir = `.trash/${Date.now()}-${item.id}`;
    const trashDirFull = safeProjectPath(projectName, trashRelDir);
    const full = safeProjectPath(projectName, item.path);
    if (trashDirFull && full && fs.existsSync(full)) {
        fs.mkdirSync(trashDirFull, { recursive: true });
        fs.renameSync(full, path.join(trashDirFull, item.name));
    }
    projetGit.ensureTrashGitignore(path.join(PROJECTS_DIR, projectName));
    await pool.query(
        `INSERT INTO projet_trash_entry
         (id, project_id, node_id, node_type, name, original_path, original_parent_id, structure_snapshot, trash_disk_path, deleted_by_id, deleted_by_name, purge_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [trashId, projectName, item.id, item.type, item.name, item.path, originalParentId || null,
         JSON.stringify(item), `${trashRelDir}/${item.name}`, user?.id || null, user?.username || '']
    );
    return trashId;
}

function isImageFile(name) {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
}

// Lit le contenu des fichiers depuis la BDD (source de vérité). Si un noeud n'a
// encore aucune version (projet créé avant cette migration), bascule transparente :
// lit le disque et insère une version `migration-bootstrap` pour les prochains appels.
async function attachContent(projectName, items, versionsMap) {
    if (!versionsMap) versionsMap = await getLatestVersionsMap(projectName);
    const sortedItems = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
    const results = [];
    for (const item of sortedItems) {
        const result = { ...item };
        if (item.type === 'file') {
            if (isImageFile(item.name)) {
                result.content = '';
                result.fileType = 'image';
            } else {
                const versionRow = versionsMap.get(item.id);
                if (versionRow) {
                    result.content = versionRow.content;
                    result.fileVersion = versionRow.version_id;
                } else {
                    const full = path.join(PROJECTS_DIR, projectName, item.path);
                    const diskContent = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
                    result.content = diskContent;
                    try {
                        const bootstrapped = await insertContentVersion(pool, {
                            projectId: projectName, nodeId: item.id, filePath: item.path,
                            content: diskContent, baseVersionId: null, mergedFromVersionId: null,
                            origin: 'migration-bootstrap', authorId: null, authorName: ''
                        });
                        result.fileVersion = bootstrapped.versionId;
                    } catch (e) {
                        console.error('[VERSION] bootstrap error:', e.message);
                        result.fileVersion = null;
                    }
                }
                result.fileType = 'text';
            }
            if (item.children) result.children = await attachContent(projectName, item.children, versionsMap);
        } else {
            result.children = await attachContent(projectName, item.children || [], versionsMap);
        }
        results.push(result);
    }
    return results;
}

function safeProjectPath(projectName, filePath) {
    const base = path.resolve(path.join(PROJECTS_DIR, projectName));
    const full = path.resolve(path.join(base, filePath));
    if (!full.startsWith(base + path.sep) && full !== base) return null;
    return full;
}

// POST /api/file-projects/:name/open-folder — ouvre, dans l'explorateur de fichiers de l'OS,
// le dossier local d'une section (ou la racine du projet si folderId absent).
app.post('/api/file-projects/:name/open-folder', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const config = await getProjectConfig(req.params.name);
        if (!config) return res.status(404).json({ error: 'Projet non trouvé' });

        // folderId → chemin relatif ; un fichier → son dossier parent ; absent → racine projet
        let relPath = '';
        const folderId = req.body?.folderId;
        if (folderId) {
            const item = findNodeById(config.structure || [], folderId);
            if (!item) return res.status(404).json({ error: 'Section non trouvée' });
            relPath = item.type === 'folder' ? item.path : path.dirname(item.path || '');
        }

        const full = safeProjectPath(req.params.name, relPath);
        if (!full) return res.status(400).json({ error: 'Chemin invalide' });
        if (!fs.existsSync(full)) return res.status(404).json({ error: 'Dossier introuvable en local (section non clonée localement)' });

        const { spawn } = require('child_process');
        if (process.platform === 'win32') {
            spawn('explorer.exe', [full], { detached: true }).on('error', () => {});
        } else if (process.platform === 'darwin') {
            spawn('open', [full], { detached: true }).on('error', () => {});
        } else {
            spawn('xdg-open', [full], { detached: true }).on('error', () => {});
        }
        res.json({ success: true, path: full });
    } catch (e) {
        console.error('[open-folder] error:', e.message);
        res.status(500).json({ error: 'Échec ouverture du dossier: ' + e.message });
    }
});

// GET /api/projects
app.get('/api/file-projects', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            'SELECT id, display_name, git_remote_url, created_at, updated_at FROM file_project_meta ORDER BY updated_at DESC'
        );
        const result = rows.map(r => ({
            name: r.id,
            projectName: r.display_name,
            gitRemoteUrl: r.git_remote_url || null,
            localExists: fs.existsSync(path.join(PROJECTS_DIR, r.id)),
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// F4 — GET /api/search?q=&projectId= — recherche full-text dans contenu.md et docs additionnels
app.get('/api/search', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const q = (req.query.q || '').toString().trim();
    if (q.length < 2) return res.json({ results: [] });
    const projectFilter = (req.query.projectId || '').toString().trim();
    const MAX_RESULTS = 50;
    const EXCERPT_LEN = 80;
    const results = [];
    try {
        if (!fs.existsSync(PROJECTS_DIR)) return res.json({ results: [] });
        const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory() && (!projectFilter || d.name === projectFilter));

        const qLower = q.toLowerCase();
        for (const d of projectDirs) {
            if (results.length >= MAX_RESULTS) break;
            const projectName = d.name;
            const cfg = getProjectConfig(projectName);
            if (!cfg || !cfg.structure) continue;
            const displayName = cfg.projectName || projectName;

            const walk = (items, sectionPath, parentSection) => {
                if (results.length >= MAX_RESULTS) return;
                for (const item of items || []) {
                    if (results.length >= MAX_RESULTS) return;
                    if (item.type === 'folder') {
                        const folderPath = item.path ? path.join(PROJECTS_DIR, projectName, item.path) : null;
                        const nextSection = { id: item.id, name: item.name, path: folderPath };
                        const nextPath = [...sectionPath, item.name];
                        walk(item.children || [], nextPath, nextSection);
                    } else if (item.type === 'file' && item.path && !isImageFile(item.name)) {
                        const full = path.join(PROJECTS_DIR, projectName, item.path);
                        if (!fs.existsSync(full)) continue;
                        let content;
                        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
                        const cLower = content.toLowerCase();
                        const idx = cLower.indexOf(qLower);
                        if (idx === -1) continue;
                        // Comptage occurrences
                        let matchCount = 0; let pos = 0;
                        while ((pos = cLower.indexOf(qLower, pos)) !== -1) { matchCount++; pos += qLower.length; }
                        // Extrait : ~EXCERPT_LEN chars autour de la première occurrence
                        const start = Math.max(0, idx - 40);
                        const end = Math.min(content.length, idx + qLower.length + 40);
                        const rawExcerpt = (start > 0 ? '…' : '') + content.substring(start, end).replace(/\s+/g, ' ').trim() + (end < content.length ? '…' : '');

                        results.push({
                            projectId: projectName,
                            projectName: displayName,
                            sectionId: parentSection?.id || '',
                            sectionName: parentSection?.name || item.name.replace(/\.md$/, ''),
                            sectionPath,
                            fileId: item.id,
                            fileName: item.name,
                            excerpt: rawExcerpt,
                            matchCount
                        });
                    }
                }
            };
            walk(cfg.structure, [], null);
        }
        res.json({ results, total: results.length, truncated: results.length >= MAX_RESULTS });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// F6 — Commentaires inline par section (project_comments)
// ============================================================

// GET /api/project-comments/:projectId?folderId=
app.get('/api/project-comments/:projectId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projectId } = req.params;
    const folderId = (req.query.folderId || '').toString();
    try {
        let rows;
        if (folderId) {
            [rows] = await pool.query(
                'SELECT * FROM project_comments WHERE project_id = ? AND folder_id = ? ORDER BY created_at ASC',
                [projectId, folderId]
            );
        } else {
            [rows] = await pool.query(
                'SELECT * FROM project_comments WHERE project_id = ? ORDER BY created_at ASC',
                [projectId]
            );
        }
        res.json({
            comments: rows.map(r => ({
                id: r.id,
                projectId: r.project_id,
                folderId: r.folder_id,
                userId: r.user_id,
                username: r.username,
                text: r.text,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            }))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/project-comments/:projectId/counts — compteurs par folderId
app.get('/api/project-comments/:projectId/counts', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projectId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT folder_id, COUNT(*) AS cnt FROM project_comments WHERE project_id = ? GROUP BY folder_id',
            [projectId]
        );
        const counts = {};
        for (const r of rows) counts[r.folder_id] = r.cnt;
        res.json({ counts });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/project-comments/:projectId  body: { folderId, text }
app.post('/api/project-comments/:projectId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projectId } = req.params;
    const { folderId, text } = req.body || {};
    if (!folderId || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'folderId et text requis' });
    }
    if (text.length > 5000) return res.status(400).json({ error: 'Commentaire trop long (max 5000 chars)' });
    try {
        const id = 'comment-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
        await pool.query(
            'INSERT INTO project_comments (id, project_id, folder_id, user_id, username, text) VALUES (?, ?, ?, ?, ?, ?)',
            [id, projectId, folderId, String(user.id), user.username || '', text.trim()]
        );
        const [rows] = await pool.query('SELECT * FROM project_comments WHERE id = ?', [id]);
        const r = rows[0];
        res.json({
            comment: {
                id: r.id, projectId: r.project_id, folderId: r.folder_id,
                userId: r.user_id, username: r.username, text: r.text,
                createdAt: r.created_at, updatedAt: r.updated_at
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/project-comments/:projectId/:commentId
app.delete('/api/project-comments/:projectId/:commentId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projectId, commentId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT user_id FROM project_comments WHERE id = ? AND project_id = ?',
            [commentId, projectId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Commentaire introuvable' });
        const isOwner = String(rows[0].user_id) === String(user.id);
        const isAdmin = user.role === 'admin';
        if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Action non autorisée' });
        await pool.query('DELETE FROM project_comments WHERE id = ?', [commentId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * Helper : configure le remote GitHub pour un projet (idempotent).
 * - Crée le repo GitHub si absent
 * - Configure le remote 'origin' avec une URL authentifiée
 * - Push main vers le remote
 * Retourne un résumé du résultat sans exposer le token.
 */
async function setupGithubRemoteForProject(projectDir, dirName, projectName) {
    if (!githubService.isEnabled()) return { enabled: false };
    try {
        const repoName = githubService.buildRepoName(dirName, projectName);
        const created = await githubService.createRepo(repoName, {
            description: `Worganic project: ${projectName}`
        });
        if (!created.success) {
            console.warn('[GitHub] createRepo failed:', created.error);
            return { enabled: true, success: false, error: created.error };
        }
        const authUrl = githubService.buildAuthenticatedCloneUrl(repoName);
        const remote = projetGit.setRemote(projectDir, authUrl);
        if (!remote.success) {
            return { enabled: true, success: false, error: remote.error };
        }
        const pushed = projetGit.pushMain(projectDir);
        return {
            enabled: true,
            success: pushed.success,
            repoName,
            publicUrl: githubService.buildPublicRepoUrl(repoName),
            alreadyExisted: !!created.alreadyExists,
            pushed: pushed.success,
            pushError: pushed.success ? null : pushed.error
        };
    } catch (e) {
        console.warn('[GitHub] setupGithubRemoteForProject error:', e.message);
        return { enabled: true, success: false, error: e.message };
    }
}

/**
 * Garantit qu'un projet a un remote GitHub configuré (lazy setup pour les projets
 * créés avant l'activation de GitHub). Si GitHub est activé mais que le repo local
 * n'a pas de remote, crée le repo GitHub et configure l'URL authentifiée.
 * Rafraîchit l'URL si le remote existe déjà (au cas où le token a tourné).
 */
async function ensureGithubRemoteForProject(projectName, config) {
    if (!githubService.isEnabled()) return { enabled: false };
    const projetPath = path.join(PROJECTS_DIR, projectName);
    if (!projetGit.isRepo(projetPath)) return { isRepo: false };
    const displayName = config?.projectName || projectName;
    if (!projetGit.hasRemote(projetPath)) {
        console.log(`[ensureGithubRemote] no remote for ${projectName}, setting up`);
        const setup = await setupGithubRemoteForProject(projetPath, projectName, displayName);
        if (setup?.publicUrl) {
            try {
                await pool.query('UPDATE file_project_meta SET git_remote_url = ? WHERE id = ?', [setup.publicUrl, projectName]);
            } catch (e) { console.warn('[ensureGithubRemote] DB update failed:', e.message); }
        }
        return setup;
    }
    try {
        const freshUrl = githubService.buildAuthenticatedCloneUrl(
            githubService.buildRepoName(projectName, displayName)
        );
        if (freshUrl) projetGit.setRemote(projetPath, freshUrl);
        return { refreshed: true };
    } catch (e) {
        console.warn('[ensureGithubRemote] refresh failed:', e.message);
        return { error: e.message };
    }
}

// POST /api/projects
app.post('/api/file-projects', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projectName, folderName } = req.body;
    if (!projectName) return res.status(400).json({ error: 'Nom requis' });
    const dir = folderName || slugify(projectName);
    if (!dir) return res.status(400).json({ error: 'Nom invalide' });
    // Vérifier en MySQL ET en filesystem
    try {
        const [existing] = await pool.query('SELECT id FROM file_project_meta WHERE id = ?', [dir]);
        if (existing.length > 0) return res.status(409).json({ error: 'Projet déjà existant' });
    } catch {}
    const projectDir = path.join(PROJECTS_DIR, dir);
    if (fs.existsSync(projectDir)) return res.status(409).json({ error: 'Projet déjà existant' });
    try {
        const now = new Date().toISOString();
        const config = { projectName, createdAt: now, updatedAt: now, structure: [] };
        // Insérer en MySQL en premier (source de vérité)
        await pool.query(
            'INSERT INTO file_project_meta (id, display_name, structure, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [dir, projectName, JSON.stringify([]), user.id || null, now, now]
        );
        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'config.json'), JSON.stringify(config, null, 2));
        // Git : init local + (si activé) création repo GitHub + push initial
        let github = null;
        let gitRemoteUrl = null;
        try {
            projetGit.initProjetRepo(projectDir, {
                authorName: user.username || user.email || 'Worganic',
                authorEmail: user.email || 'worganic@local'
            });
            github = await setupGithubRemoteForProject(projectDir, dir, projectName);
            if (github?.success && github?.publicUrl) {
                gitRemoteUrl = github.publicUrl;
                await pool.query('UPDATE file_project_meta SET git_remote_url = ? WHERE id = ?', [gitRemoteUrl, dir]);
            }
        } catch (gitErr) {
            console.warn('[ProjetGit] init/github au create-project échoué:', gitErr.message);
        }
        res.status(201).json({ name: dir, ...config, gitRemoteUrl, github });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:name
app.get('/api/file-projects/:name', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    res.json(config);
});

// DELETE /api/projects/:name
app.delete('/api/file-projects/:name', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const projectDir = path.join(PROJECTS_DIR, req.params.name);
        if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
        await pool.query('DELETE FROM file_project_meta WHERE id = ?', [req.params.name]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:name/files
app.get('/api/file-projects/:name/files', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    try {
        const localExists = fs.existsSync(path.join(PROJECTS_DIR, req.params.name));
        const files = localExists ? await attachContent(req.params.name, config.structure || []) : (config.structure || []);
        res.json({ success: true, project: config.projectName, gitRemoteUrl: config.gitRemoteUrl || null, localExists, files });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:name/files
app.post('/api/file-projects/:name/files', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const { name, parentId, content, outilSlug } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    try {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        let filePath;
        let parentItems = config.structure;
        if (parentId) {
            const parent = findNodeById(config.structure, parentId);
            if (!parent || parent.type !== 'folder') return res.status(400).json({ error: 'Dossier parent invalide' });
            filePath = `${parent.path}/${fileName}`;
            parent.children = parent.children || [];
            parentItems = parent.children;
        } else if (outilSlug && /^[a-z0-9-]+$/.test(outilSlug)) {
            const outilDir = safeProjectPath(req.params.name, outilSlug);
            if (outilDir) fs.mkdirSync(outilDir, { recursive: true });
            filePath = `${outilSlug}/${fileName}`;
        } else {
            filePath = fileName;
        }

        // Éviter les doublons dans config.structure
        const existing = parentItems.find(i => i.name.toLowerCase() === fileName.toLowerCase());
        if (existing) {
            if (existing.type !== 'file') return res.status(409).json({ error: 'Un dossier porte déjà ce nom' });
            // Écriture disque best-effort uniquement — pas de checkpoint BDD automatique ici
            // (la validation explicite via "Enregistrer et partager" reste seule responsable des
            // versions BDD ; sinon un checkpoint prématuré avec un contenu encore incomplet
            // écraserait visuellement le brouillon en cours au prochain rechargement structurel).
            const full = safeProjectPath(req.params.name, existing.path);
            if (full) {
                try { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content || '', 'utf8'); }
                catch (diskErr) { console.warn('[BACKUP] écriture disque échouée (create dedup):', diskErr.message); }
            }
            return res.status(200).json({ ...existing, content: content || '' });
        }

        const full = safeProjectPath(req.params.name, filePath);
        if (!full) return res.status(400).json({ error: 'Chemin invalide' });
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content || '', 'utf8');
        const newFile = { id: crypto.randomUUID(), type: 'file', name: fileName, path: filePath, order: parentItems.length + 1 };
        parentItems.push(newFile);
        // Pas de checkpoint BDD automatique à la création : attachContent() bootstrape depuis le
        // disque (origin migration-bootstrap) à la première lecture si aucune version n'existe
        // encore, et le vrai checkpoint n'est créé qu'au clic explicite "Enregistrer et partager".

        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `create_file ${fileName}`)
            .catch(gitErr => console.warn('[ProjetGit] commit create_file:', gitErr.message));
        res.status(201).json({ ...newFile, content: content || '' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/projects/:name/files/:id
// Source de vérité = BDD (projet_content_version, immuable). Le disque
// (data/projets/<name>/...) n'est plus qu'une sauvegarde passive best-effort —
// aucun git checkout/branche n'a plus lieu sur ce chemin de sauvegarde live.
app.put('/api/file-projects/:name/files/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'file') return res.status(404).json({ error: 'Fichier non trouvé' });

    try {
        const full = safeProjectPath(req.params.name, item.path);
        if (!full) return res.status(400).json({ error: 'Chemin invalide' });
        const content = req.body.content ?? '';
        const folderId = req.body.folderId || null;
        const publish = req.body.publish === true;
        const editionSource = req.headers['x-edition-source'] || (publish ? 'publish' : 'manual-save');
        const baseVersionId = req.headers['x-base-version-id'] || req.headers['x-file-version'] || null;
        if (req.headers['x-file-version'] && !req.headers['x-base-version-id']) {
            console.warn('[VERSION] header x-file-version obsolète reçu — le client doit migrer vers x-base-version-id');
        }

        // Sauvegarde disque best-effort : jamais bloquant, jamais source de vérité.
        try {
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content, 'utf8');
        } catch (diskErr) {
            console.warn('[BACKUP] écriture disque échouée (non bloquant):', diskErr.message);
        }

        const latestBeforeSave = await getLatestVersion(pool, req.params.name, req.params.id);

        // Transaction + détection de conflit réelle contre la BDD. Cette route n'est
        // plus appelée que sur une action volontaire de l'utilisateur (Enregistrer et
        // partager, ou création initiale du fichier) — chaque appel est un checkpoint.
        const conn = await pool.getConnection();
        let versionId = null;
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query(
                `SELECT version_id, content, author_name, created_at FROM projet_content_version
                 WHERE project_id = ? AND node_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
                [req.params.name, req.params.id]
            );
            const currentLatest = rows[0] || null;
            if (currentLatest && baseVersionId && currentLatest.version_id !== baseVersionId) {
                await conn.rollback();
                conn.release();
                return res.status(409).json({
                    error: 'conflict',
                    message: 'Ce fichier a été modifié par un autre utilisateur depuis votre dernière synchronisation',
                    base: { versionId: baseVersionId },
                    server: {
                        versionId: currentLatest.version_id,
                        content: currentLatest.content,
                        authorName: currentLatest.author_name,
                        createdAt: currentLatest.created_at
                    },
                    mine: { content }
                });
            }
            const inserted = await insertContentVersion(conn, {
                projectId: req.params.name, nodeId: req.params.id, filePath: item.path,
                content, baseVersionId: baseVersionId || (currentLatest?.version_id ?? null),
                mergedFromVersionId: null,
                origin: publish ? 'publish' : 'checkpoint',
                authorId: user.id, authorName: user.username || user.email || 'Utilisateur'
            });
            await conn.commit();
            versionId = inserted.versionId;
        } finally {
            conn.release();
        }

        // Logger la modification (best-effort, texte lisible pour debug humain)
        const oldContentForLog = latestBeforeSave?.content ?? '';
        if (oldContentForLog !== content) {
            const diff = computeEditionDiff(oldContentForLog, content);
            logEdition({
                event: 'SAVE',
                project: req.params.name,
                user: user.username || user.email || user.id,
                source: editionSource,
                file: item.path,
                fileId: req.params.id,
                size: oldContentForLog.length,
                newSize: content.length,
                oldLines: oldContentForLog.split('\n').length,
                newLines: content.split('\n').length,
                diff,
            });
        }
        await saveProjectConfig(req.params.name, config);

        broadcastToProject(req.params.name, 'version_saved', {
            nodeId: req.params.id,
            folderId,
            versionId,
            authorId: user.id,
            authorName: user.username || user.email || 'Utilisateur',
            timestamp: new Date().toISOString(),
            origin: publish ? 'publish' : 'checkpoint'
        });

        // Git/FTP : uniquement sur publication explicite ("Partager"). Plus aucun
        // commit/checkout silencieux sur l'autosave — le contenu de référence est en BDD.
        const projetPath = path.join(PROJECTS_DIR, req.params.name);
        let publishCommitHash = null;
        let publishResult = null;
        let ftpPublishResult = null;

        if (publish) {
            let backupType = null;
            try {
                backupType = await ftpService.getBackupType(pool, req.params.name);
            } catch (e) {
                console.warn('[file PUT] backup_type lookup error:', e.message);
            }

            if (backupType === 'ftp') {
                try {
                    const ftpConfig = await ftpService.getFtpConfig(pool, req.params.name);
                    if (ftpConfig) {
                        const localPath = path.join(PROJECTS_DIR, req.params.name, item.path);
                        const fileList = fs.existsSync(localPath)
                            ? [{ localPath, remotePath: `projets/${req.params.name}/${item.path}` }]
                            : [];
                        if (fileList.length > 0) {
                            ftpPublishResult = await ftpService.uploadFiles(ftpConfig, fileList);
                            if (ftpPublishResult.errors?.length) {
                                console.warn('[FTP] upload partial errors:', ftpPublishResult.errors);
                            }
                        }
                    }
                } catch (ftpErr) {
                    console.warn('[FTP] upload sur Partager échoué:', ftpErr.message);
                    return res.status(502).json({
                        error: 'Modifications sauvegardées localement mais non synchronisées avec le serveur FTP',
                        localSaved: true,
                        pushFailed: true
                    });
                }
            } else {
                try {
                    if (projetGit.isRepo(projetPath)) {
                        // Garantir le remote GitHub : crée le repo + remote si manquant
                        // (cas projet créé avant activation GitHub), rafraîchit l'URL sinon.
                        await ensureGithubRemoteForProject(req.params.name, config);
                        publishResult = await projetGit.publishContent(projetPath, {
                            filePath: item.path,
                            content,
                            message: `pub: ${user.username || user.email || 'user'} - ${item.name || req.params.id}`,
                            username: user.username || user.email || 'user'
                        });
                        publishCommitHash = publishResult?.commitHash || null;
                    }
                } catch (gitErr) {
                    console.warn('[ProjetGit] publishContent échoué:', gitErr.message);
                }
            }

            broadcastToProject(req.params.name, 'content_update', {
                nodeId: req.params.id,
                folderId,
                content,
                updatedBy: user.id,
                updatedByName: user.username || user.email || 'Utilisateur',
                timestamp: new Date().toISOString()
            });
            logEdition({
                event: 'SYNC-BROADCAST',
                project: req.params.name,
                user: user.username || user.email || user.id,
                source: 'publish-broadcast',
                file: item.path,
                fileId: req.params.id,
                size: content.length,
                newSize: content.length,
                oldLines: 0,
                newLines: content.split('\n').length,
                note: `Contenu diffusé via SSE content_update → ${folderId || 'root'}`,
            });
            broadcastToProject(req.params.name, 'section_published', {
                nodeId: req.params.id,
                folderId,
                sectionName: item.name || req.params.id,
                publishedBy: {
                    userId: user.id,
                    username: user.username || user.email || 'Utilisateur'
                },
                commitHash: publishCommitHash,
                timestamp: new Date().toISOString()
            });
            // Libérer uniquement la présence de l'auteur de la publication — un autre
            // utilisateur peut encore être en train d'éditer la même section en local.
            const unlockId = folderId || req.params.id;
            try {
                await pool.query('DELETE FROM projet_section_lock WHERE node_id = ? AND projet_id = ? AND locked_by_id = ?', [unlockId, req.params.name, user.id]);
                broadcastToProject(req.params.name, 'unlock', { nodeId: unlockId, projetId: req.params.name, userId: user.id });
                await broadcastPresence(req.params.name, unlockId);
            } catch (e2) {
                console.error('[LOCK] unlock on publish error:', e2.message);
            }

            if (backupType !== 'ftp' && publishResult?.pushFailed) {
                return res.status(502).json({
                    error: 'Modifications sauvegardées localement mais non synchronisées avec GitHub',
                    localSaved: true,
                    pushFailed: true,
                    commitHash: publishCommitHash,
                    versionId
                });
            }
        }

        res.json({ success: true, checkpointed: true, versionId, commitHash: publishCommitHash, ftpUploaded: ftpPublishResult?.uploaded ?? null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Brouillon local par utilisateur (jamais partagé, jamais dans projet_content_version) ──

// GET /api/file-projects/:name/drafts — liste légère des brouillons de l'utilisateur courant sur ce projet
app.get('/api/file-projects/:name/drafts', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT node_id, folder_id, updated_at FROM projet_local_draft WHERE project_id = ? AND user_id = ?`,
            [req.params.name, user.id]
        );
        res.json(rows.map(r => ({ nodeId: r.node_id, folderId: r.folder_id, updatedAt: r.updated_at })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/file-projects/:name/files/:id/draft — contenu complet du brouillon de l'utilisateur courant
app.get('/api/file-projects/:name/files/:id/draft', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT folder_id, content, base_version_id, updated_at FROM projet_local_draft
             WHERE project_id = ? AND node_id = ? AND user_id = ?`,
            [req.params.name, req.params.id, user.id]
        );
        if (!rows.length) return res.json({ exists: false });
        const r = rows[0];
        res.json({ exists: true, folderId: r.folder_id, content: r.content, baseVersionId: r.base_version_id, updatedAt: r.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/file-projects/:name/files/:id/draft — écrit/écrase le brouillon de l'utilisateur courant.
// N'écrit jamais projet_content_version ni le disque : c'est une zone de travail
// strictement privée, indépendante de la publication et de la structure config.json.
app.put('/api/file-projects/:name/files/:id/draft', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const content = req.body.content ?? '';
        const folderId = req.body.folderId || null;
        const baseVersionId = req.body.baseVersionId || null;
        await pool.query(
            `INSERT INTO projet_local_draft (project_id, node_id, user_id, folder_id, content, base_version_id)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE folder_id = VALUES(folder_id), content = VALUES(content),
                 base_version_id = VALUES(base_version_id), updated_at = CURRENT_TIMESTAMP(3)`,
            [req.params.name, req.params.id, user.id, folderId, content, baseVersionId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/file-projects/:name/files/:id/draft — supprime le brouillon de l'utilisateur courant
// (après validation réussie via "Enregistrer et partager", ou annulation explicite).
app.delete('/api/file-projects/:name/files/:id/draft', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        await pool.query(
            `DELETE FROM projet_local_draft WHERE project_id = ? AND node_id = ? AND user_id = ?`,
            [req.params.name, req.params.id, user.id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Versions de contenu (zone Historique + fusion de conflit) ──────────────

// GET /api/file-projects/:name/files/:id/versions?limit=&offset= — liste paginée sans le contenu complet
app.get('/api/file-projects/:name/files/:id/versions', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    try {
        const [rows] = await pool.query(
            `SELECT version_id, author_id, author_name, origin, content_hash, base_version_id, merged_from_version_id, created_at
             FROM projet_content_version WHERE project_id = ? AND node_id = ?
             ORDER BY id DESC LIMIT ? OFFSET ?`,
            [req.params.name, req.params.id, limit, offset]
        );
        res.json({ versions: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/file-projects/:name/files/:id/versions/:versionId — contenu complet d'une version
app.get('/api/file-projects/:name/files/:id/versions/:versionId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT version_id, content, author_id, author_name, origin, base_version_id, merged_from_version_id, created_at
             FROM projet_content_version WHERE project_id = ? AND node_id = ? AND version_id = ? LIMIT 1`,
            [req.params.name, req.params.id, req.params.versionId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Version introuvable' });
        res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/file-projects/:name/files/:id/restore — {versionId, folderId}
// Ne supprime jamais rien : restaurer insère une NOUVELLE version avec l'ancien contenu.
app.post('/api/file-projects/:name/files/:id/restore', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'file') return res.status(404).json({ error: 'Fichier non trouvé' });
    const { versionId, folderId } = req.body || {};
    if (!versionId) return res.status(400).json({ error: 'versionId requis' });
    try {
        const [rows] = await pool.query(
            `SELECT content FROM projet_content_version WHERE project_id = ? AND node_id = ? AND version_id = ? LIMIT 1`,
            [req.params.name, req.params.id, versionId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Version à restaurer introuvable' });
        const latest = await getLatestVersion(pool, req.params.name, req.params.id);
        const inserted = await insertContentVersion(pool, {
            projectId: req.params.name, nodeId: req.params.id, filePath: item.path,
            content: rows[0].content, baseVersionId: latest?.version_id ?? null, mergedFromVersionId: versionId,
            origin: 'restore', authorId: user.id, authorName: user.username || user.email || 'Utilisateur'
        });

        try {
            const full = safeProjectPath(req.params.name, item.path);
            if (full) { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, rows[0].content, 'utf8'); }
        } catch (diskErr) { console.warn('[BACKUP] écriture disque échouée (restore):', diskErr.message); }

        broadcastToProject(req.params.name, 'version_saved', {
            nodeId: req.params.id, folderId: folderId || null, versionId: inserted.versionId,
            authorId: user.id, authorName: user.username || user.email || 'Utilisateur',
            timestamp: new Date().toISOString(), origin: 'restore'
        });
        res.json({ success: true, versionId: inserted.versionId, content: rows[0].content });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/file-projects/:name/files/:id/resolve-conflict — {baseVersionId, folderId, mineContent, mergedContent}
// Insère 2 versions : la tentative écartée (préservée dans l'historique) puis la fusion retenue.
app.post('/api/file-projects/:name/files/:id/resolve-conflict', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'file') return res.status(404).json({ error: 'Fichier non trouvé' });
    const { baseVersionId, folderId, mineContent, mergedContent } = req.body || {};
    if (mergedContent == null) return res.status(400).json({ error: 'mergedContent requis' });
    try {
        const latest = await getLatestVersion(pool, req.params.name, req.params.id);

        const conflictMine = await insertContentVersion(pool, {
            projectId: req.params.name, nodeId: req.params.id, filePath: item.path,
            content: mineContent ?? '', baseVersionId: baseVersionId || null, mergedFromVersionId: null,
            origin: 'conflict-mine', authorId: user.id, authorName: user.username || user.email || 'Utilisateur'
        });

        const merged = await insertContentVersion(pool, {
            projectId: req.params.name, nodeId: req.params.id, filePath: item.path,
            content: mergedContent, baseVersionId: latest?.version_id ?? null, mergedFromVersionId: conflictMine.versionId,
            origin: 'merge', authorId: user.id, authorName: user.username || user.email || 'Utilisateur'
        });

        try {
            const full = safeProjectPath(req.params.name, item.path);
            if (full) { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, mergedContent, 'utf8'); }
        } catch (diskErr) { console.warn('[BACKUP] écriture disque échouée (resolve-conflict):', diskErr.message); }

        broadcastToProject(req.params.name, 'version_saved', {
            nodeId: req.params.id, folderId: folderId || null, versionId: merged.versionId,
            authorId: user.id, authorName: user.username || user.email || 'Utilisateur',
            timestamp: new Date().toISOString(), origin: 'merge'
        });
        broadcastToProject(req.params.name, 'content_update', {
            nodeId: req.params.id, folderId: folderId || null, content: mergedContent,
            updatedBy: user.id, updatedByName: user.username || user.email || 'Utilisateur',
            timestamp: new Date().toISOString()
        });

        res.json({ success: true, versionId: merged.versionId, conflictMineVersionId: conflictMine.versionId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Réglages plateforme (Admin) ─────────────────────────────────────────────

// GET /api/admin/platform-settings — lecture ouverte à tout user connecté
// (nécessaire pour masquer côté UI les options FTP si désactivées globalement)
app.get('/api/admin/platform-settings', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const ftpSyncEnabled = await getPlatformSetting('ftpSyncEnabled', false);
        res.json({ ftpSyncEnabled });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/platform-settings — modification réservée aux administrateurs
app.put('/api/admin/platform-settings', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Réservé aux administrateurs' });
    try {
        const { ftpSyncEnabled } = req.body || {};
        if (ftpSyncEnabled !== undefined) await setPlatformSetting('ftpSyncEnabled', Boolean(ftpSyncEnabled));
        res.json({ success: true, ftpSyncEnabled: await getPlatformSetting('ftpSyncEnabled', false) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/projects/:name/files/:id (rename)
app.patch('/api/file-projects/:name/files/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'file') return res.status(404).json({ error: 'Fichier non trouvé' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    try {
        const imageExtRe = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
        const isImage = imageExtRe.test(item.name);
        let newName;
        if (isImage) {
            const ext = path.extname(item.name);
            newName = imageExtRe.test(name) ? name : name + ext;
        } else {
            newName = name.endsWith('.md') ? name : `${name}.md`;
        }
        
        // Vérifier si un autre fichier porte déjà ce nom dans le même parent
        // (Simplification: on cherche dans toute la structure car on n'a pas facilement le parent ici, 
        // mais findNodeById pourrait être adapté ou on pourrait chercher le parent d'abord)
        
        const oldFull = safeProjectPath(req.params.name, item.path);
        const newPath = item.path.replace(/[^/\\]+$/, newName);
        const newFull = safeProjectPath(req.params.name, newPath);
        if (!oldFull || !newFull) return res.status(400).json({ error: 'Chemin invalide' });
        if (fs.existsSync(oldFull)) fs.renameSync(oldFull, newFull);
        item.name = newName; item.path = newPath;
        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `rename_file ${newName}`)
            .catch(gitErr => console.warn('[ProjetGit] commit rename_file:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', { operation: 'rename_file', payload: item, updatedBy: user.id });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:name/files/:id
app.delete('/api/file-projects/:name/files/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'file') return res.status(404).json({ error: 'Fichier non trouvé' });
    try {
        const originalParentId = findParentId(config.structure, req.params.id) ?? null;
        const trashId = await moveNodeToTrash(req.params.name, item, originalParentId, user);
        const deletedName = item.name;
        removeNodeById(config.structure, req.params.id);
        await saveProjectConfig(req.params.name, config);
        try {
            if ((await ftpService.getBackupType(pool, req.params.name).catch(() => null)) !== 'ftp') {
                await ensureGithubRemoteForProject(req.params.name, config);
            }
        } catch (gitErr) { console.warn('[ProjetGit] ensureGithubRemoteForProject (delete_file):', gitErr.message); }
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `delete_file ${deletedName}`)
            .catch(gitErr => console.warn('[ProjetGit] commit delete_file:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', { operation: 'delete_file', payload: { id: req.params.id }, trashId, updatedBy: user.id });
        res.json({ success: true, trashId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:name/folders
app.post('/api/file-projects/:name/folders', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const { name, parentId, outilSlug } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    try {
        const slug = slugify(name) || name.replace(/\s+/g, '-').toLowerCase();
        let folderPath;
        let parentItems = config.structure;
        if (parentId) {
            const parent = findNodeById(config.structure, parentId);
            if (!parent || parent.type !== 'folder') return res.status(400).json({ error: 'Dossier parent invalide' });
            folderPath = `${parent.path}/${slug}`;
            parent.children = parent.children || [];
            parentItems = parent.children;
        } else if (outilSlug && /^[a-z0-9-]+$/.test(outilSlug)) {
            const outilDir = safeProjectPath(req.params.name, outilSlug);
            if (outilDir) fs.mkdirSync(outilDir, { recursive: true });
            folderPath = `${outilSlug}/${slug}`;
        } else {
            folderPath = slug;
        }

        // Éviter les doublons
        const existing = parentItems.find(i => i.type === 'folder' && (i.name.toLowerCase() === name.toLowerCase() || i.path === folderPath));
        if (existing) {
            return res.status(200).json(existing);
        }

        const full = safeProjectPath(req.params.name, folderPath);
        if (!full) return res.status(400).json({ error: 'Chemin invalide' });
        fs.mkdirSync(full, { recursive: true });
        const contentPath = `${folderPath}/contenu.md`;
        const contentFileId = crypto.randomUUID();
        try { fs.writeFileSync(safeProjectPath(req.params.name, contentPath), '', 'utf8'); }
        catch (diskErr) { console.warn('[BACKUP] écriture disque échouée (create folder contenu.md):', diskErr.message); }
        const newFolder = {
            id: crypto.randomUUID(), type: 'folder', name, path: folderPath, order: parentItems.length + 1,
            children: [{ id: contentFileId, type: 'file', name: 'contenu.md', path: contentPath, order: 1 }]
        };
        parentItems.push(newFolder);
        // Pas de checkpoint BDD automatique à la création : attachContent() bootstrape depuis le
        // disque (contenu vide, origin migration-bootstrap) à la première lecture si nécessaire —
        // sinon ce checkpoint vide prématuré écraserait visuellement le brouillon local au premier
        // rechargement structurel qui suit (ex: ajout d'un titre pendant la frappe).

        // Si dossier racine avec outilSlug → ajouter à rootFolderIds de l'outil correspondant
        if (!parentId && outilSlug) {
            const outil = (config.outils || []).find(o => o.type === outilSlug);
            if (outil && !(outil.rootFolderIds || []).includes(newFolder.id)) {
                outil.rootFolderIds = [...(outil.rootFolderIds || []), newFolder.id];
            }
        }

        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `create_folder ${name}`)
            .catch(gitErr => console.warn('[ProjetGit] commit create_folder:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', { operation: 'create_folder', payload: { ...newFolder, parentId: parentId || null }, updatedBy: user.id });
        res.status(201).json(newFolder);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/projects/:name/folders/:id (rename)
app.patch('/api/file-projects/:name/folders/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'folder') return res.status(404).json({ error: 'Dossier non trouvé' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    try {
        const newSlug = slugify(name) || name.replace(/\s+/g, '-').toLowerCase();
        const oldPath = item.path;
        const newPath = oldPath.includes('/') ? oldPath.replace(/[^/]+$/, newSlug) : newSlug;
        const oldFull = safeProjectPath(req.params.name, oldPath);
        const newFull = safeProjectPath(req.params.name, newPath);
        if (!oldFull || !newFull) return res.status(400).json({ error: 'Chemin invalide' });
        
        // Si le nouveau chemin existe déjà et que c'est un autre ID, on a un conflit
        // Mais si c'est le même ID, c'est juste un renommage qui peut être déjà fait sur disque
        if (oldFull !== newFull && fs.existsSync(oldFull)) {
            fs.renameSync(oldFull, newFull);
        } else if (!fs.existsSync(newFull)) {
             fs.mkdirSync(newFull, { recursive: true });
        }

        function updateNodePaths(node, from, to) {
            node.path = node.path.startsWith(from + '/') ? to + node.path.slice(from.length) : (node.path === from ? to : node.path);
            if (node.children) node.children.forEach(c => updateNodePaths(c, from, to));
        }
        updateNodePaths(item, oldPath, newPath);
        item.name = name;
        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `rename_folder ${name}`)
            .catch(gitErr => console.warn('[ProjetGit] commit rename_folder:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', { operation: 'rename_folder', payload: { id: req.params.id, name, oldPath, newPath }, updatedBy: user.id });
        res.json(item);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:name/folders/:id
app.delete('/api/file-projects/:name/folders/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const item = findNodeById(config.structure, req.params.id);
    if (!item || item.type !== 'folder') return res.status(404).json({ error: 'Dossier non trouvé' });
    try {
        const originalParentId = findParentId(config.structure, req.params.id) ?? null;
        const trashId = await moveNodeToTrash(req.params.name, item, originalParentId, user);
        const deletedName = item.name;
        removeNodeById(config.structure, req.params.id);
        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `delete_folder ${deletedName}`)
            .catch(gitErr => console.warn('[ProjetGit] commit delete_folder:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', { operation: 'delete_folder', payload: { id: req.params.id }, trashId, updatedBy: user.id });
        res.json({ success: true, trashId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/file-projects/:name/trash — entrées actives de la corbeille (ni restaurées, ni purgées)
app.get('/api/file-projects/:name/trash', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT id, node_id, node_type, name, original_path, original_parent_id, deleted_by_id, deleted_by_name, deleted_at, purge_at
             FROM projet_trash_entry
             WHERE project_id = ? AND restored_at IS NULL AND purged_at IS NULL
             ORDER BY deleted_at DESC`,
            [req.params.name]
        );
        res.json(rows.map(r => ({
            trashId: r.id, nodeId: r.node_id, nodeType: r.node_type, name: r.name,
            originalPath: r.original_path, originalParentId: r.original_parent_id,
            deletedById: r.deleted_by_id, deletedByName: r.deleted_by_name,
            deletedAt: r.deleted_at, purgeAt: r.purge_at
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/file-projects/:name/trash/:trashId/restore
// Réinsère le noeud (et son contenu physique) à son emplacement d'origine. Sert
// aussi de undoAction générique pour wo-action-history (voir POST /api/wo-action-history/:id/undo) :
// le dispatcher fait un simple self-fetch POST sans payload, donc aucune adaptation
// n'est nécessaire côté dispatcher.
app.post('/api/file-projects/:name/trash/:trashId/restore', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT * FROM projet_trash_entry WHERE id = ? AND project_id = ? LIMIT 1`,
            [req.params.trashId, req.params.name]
        );
        const entry = rows[0];
        if (!entry) return res.status(404).json({ error: 'Entrée de corbeille introuvable' });
        if (entry.restored_at) return res.status(400).json({ error: 'Déjà restauré' });
        if (entry.purged_at) return res.status(400).json({ error: 'Déjà purgé définitivement' });

        const config = await getProjectConfig(req.params.name);
        if (!config) return res.status(404).json({ error: 'Projet non trouvé' });

        const snapshot = typeof entry.structure_snapshot === 'string' ? JSON.parse(entry.structure_snapshot) : entry.structure_snapshot;

        const trashFull = safeProjectPath(req.params.name, entry.trash_disk_path);
        const targetFull = safeProjectPath(req.params.name, entry.original_path);
        const nameCollisionOnDisk = !!(targetFull && fs.existsSync(targetFull));
        if (trashFull && targetFull && !nameCollisionOnDisk && fs.existsSync(trashFull)) {
            fs.mkdirSync(path.dirname(targetFull), { recursive: true });
            fs.renameSync(trashFull, targetFull);
            removeEmptyTrashParentDir(trashFull);
        }

        // Réinsertion dans la structure : au dossier parent d'origine s'il existe encore, sinon à la racine
        let targetList = config.structure;
        let warning = null;
        if (entry.original_parent_id) {
            const parent = findNodeById(config.structure, entry.original_parent_id);
            if (parent && parent.type === 'folder') {
                parent.children = parent.children || [];
                targetList = parent.children;
            } else {
                warning = "Dossier parent d'origine introuvable — restauré à la racine du projet";
            }
        }
        if (targetList.some(n => n.name.toLowerCase() === snapshot.name.toLowerCase())) {
            warning = (warning ? warning + ' ; ' : '') + 'Un élément du même nom existe déjà à cet emplacement';
        }
        targetList.push(snapshot);

        await saveProjectConfig(req.params.name, config);
        await pool.query(
            `UPDATE projet_trash_entry SET restored_at = NOW(), restored_by_id = ? WHERE id = ?`,
            [user.id, req.params.trashId]
        );
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `restore_from_trash ${snapshot.name}`)
            .catch(gitErr => console.warn('[ProjetGit] commit restore_from_trash:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', {
            operation: entry.node_type === 'folder' ? 'restore_folder' : 'restore_file',
            payload: { ...snapshot, parentId: entry.original_parent_id || null },
            updatedBy: user.id
        });
        res.json({ success: true, node: snapshot, warning });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/file-projects/:name/trash/:trashId — purge définitive volontaire (avant l'échéance des 30 jours)
app.delete('/api/file-projects/:name/trash/:trashId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            `SELECT * FROM projet_trash_entry WHERE id = ? AND project_id = ? LIMIT 1`,
            [req.params.trashId, req.params.name]
        );
        const entry = rows[0];
        if (!entry) return res.status(404).json({ error: 'Entrée de corbeille introuvable' });
        if (entry.restored_at) return res.status(400).json({ error: 'Déjà restauré' });
        const trashFull = safeProjectPath(req.params.name, entry.trash_disk_path);
        if (trashFull && fs.existsSync(trashFull)) {
            fs.rmSync(trashFull, { recursive: true, force: true });
            removeEmptyTrashParentDir(trashFull);
        }
        await pool.query(`UPDATE projet_trash_entry SET purged_at = NOW() WHERE id = ?`, [req.params.trashId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/projects/:name/structure
app.put('/api/file-projects/:name/structure', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    try {
        config.structure = req.body.structure;
        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), 'reorder')
            .catch(gitErr => console.warn('[ProjetGit] commit reorder:', gitErr.message));
        broadcastToProject(req.params.name, 'structure_update', { operation: 'reorder', payload: { structure: req.body.structure }, updatedBy: user.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:name/move-file
app.post('/api/file-projects/:name/move-file', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const { fileId, targetFolderId } = req.body;
    try {
        const item = findNodeById(config.structure, fileId);
        if (!item) return res.status(404).json({ error: 'Élément non trouvé' });
        removeNodeById(config.structure, fileId);
        const oldFull = safeProjectPath(req.params.name, item.path);
        if (targetFolderId) {
            const target = findNodeById(config.structure, targetFolderId);
            if (!target) return res.status(404).json({ error: 'Dossier cible non trouvé' });
            if (target.type !== 'folder') return res.status(400).json({ error: 'La cible doit être un dossier' });

            // Éviter les doublons de nom dans le dossier cible
            if ((target.children || []).some(c => c.type === 'file' && c.name.toLowerCase() === item.name.toLowerCase())) {
                return res.status(400).json({ error: `Un fichier nommé "${item.name}" existe déjà dans le dossier cible` });
            }

            const newPath = `${target.path}/${item.name}`;
            const newFull = safeProjectPath(req.params.name, newPath);
            if (oldFull && newFull && fs.existsSync(oldFull)) {
                fs.mkdirSync(path.dirname(newFull), { recursive: true });
                fs.renameSync(oldFull, newFull);
            }
            item.path = newPath;
            target.children = target.children || [];
            target.children.push(item);
        } else {
            const newPath = item.name;
            const newFull = safeProjectPath(req.params.name, newPath);
            if (oldFull && newFull && fs.existsSync(oldFull)) {
                fs.mkdirSync(path.dirname(newFull), { recursive: true });
                fs.renameSync(oldFull, newFull);
            }
            item.path = newPath;
            config.structure.push(item);
        }
        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `move_file ${item.name}`)
            .catch(gitErr => console.warn('[ProjetGit] commit move_file:', gitErr.message));
        res.json({ success: true, item });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/file-projects/:name/upload-image
app.post('/api/file-projects/:name/upload-image', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const { name: fileName, parentId, data, mimeType } = req.body;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
    if (!allowedTypes.includes(mimeType)) return res.status(400).json({ error: 'Type non autorisé (jpg, png, gif, webp, svg uniquement)' });
    try {
        const buffer = Buffer.from(data, 'base64');
        if (buffer.length > 1024 * 1024) return res.status(400).json({ error: 'Fichier trop grand — maximum 1 Mo' });
        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };
        const ext = extMap[mimeType] || 'jpg';
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') + '.' + ext;
        let parentItems = config.structure;
        let parentPath = '';
        if (parentId) {
            const parent = findNodeById(config.structure, parentId);
            if (!parent || parent.type !== 'folder') return res.status(400).json({ error: 'Dossier parent invalide' });
            parentPath = parent.path;
            parentItems = parent.children = parent.children || [];
        }
        // Générer un nom unique si un fichier du même nom existe déjà dans ce dossier
        const dotIdx = safeName.lastIndexOf('.');
        const baseName = dotIdx !== -1 ? safeName.substring(0, dotIdx) : safeName;
        const extPart = dotIdx !== -1 ? safeName.substring(dotIdx) : '';
        let uniqueName = safeName;
        let counter = 1;
        while (parentItems.some(n => n.type === 'file' && n.name.toLowerCase() === uniqueName.toLowerCase())) {
            uniqueName = `${baseName}-${counter}${extPart}`;
            counter++;
        }
        const filePath = parentPath ? `${parentPath}/${uniqueName}` : uniqueName;
        const fullPath = safeProjectPath(req.params.name, filePath);
        if (!fullPath) return res.status(400).json({ error: 'Chemin invalide' });
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, buffer);
        const maxOrder = parentItems.filter(n => n.type === 'file').reduce((m, n) => Math.max(m, n.order || 0), 0);
        const newNode = { id: require('crypto').randomUUID(), type: 'file', name: uniqueName, path: filePath, order: maxOrder + 1, fileType: 'image' };
        parentItems.push(newNode);
        await saveProjectConfig(req.params.name, config);
        try {
            if ((await ftpService.getBackupType(pool, req.params.name).catch(() => null)) !== 'ftp') {
                await ensureGithubRemoteForProject(req.params.name, config);
            }
        } catch (gitErr) { console.warn('[ProjetGit] ensureGithubRemoteForProject (upload_image):', gitErr.message); }
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `upload_image ${uniqueName}`)
            .catch(gitErr => console.warn('[ProjetGit] commit upload_image:', gitErr.message));
        // Notifier les autres users connectés pour déclencher leur auto-pull
        broadcastToProject(req.params.name, 'structure_update', { operation: 'upload_image', payload: newNode, updatedBy: user.id });
        res.status(201).json(newNode);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/file-projects/:name/move-folder
app.post('/api/file-projects/:name/move-folder', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const { folderId, targetParentId } = req.body;
    try {
        const folder = findNodeById(config.structure, folderId);
        if (!folder || folder.type !== 'folder') return res.status(404).json({ error: 'Dossier non trouvé' });

        // Prevent moving into itself or its own descendants
        if (targetParentId === folderId) return res.status(400).json({ error: 'Déplacement invalide' });
        const isDesc = (node, id) => !!(node.children || []).some(c => c.id === id || isDesc(c, id));
        if (targetParentId && isDesc(folder, targetParentId)) return res.status(400).json({ error: 'Le dossier cible est un descendant' });

        const oldPath = folder.path;
        const originalName = folder.name;
        const oldFull = safeProjectPath(req.params.name, oldPath);

        // No-op: folder is already in the target parent → return success immediately
        // Comparer le chemin parent actuel (tout sauf le dernier segment) avec le chemin cible
        const oldParentPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : null;
        const potentialTarget = targetParentId ? findNodeById(config.structure, targetParentId) : null;
        const potentialTargetPath = potentialTarget ? potentialTarget.path : null;
        if (potentialTargetPath === oldParentPath || (!targetParentId && oldParentPath === null)) {
            return res.json({ success: true });
        }

        // Remove from current position in JSON
        removeNodeById(config.structure, folderId);

        // Determine new path and insertion point
        let newPath;
        let targetItems;
        // Génère un nom unique en suffixant (2), (3)… si un homonyme existe déjà dans le niveau cible.
        function uniqueFolderName(siblings, baseName) {
            const taken = new Set((siblings || []).filter(c => c.type === 'folder').map(c => c.name.toLowerCase()));
            if (!taken.has(baseName.toLowerCase())) return baseName;
            let n = 2;
            while (taken.has(`${baseName} (${n})`.toLowerCase())) n++;
            return `${baseName} (${n})`;
        }

        let finalName = folder.name;
        if (targetParentId) {
            const target = findNodeById(config.structure, targetParentId);
            if (!target || target.type !== 'folder') return res.status(400).json({ error: 'Dossier cible invalide' });

            finalName = uniqueFolderName(target.children, folder.name);
            newPath = target.path + '/' + finalName;
            target.children = target.children || [];
            targetItems = target.children;
        } else {
            finalName = uniqueFolderName(config.structure, folder.name);
            newPath = finalName;
            targetItems = config.structure;
        }

        // Renommer le nœud si le nom a été suffixé pour éviter un conflit
        if (finalName !== folder.name) folder.name = finalName;

        // Move on filesystem — robuste : ne jamais faire échouer le déplacement à cause du FS.
        // Si rename échoue (collision disque, EXDEV, EPERM, EBUSY…), on bascule sur copie+suppression.
        // En dernier recours, on conserve quand même la mise à jour de la structure JSON.
        let newFull = safeProjectPath(req.params.name, newPath);
        let fsMoveWarning = null;
        if (oldFull && newFull && oldFull !== newFull && fs.existsSync(oldFull)) {
            try {
                fs.mkdirSync(path.dirname(newFull), { recursive: true });
                // Si la cible disque existe déjà (orphelin non listé dans le JSON), suffixer le chemin disque
                if (fs.existsSync(newFull)) {
                    let suffix = 2;
                    let candidate;
                    do { candidate = `${newFull}-${suffix++}`; } while (fs.existsSync(candidate));
                    newFull = candidate;
                    newPath = `${newPath}-${suffix - 1}`;
                }
                try {
                    fs.renameSync(oldFull, newFull);
                } catch (renameErr) {
                    // Fallback : copie récursive puis suppression de la source
                    fs.cpSync(oldFull, newFull, { recursive: true });
                    fs.rmSync(oldFull, { recursive: true, force: true });
                }
            } catch (fsErr) {
                // Échec total du FS : on garde la mise à jour JSON et on signale l'avertissement
                fsMoveWarning = fsErr.message;
                console.warn('[move-folder] FS move failed, JSON-only update:', fsErr.message);
            }
        }

        // Update paths recursively inside the moved folder node
        function updatePaths(node, oldBase, newBase) {
            if (node.path === oldBase) node.path = newBase;
            else if (node.path && node.path.startsWith(oldBase + '/')) node.path = newBase + node.path.slice(oldBase.length);
            (node.children || []).forEach(c => updatePaths(c, oldBase, newBase));
        }
        updatePaths(folder, oldPath, newPath);

        // Set order at end of target level
        const maxOrder = targetItems.filter(n => n.type === 'folder').reduce((m, n) => Math.max(m, n.order || 0), 0);
        folder.order = maxOrder + 1;
        targetItems.push(folder);

        await saveProjectConfig(req.params.name, config);
        projetGit.commitOnMain(path.join(PROJECTS_DIR, req.params.name), `move_folder ${folder.name}`)
            .catch(gitErr => console.warn('[ProjetGit] commit move_folder:', gitErr.message));

        // Notifier les autres collaborateurs du changement de structure
        const sessionUser = getSessionUser(req);
        broadcastToProject(req.params.name, 'structure_update', {
            type: 'move',
            folderId,
            targetParentId: targetParentId || null,
            renamedTo: finalName !== originalName ? finalName : undefined,
            updatedBy: sessionUser?.id,
            updatedByName: sessionUser?.username
        });

        res.json({
            success: true,
            renamedTo: finalName !== originalName ? finalName : undefined,
            fsWarning: fsMoveWarning || undefined
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// Outils par projet (Edition, Tests, Code…)
// ============================================================

// GET /api/file-projects/:name/outils
app.get('/api/file-projects/:name/outils', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    // Persister la migration si outils vient d'être créé (pas encore en BDD/fichier)
    if (config.outils && config.outils.length > 0) {
        await saveProjectConfig(req.params.name, config).catch(() => {});
    }
    res.json({ outils: config.outils || [] });
});

// POST /api/file-projects/:name/outils
app.post('/api/file-projects/:name/outils', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const { type = 'edition', name, rootFolderIds = [] } = req.body;
    const newOutil = {
        id: require('crypto').randomUUID(),
        type,
        name: name || 'Edition',
        rootFolderIds,
        createdAt: new Date().toISOString()
    };
    config.outils = [...(config.outils || []), newOutil];
    await saveProjectConfig(req.params.name, config);
    res.status(201).json(newOutil);
});

// PATCH /api/file-projects/:name/outils/:outilId
app.patch('/api/file-projects/:name/outils/:outilId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    const outil = (config.outils || []).find(o => o.id === req.params.outilId);
    if (!outil) return res.status(404).json({ error: 'Outil non trouvé' });
    if (req.body.name !== undefined) outil.name = req.body.name;
    if (req.body.rootFolderIds !== undefined) outil.rootFolderIds = req.body.rootFolderIds;
    await saveProjectConfig(req.params.name, config);
    res.json(outil);
});

// DELETE /api/file-projects/:name/outils/:outilId
app.delete('/api/file-projects/:name/outils/:outilId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    config.outils = (config.outils || []).filter(o => o.id !== req.params.outilId);
    await saveProjectConfig(req.params.name, config);
    res.json({ success: true });
});

// ============================================================
// Agenda par projet
// ============================================================

const agendaDir = (name) => path.join(PROJECTS_DIR, name, 'agenda');

// GET /api/file-projects/:name/agenda
app.get('/api/file-projects/:name/agenda', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const dir = agendaDir(req.params.name);
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const events = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    res.json(events);
});

// POST /api/file-projects/:name/agenda
app.post('/api/file-projects/:name/agenda', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const dir = agendaDir(req.params.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const event = { id: crypto.randomUUID(), ...req.body };
    fs.writeFileSync(path.join(dir, `${event.id}.json`), JSON.stringify(event, null, 2));
    res.json(event);
});

// PATCH /api/file-projects/:name/agenda/:id
app.patch('/api/file-projects/:name/agenda/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const file = path.join(agendaDir(req.params.name), `${req.params.id}.json`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Événement non trouvé' });
    const event = { ...JSON.parse(fs.readFileSync(file, 'utf8')), ...req.body };
    fs.writeFileSync(file, JSON.stringify(event, null, 2));
    res.json(event);
});

// DELETE /api/file-projects/:name/agenda/group/:groupId — Supprime tous les événements d'un même groupe
app.delete('/api/file-projects/:name/agenda/group/:groupId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const dir = agendaDir(req.params.name);
    if (!fs.existsSync(dir)) return res.json({ deleted: 0 });
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    let deleted = 0;
    for (const f of files) {
        try {
            const event = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            if (event.groupId === req.params.groupId) {
                fs.unlinkSync(path.join(dir, f));
                deleted++;
            }
        } catch { /* fichier corrompu, on skip */ }
    }
    res.json({ deleted });
});

// DELETE /api/file-projects/:name/agenda/:id
app.delete('/api/file-projects/:name/agenda/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const file = path.join(agendaDir(req.params.name), `${req.params.id}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ success: true });
});

// ============================================================
// Git par projet : sync, pull, status
// ============================================================

// GET /api/file-projects/:name/sync-status
//   Retourne l'état git du projet : repo existant, commits ahead/behind par rapport au remote
app.get('/api/file-projects/:name/sync-status', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    if (!fs.existsSync(projetPath)) return res.status(404).json({ error: 'Projet non trouvé' });
    try {
        const status = projetGit.getSyncStatus(projetPath);
        res.json({ success: true, ...status });
    } catch (e) {
        console.warn('[ProjetGit] sync-status error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/pull
//   Effectue git pull --ff-only sur main. Retourne le nombre de commits récupérés
//   et la liste des fichiers modifiés (utile pour invalider le cache Angular).
app.post('/api/file-projects/:name/pull', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    if (!fs.existsSync(projetPath)) return res.status(404).json({ error: 'Projet non trouvé' });
    try {
        const result = projetGit.pullMain(projetPath);
        if (!result.success && !result.skipped) {
            return res.status(409).json({ error: result.error || 'Pull impossible', ...result });
        }
        if (result.success && result.newCommits > 0) {
            // Re-synchroniser la BDD (source de vérité) avec les fichiers modifiés par le pull GitHub,
            // sinon la prochaine lecture attachContent() écraserait le contenu tout juste tiré (stale DB).
            try {
                const config = await getProjectConfig(req.params.name);
                for (const relPath of result.changedFiles || []) {
                    const node = findNodeByPath(config?.structure || [], relPath);
                    if (!node || node.type !== 'file') continue;
                    const full = safeProjectPath(req.params.name, relPath);
                    if (!full || !fs.existsSync(full)) continue;
                    const pulledContent = fs.readFileSync(full, 'utf8');
                    const latest = await getLatestVersion(pool, req.params.name, node.id);
                    if (latest && latest.content === pulledContent) continue;
                    await insertContentVersion(pool, {
                        projectId: req.params.name, nodeId: node.id, filePath: relPath,
                        content: pulledContent, baseVersionId: latest?.version_id ?? null, mergedFromVersionId: null,
                        origin: 'pull', authorId: user.id, authorName: user.username || user.email || 'Utilisateur'
                    });
                }
            } catch (syncErr) {
                console.warn('[VERSION] resync post-pull échoué:', syncErr.message);
            }
            // Notifier les autres clients qu'une sync a eu lieu (utile pour multi-onglets)
            broadcastToProject(req.params.name, 'project_synced', {
                pulledBy: { userId: user.id, username: user.username || user.email },
                newCommits: result.newCommits,
                changedFiles: result.changedFiles,
                timestamp: new Date().toISOString()
            });
        }
        res.json({ success: true, ...result });
    } catch (e) {
        console.warn('[ProjetGit] pull error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/open-folder
//   Ouvre l'explorateur Windows sur le dossier local du projet.
app.post('/api/file-projects/:name/open-folder', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    if (!fs.existsSync(projetPath)) return res.status(404).json({ error: 'Dossier non trouvé' });
    try {
        const { exec } = require('child_process');
        const safe = projetPath.replace(/"/g, '\\"');
        exec(`explorer "${safe}"`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/auto-sync
//   Synchronise automatiquement le projet avec GitHub au chargement :
//   pull si remote en avance, push si local en avance, signale la divergence sinon.
//   Pour les projets FTP : pas de sync automatique (le sync se fait au Partager).
app.post('/api/file-projects/:name/auto-sync', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    if (!fs.existsSync(projetPath)) return res.status(404).json({ error: 'Projet non trouvé' });

    // Projets FTP : pas de sync automatique au chargement
    try {
        const backupType = await ftpService.getBackupType(pool, req.params.name);
        if (backupType === 'ftp') {
            return res.json({ success: true, status: 'ftp-no-sync' });
        }
    } catch (e) {
        console.warn('[auto-sync] backup_type lookup error:', e.message);
    }

    if (!projetGit.isRepo(projetPath)) return res.json({ success: true, status: 'no-repo' });
    if (!projetGit.hasRemote(projetPath)) return res.json({ success: true, status: 'no-remote' });
    try {
        const status = projetGit.getSyncStatus(projetPath);
        let action = 'in-sync';
        let opResult = null;
        if (!status.fetchOk) {
            return res.json({ success: false, status: 'fetch-failed', ...status });
        }
        if (status.behind > 0 && status.ahead === 0) {
            opResult = projetGit.pullMain(projetPath);
            action = opResult.success ? 'pulled' : 'pull-failed';
        } else if (status.ahead > 0 && status.behind === 0) {
            opResult = projetGit.pushMain(projetPath);
            action = opResult.success ? 'pushed' : 'push-failed';
        } else if (status.ahead > 0 && status.behind > 0) {
            action = 'diverged';
        }
        if (opResult && !opResult.success && !opResult.skipped) {
            return res.status(409).json({ error: opResult.error || 'Synchronisation impossible', status: action, ...status });
        }
        res.json({ success: true, status: action, ahead: status.ahead, behind: status.behind, ...(opResult || {}) });
    } catch (e) {
        console.warn('[AutoSync] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// GET /api/github/reachable
//   Vérifie si github.com est accessible depuis le serveur.
//   Utilisé par le frontend pour afficher un indicateur de connectivité par projet.
app.get('/api/github/reachable', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    if (!githubService.isEnabled()) return res.json({ reachable: false, reason: 'not-configured' });
    try {
        const https = require('https');
        await new Promise((resolve, reject) => {
            const r = https.request({ hostname: 'github.com', method: 'HEAD', path: '/', timeout: 5000 }, resolve);
            r.on('error', reject);
            r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
            r.end();
        });
        res.json({ reachable: true });
    } catch (e) {
        res.json({ reachable: false, error: e.message });
    }
});

// POST /api/file-projects/:name/setup-remote
//   Crée le repo GitHub pour un projet existant et configure son remote.
//   Idempotent : peut être rejoué sans casser un projet déjà câblé.
app.post('/api/file-projects/:name/setup-remote', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    if (!fs.existsSync(projetPath)) return res.status(404).json({ error: 'Projet non trouvé' });
    if (!githubService.isEnabled()) {
        return res.status(503).json({ error: 'GitHub désactivé ou non configuré (voir data/config/github.json)' });
    }
    try {
        const config = getProjectConfig(req.params.name);
        const projectName = config?.projectName || req.params.name;
        // S'assurer que le repo local existe
        projetGit.ensureProjetRepo(projetPath, {
            authorName: user.username || user.email || 'Worganic',
            authorEmail: user.email || 'worganic@local'
        });
        const result = await setupGithubRemoteForProject(projetPath, req.params.name, projectName);
        if (!result.success) {
            return res.status(409).json(result);
        }
        // Stocker l'URL git remote en BDD pour que les autres children puissent cloner
        if (result.publicUrl) {
            try {
                await pool.query('UPDATE file_project_meta SET git_remote_url = ? WHERE id = ?', [result.publicUrl, req.params.name]);
            } catch (e2) { console.warn('[setup-remote] MySQL update git_remote_url failed:', e2.message); }
        }
        res.json({ success: true, ...result });
    } catch (e) {
        console.warn('[GitHub] setup-remote error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/ftp-sync
//   Vérifie la connexion FTP, crée la structure de répertoires distants si absente,
//   et uploade tous les fichiers locaux vers le serveur FTP (idempotent).
//   Appelé à chaque ouverture d'un projet FTP dans l'éditeur.
app.post('/api/file-projects/:name/ftp-sync', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const ftpConfig = await ftpService.getFtpConfig(pool, req.params.name);
    if (!ftpConfig) return res.status(400).json({ error: 'Ce projet n\'a pas de configuration FTP' });

    // 1. Tester la connexion
    try {
        await ftpService.testConnection(ftpConfig);
    } catch (e) {
        return res.status(503).json({ error: `Connexion FTP impossible : ${e.message}`, connectionFailed: true });
    }

    // 2. Récupérer la config locale du projet
    const config = await getProjectConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });

    // 3. Collecter tous les fichiers locaux (texte + images)
    const fileList = [];
    const collectFiles = (nodes) => {
        for (const node of nodes) {
            if (node.type === 'file' && node.path) {
                const localPath = path.join(PROJECTS_DIR, req.params.name, node.path);
                if (fs.existsSync(localPath)) {
                    fileList.push({ localPath, remotePath: `projets/${req.params.name}/${node.path}` });
                }
            }
            if (node.children?.length) collectFiles(node.children);
        }
    };
    collectFiles(config.structure || []);

    if (fileList.length === 0) {
        return res.json({ success: true, status: 'empty', uploaded: 0, errors: [] });
    }

    // 4. Uploader tous les fichiers locaux vers FTP (crée dossiers distants au besoin)
    try {
        const result = await ftpService.uploadFiles(ftpConfig, fileList);
        res.json({ success: true, status: 'synced', uploaded: result.uploaded, errors: result.errors });
    } catch (e) {
        console.warn('[FTP sync] upload error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/ensure-local
//   Vérifie que le dossier projet existe localement. Si non et que git_remote_url est connu → git clone.
//   Si le dossier existe avec un repo git et un remote → git pull pour récupérer les fichiers pushés par d'autres users.
//   Si le dossier existe sans repo git mais qu'un remote est connu en BDD → re-clone depuis GitHub (cas d'un projet créé avant le setup-remote).
//   Pour les projets FTP : s'assure simplement que le dossier local existe.
//   Retourne { status: 'ready' | 'cloned' | 're-cloned' | 'no-remote' }
app.post('/api/file-projects/:name/ensure-local', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    const { execSync } = require('child_process');

    // Projets FTP : à chaque ouverture, télécharger depuis FTP les fichiers absents en local.
    // - Dossier absent → créer + tout télécharger (première ouverture / dossier supprimé)
    // - Dossier présent → télécharger seulement les fichiers manquants (skipExisting)
    // Erreur explicite si FTP non configuré ou inaccessible.
    try {
        const backupType = await ftpService.getBackupType(pool, req.params.name);
        if (backupType === 'ftp') {
            const ftpConfig = await ftpService.getFtpConfig(pool, req.params.name);
            if (!ftpConfig) {
                return res.json({ status: 'ftp-no-config', message: 'Ce projet n\'a pas de configuration FTP — les fichiers ne peuvent pas être récupérés automatiquement.' });
            }
            try {
                await ftpService.testConnection(ftpConfig);
            } catch (connErr) {
                // Si le dossier local existe déjà, on laisse quand même passer (mode offline)
                if (fs.existsSync(projetPath)) {
                    console.warn(`[ensure-local] FTP KO mais dossier local présent — mode offline : ${connErr.message}`);
                    return res.json({ status: 'ready', message: 'FTP inaccessible — ouverture en mode local' });
                }
                return res.json({ status: 'ftp-error', message: `Connexion FTP impossible : ${connErr.message}` });
            }
            // Récupérer la structure depuis MySQL (pour config.json + préserver les IDs)
            const config = await getProjectConfig(req.params.name);
            if (!config) {
                return res.status(404).json({ error: 'Projet non trouvé en BDD' });
            }
            // Créer le dossier local + (re)écrire config.json depuis MySQL
            // (MySQL est la source de vérité pour la structure avec les IDs)
            fs.mkdirSync(projetPath, { recursive: true });
            const cfgPath = path.join(projetPath, 'config.json');
            fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8');
            // Sync FTP ↔ local d'après la BDD (source de vérité) :
            //  - télécharge depuis FTP les fichiers attendus
            //  - supprime du FTP ET du local ce qui n'est pas dans la structure BDD
            //  - préserve .git et config.json (artefacts locaux)
            const { files: expectedFiles, dirs: expectedDirs } = ftpService.buildExpectedFromStructure(config.structure || []);
            const pullResult = await ftpService.syncFromFtp(
                ftpConfig,
                `projets/${req.params.name}`,
                projetPath,
                expectedFiles,
                expectedDirs,
                ['.git', 'config.json']
            );
            console.log(`[ensure-local FTP sync] ${req.params.name} : ${pullResult.downloaded} téléchargés, ${pullResult.deletedLocal} supprimés local, ${pullResult.deletedRemote} supprimés FTP, ${pullResult.errors.length} erreurs`);
            console.log(`[ensure-local FTP sync DEBUG] expectedDirs=${pullResult.debug.expectedDirsCount}, expectedFiles=${pullResult.debug.expectedFilesCount}, unexpectedLocal sample :`, pullResult.debug.unexpectedLocal);
            console.log(`[ensure-local FTP sync DEBUG] structure root names :`, (config.structure || []).map(n => `${n.type}:${n.name}:path=${n.path}`).slice(0, 50));
            if (pullResult.errors.length > 0) {
                console.warn('[ensure-local FTP sync] erreurs :', pullResult.errors);
            }
            return res.json({ status: 'ftp-pulled', downloaded: pullResult.downloaded, deletedLocal: pullResult.deletedLocal, deletedRemote: pullResult.deletedRemote, errors: pullResult.errors });
        }
    } catch (e) {
        console.warn('[ensure-local] backup_type lookup error:', e.message);
    }

    if (fs.existsSync(projetPath)) {
        if (projetGit.isRepo(projetPath)) {
            // Cas normal : dossier + git → pull silencieux pour récupérer les fichiers pushés par d'autres users
            if (projetGit.hasRemote(projetPath)) {
                const pullResult = projetGit.pullMain(projetPath);
                if (!pullResult.success && !pullResult.skipped) {
                    console.warn('[ensure-local] pull warning (non-bloquant):', pullResult.error);
                }
            }
            return res.json({ status: 'ready' });
        }

        // Cas orphelin : dossier local sans .git, mais un remote existe en BDD
        // → re-clone depuis GitHub pour récupérer tous les fichiers committés (images, etc.)
        try {
            const [rows] = await pool.query('SELECT git_remote_url, display_name FROM file_project_meta WHERE id = ?', [req.params.name]);
            const gitRemoteUrl = rows[0]?.git_remote_url;
            if (!gitRemoteUrl) {
                // Pas de remote connu : on s'assure que config.json existe (sinon les endpoints folders/files renvoient 404)
                const cfgPath = path.join(projetPath, 'config.json');
                if (!fs.existsSync(cfgPath)) {
                    const displayName = rows[0]?.display_name || req.params.name;
                    fs.writeFileSync(cfgPath, JSON.stringify({ projectName: displayName, structure: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, null, 2), 'utf8');
                }
                return res.json({ status: 'ready' });
            }
            console.log(`[ensure-local] dossier orphelin (sans .git) détecté pour ${req.params.name} — re-clone depuis GitHub`);
            fs.rmSync(projetPath, { recursive: true, force: true });
            fs.mkdirSync(PROJECTS_DIR, { recursive: true });
            execSync(`git clone "${gitRemoteUrl}" "${projetPath}"`, { timeout: 60000 });
            return res.json({ status: 're-cloned', gitRemoteUrl });
        } catch (e) {
            console.warn('[ensure-local] re-clone error:', e.message);
            return res.json({ status: 'ready' }); // fail-safe : on laisse le dossier tel quel
        }
    }

    try {
        const [rows] = await pool.query('SELECT git_remote_url FROM file_project_meta WHERE id = ?', [req.params.name]);
        if (rows.length === 0) return res.status(404).json({ error: 'Projet non trouvé en BDD' });
        const gitRemoteUrl = rows[0].git_remote_url;
        if (!gitRemoteUrl) {
            return res.json({ status: 'no-remote', message: 'Ce projet n\'est pas disponible localement — un remote Git doit être configuré par le propriétaire.' });
        }
        // Cloner le repo
        fs.mkdirSync(PROJECTS_DIR, { recursive: true });
        execSync(`git clone "${gitRemoteUrl}" "${projetPath}"`, { timeout: 60000 });
        return res.json({ status: 'cloned', gitRemoteUrl });
    } catch (e) {
        console.warn('[ensure-local] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/ensure-fast
//   Version rapide de ensure-local : crée le dossier local depuis la BDD sans aucun appel FTP/Git.
//   Utilisé par le client pour afficher l'UI immédiatement, la sync FTP se fait ensuite en arrière-plan.
app.post('/api/file-projects/:name/ensure-fast', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    try {
        let config = await getProjectConfig(req.params.name);

        // Si file_project_meta n'existe pas, créer l'entrée depuis frank_projects
        // (projet créé côté portail mais pas encore initialisé côté file-projects)
        if (!config) {
            try {
                const [rows] = await pool.query('SELECT title FROM frank_projects WHERE id = ?', [req.params.name]);
                const displayName = rows[0]?.title || req.params.name;
                const now = new Date().toISOString();
                await pool.query(
                    'INSERT IGNORE INTO file_project_meta (id, display_name, structure, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                    [req.params.name, displayName, JSON.stringify([]), now, now]
                );
                config = { projectName: displayName, structure: [], createdAt: now, updatedAt: now, gitRemoteUrl: null };
            } catch (e2) {
                console.warn('[ensure-fast] auto-create file_project_meta failed:', e2.message);
                return res.status(404).json({ error: 'Projet non trouvé en BDD' });
            }
        }

        const alreadyExists = fs.existsSync(projetPath);
        if (!alreadyExists) {
            fs.mkdirSync(projetPath, { recursive: true });
            const cfgPath = path.join(projetPath, 'config.json');
            fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8');
            const createDirs = (nodes) => {
                for (const n of (nodes || [])) {
                    if (n.type === 'folder' && n.path) fs.mkdirSync(path.join(projetPath, n.path), { recursive: true });
                    if (n.children) createDirs(n.children);
                }
            };
            createDirs(config.structure || []);
            return res.json({ status: 'created-local', structure: config.structure || [] });
        }

        // Garantir que config.json existe même si le dossier était déjà présent sans lui
        // (sinon les endpoints folders/files renvoient 404 — régression connue)
        const cfgPath = path.join(projetPath, 'config.json');
        if (!fs.existsSync(cfgPath)) {
            try { fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8'); } catch {}
        }

        return res.json({ status: 'ready', structure: config.structure || [] });
    } catch (e) {
        console.warn('[ensure-fast] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/ftp-sync-background
//   Démarre la sync FTP en arrière-plan et retourne immédiatement.
//   Progresse dossier par dossier, chaque résultat est broadcasté via SSE (ftp_folder_synced).
//   Fin de sync broadcastée via SSE (ftp_sync_complete).
app.post('/api/file-projects/:name/ftp-sync-background', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projectName = req.params.name;
    const projetPath = path.join(PROJECTS_DIR, projectName);

    try {
        const ftpConfig = await ftpService.getFtpConfig(pool, projectName);
        if (!ftpConfig) {
            return res.json({ started: false, reason: 'no-ftp-config' });
        }
        const config = await getProjectConfig(projectName);
        if (!config) return res.status(404).json({ error: 'Projet non trouvé en BDD' });
        const topFolders = (config.structure || []).filter(n => n.type === 'folder');
        if (topFolders.length === 0) {
            return res.json({ started: false, reason: 'no-folders' });
        }

        // Compter le total de fichiers à synchroniser
        let totalFiles = 0;
        const countFiles = (nodes) => { for (const n of (nodes || [])) { if (n.type === 'file') totalFiles++; if (n.children) countFiles(n.children); } };
        countFiles(config.structure || []);

        // Répondre immédiatement
        res.json({ started: true, totalFolders: topFolders.length, totalFiles });

        // Lancer la sync en arrière-plan (sans await dans le handler)
        (async () => {
            broadcastToProject(projectName, 'ftp_sync_start', { totalFolders: topFolders.length, totalFiles });
            let totalDownloaded = 0;
            let totalChecked = 0;
            const allErrors = [];
            for (const folder of topFolders) {
                try {
                    const result = await ftpService.syncFolderFilesFromFtp(ftpConfig, projectName, folder, PROJECTS_DIR);
                    totalDownloaded += result.downloaded;
                    totalChecked += result.checked || 0;
                    if (result.errors.length > 0) allErrors.push(...result.errors);
                    broadcastToProject(projectName, 'ftp_folder_synced', {
                        folderId: folder.id,
                        status: result.status,
                        downloaded: result.downloaded,
                        checked: result.checked || 0,
                        totalChecked,
                        totalFiles,
                        errors: result.errors
                    });
                } catch (e) {
                    allErrors.push({ path: folder.path, error: e.message });
                    broadcastToProject(projectName, 'ftp_folder_synced', {
                        folderId: folder.id,
                        status: 'error',
                        downloaded: 0,
                        errors: [{ path: folder.path, error: e.message }]
                    });
                }
            }
            broadcastToProject(projectName, 'ftp_sync_complete', {
                status: allErrors.length > 0 ? 'error' : 'done',
                downloaded: totalDownloaded,
                errors: allErrors
            });
        })().catch(e => console.warn('[ftp-sync-background] async error:', e.message));

    } catch (e) {
        console.warn('[ftp-sync-background] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/initial-backup-push
//   Transfère tous les fichiers locaux vers le système de sauvegarde nouvellement configuré.
//   Utilisé quand un backup est ajouté pour la première fois sur un projet local existant.
app.post('/api/file-projects/:name/initial-backup-push', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projectName = req.params.name;
    const projetPath = path.join(PROJECTS_DIR, projectName);

    if (!fs.existsSync(projetPath)) {
        return res.status(404).json({ error: 'Dossier projet introuvable localement' });
    }

    try {
        const [projRows] = await pool.query(
            'SELECT backup_type, backup_server, backup_username, backup_password, backup_port, backup_directory, git_remote_url FROM frank_projects fp LEFT JOIN file_project_meta fpm ON fpm.id = fp.id WHERE fp.id = ?',
            [projectName]
        );
        if (!projRows.length) return res.status(404).json({ error: 'Projet non trouvé' });
        const proj = projRows[0];
        const backupType = proj.backup_type;

        if (backupType === 'ftp') {
            if (!(await ftpService.isFtpGloballyEnabled(pool))) {
                return res.status(400).json({ error: 'La synchronisation FTP est désactivée (Admin → Config)' });
            }
            const ftpConfig = await ftpService.getFtpConfig(pool, projectName);
            if (!ftpConfig) return res.status(400).json({ error: 'Config FTP introuvable' });
            // Tester la connexion
            try { await ftpService.testConnection(ftpConfig); } catch (e) {
                return res.status(503).json({ error: `Connexion FTP impossible : ${e.message}` });
            }
            // Collecter tous les fichiers locaux
            const config = await getProjectConfig(projectName);
            const fileList = [];
            const collectFiles = (nodes) => {
                for (const n of (nodes || [])) {
                    if (n.type === 'file' && n.path) {
                        const localPath = path.join(projetPath, n.path);
                        if (fs.existsSync(localPath)) {
                            fileList.push({ localPath, remotePath: `projets/${projectName}/${n.path.replace(/\\/g, '/')}` });
                        }
                    }
                    if (n.children) collectFiles(n.children);
                }
            };
            collectFiles(config?.structure || []);
            const result = await ftpService.uploadFiles(ftpConfig, fileList);
            return res.json({ success: result.errors.length === 0, uploaded: result.uploaded, errors: result.errors });
        }

        if (backupType === 'github' || backupType === 'gitlab') {
            const gitRemoteUrl = proj.git_remote_url;
            if (!gitRemoteUrl) {
                return res.status(400).json({ error: 'Aucun remote Git configuré — configurez d\'abord un dépôt distant via le setup GitHub.' });
            }
            if (!projetGit.isRepo(projetPath)) {
                return res.status(400).json({ error: 'Le dossier projet n\'est pas un repo Git — initialisez-le d\'abord.' });
            }
            if (!projetGit.hasRemote(projetPath)) {
                const { execSync } = require('child_process');
                execSync(`git -C "${projetPath}" remote add origin "${gitRemoteUrl}"`, { timeout: 10000 });
            }
            const pushResult = projetGit.pushMain(projetPath);
            if (!pushResult.success && !pushResult.skipped) {
                return res.status(500).json({ error: pushResult.error || 'Erreur lors du push Git' });
            }
            return res.json({ success: true, pushed: true });
        }

        return res.status(400).json({ error: `Type de backup non supporté : ${backupType}` });
    } catch (e) {
        console.warn('[initial-backup-push] error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/file-projects/:name/push
//   Push manuel de main vers le remote (utile au retour en ligne après travail offline)
app.post('/api/file-projects/:name/push', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const projetPath = path.join(PROJECTS_DIR, req.params.name);
    if (!fs.existsSync(projetPath)) return res.status(404).json({ error: 'Projet non trouvé' });
    try {
        const result = projetGit.pushMain(projetPath);
        if (!result.success && !result.skipped) {
            return res.status(409).json({ error: result.error || 'Push impossible' });
        }
        res.json({ success: true, ...result });
    } catch (e) {
        console.warn('[ProjetGit] push error:', e.message);
        res.status(500).json({ error: e.message });
    }
});
// ============================================================
// ROUTES: Conversations (Zone 5)
// ============================================================

// GET /api/conversations/:sectionId
app.get('/api/conversations/:sectionId', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    
    const sectionId = req.params.sectionId;
    const filePath = path.join(CONVERSATIONS_DIR, `${sectionId}.json`);
    
    try {
        if (!fs.existsSync(filePath)) {
            return res.json({ sectionId, messages: [] });
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Erreur lors de la lecture de la conversation' });
    }
});

// GET /api/conversations-list
app.get('/api/conversations-list', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    
    try {
        if (!fs.existsSync(CONVERSATIONS_DIR)) {
            return res.json([]);
        }
        const files = fs.readdirSync(CONVERSATIONS_DIR);
        // Retourne la liste des IDs (nom du fichier sans .json)
        const ids = files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        res.json(ids);
    } catch (e) {
        res.status(500).json({ error: 'Erreur lors de la récupération de la liste des conversations' });
    }
});

// POST /api/conversations/:sectionId
app.post('/api/conversations/:sectionId', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    
    const sectionId = req.params.sectionId;
    const { text, role, promptInstanceId, promptInstanceName, mode, mos, cadrageWave, isCadrageForm, contextReplace, attachedContext } = req.body;

    if (!text) return res.status(400).json({ error: 'Texte requis' });

    const filePath = path.join(CONVERSATIONS_DIR, `${sectionId}.json`);

    try {
        if (!fs.existsSync(CONVERSATIONS_DIR)) {
            fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
        }

        let data = { sectionId, messages: [] };
        if (fs.existsSync(filePath)) {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        const newMessage = {
            user: role === 'ai' ? 'IA' : user.username,
            userId: role === 'ai' ? 'ai' : user.id,
            text,
            role: role || 'user',
            timestamp: new Date().toISOString(),
            // Conversation lancée depuis un MO Prompt (mode Normal/Guidé/Tchat/Tchat libre)
            ...(promptInstanceId ? { promptInstanceId } : {}),
            ...(promptInstanceName ? { promptInstanceName } : {}),
            ...(mode ? { mode } : {}),
            ...(Array.isArray(mos) && mos.length ? { mos } : {}),
            ...(cadrageWave ? { cadrageWave } : {}),
            ...(isCadrageForm ? { isCadrageForm } : {}),
            ...(contextReplace ? { contextReplace } : {}),
            ...(attachedContext ? { attachedContext } : {}),
        };

        data.messages.push(newMessage);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        
        res.status(201).json(newMessage);
    } catch (e) {
        res.status(500).json({ error: 'Erreur lors de la sauvegarde du message' });
    }
});

// DELETE /api/conversations/:sectionId — efface toute la conversation d'une section
// (chat général "Mode IA" + tous les échanges MO Prompt confondus, un seul fichier par section).
app.delete('/api/conversations/:sectionId', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const sectionId = req.params.sectionId;
    const filePath = path.join(CONVERSATIONS_DIR, `${sectionId}.json`);

    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Erreur lors de la suppression de la conversation' });
    }
});
// Projet Collaboration API
// ============================================================

// SSE clients registry: projetId → Set<res>
const sseClients = new Map();

function broadcastToProject(projetId, event, data) {
    const clients = sseClients.get(projetId);
    if (!clients || clients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
        try { res.write(payload); } catch (_) {}
    }
}

// GET /api/collab/:projetId/stream — SSE
app.get('/api/collab/:projetId/stream', (req, res) => {
    const { projetId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!sseClients.has(projetId)) sseClients.set(projetId, new Set());
    sseClients.get(projetId).add(res);
    res.write('event: connected\ndata: {"status":"ok"}\n\n');

    const hb = setInterval(() => { try { res.write(':heartbeat\n\n'); } catch (_) {} }, 25000);
    req.on('close', () => { clearInterval(hb); sseClients.get(projetId)?.delete(res); });
});

// GET /api/collab/:projetId/history
app.get('/api/collab/:projetId/history', async (req, res) => {
    const { projetId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    try {
        const [rows] = await pool.query(
            `SELECT id, timestamp, section, action_type, label, entity_type, entity_id, entity_label,
                    user_id, username, undone, undoable, before_state, after_state
             FROM wo_action_history
             WHERE section LIKE 'projets/%'
               AND JSON_UNQUOTE(JSON_EXTRACT(context, '$.projectId')) = ?
             ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [projetId, limit, offset]
        );
        res.json(rows.map(r => ({
            id: r.id, timestamp: r.timestamp, section: r.section,
            actionType: r.action_type, label: r.label,
            entityType: r.entity_type, entityId: r.entity_id, entityLabel: r.entity_label,
            userId: r.user_id, username: r.username, undone: !!r.undone, undoable: !!r.undoable,
            beforeState: r.before_state ? (typeof r.before_state === 'string' ? JSON.parse(r.before_state) : r.before_state) : null,
            afterState: r.after_state ? (typeof r.after_state === 'string' ? JSON.parse(r.after_state) : r.after_state) : null
        })));
    } catch (e) {
        console.error('[COLLAB] history error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/collab/:projetId/history — efface l'historique scopé à un projet/entités
//   query: entityIds (CSV, optionnel) — restreint aux entités sélectionnées
//          scope = 'mine' | 'all' — 'all' réservé aux admins, sinon forcé à 'mine'
app.delete('/api/collab/:projetId/history', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projetId } = req.params;
    const requestedScope = (req.query.scope || 'mine').toString();
    const scope = (requestedScope === 'all' && user.role === 'admin') ? 'all' : 'mine';
    const entityIdsRaw = (req.query.entityIds || '').toString().trim();
    const entityIds = entityIdsRaw ? entityIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    try {
        const params = [projetId];
        let sql = `DELETE FROM wo_action_history
                   WHERE section LIKE 'projets/%'
                     AND JSON_UNQUOTE(JSON_EXTRACT(context, '$.projectId')) = ?`;
        if (entityIds.length > 0) {
            sql += ` AND entity_id IN (${entityIds.map(() => '?').join(',')})`;
            params.push(...entityIds);
        }
        if (scope === 'mine') {
            sql += ' AND user_id = ?';
            params.push(user.id);
        }
        const [result] = await pool.query(sql, params);
        console.log(`[COLLAB] history cleared: projet=${projetId} scope=${scope} user=${user.username} affected=${result.affectedRows}`);
        res.json({ success: true, deleted: result.affectedRows });
    } catch (e) {
        console.error('[COLLAB] clear history error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/collab/:projetId/locks
app.get('/api/collab/:projetId/locks', async (req, res) => {
    const { projetId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT * FROM projet_section_lock WHERE projet_id = ?', [projetId]
        );
        res.json(rows.map(r => ({
            nodeId: r.node_id, projetId: r.projet_id,
            lockedById: r.locked_by_id, lockedByName: r.locked_by_name,
            lockedAt: r.locked_at
        })));
    } catch (e) {
        console.error('[COLLAB] locks error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/** Rediffuse l'état complet des présences actives sur un nœud (0..n utilisateurs). */
async function broadcastPresence(projetId, nodeId) {
    const [rows] = await pool.query('SELECT * FROM projet_section_lock WHERE node_id = ?', [nodeId]);
    broadcastToProject(projetId, 'presence', {
        nodeId,
        projetId,
        users: rows.map(r => ({
            nodeId: r.node_id, projetId: r.projet_id,
            lockedById: r.locked_by_id, lockedByName: r.locked_by_name, lockedAt: r.locked_at
        }))
    });
}

// POST /api/collab/:projetId/nodes/:nodeId/lock
// Registre de présence multi-utilisateurs : n'a aucun rôle bloquant (plusieurs users
// peuvent éditer la même section en même temps, chacun avec son propre brouillon
// local). Sert uniquement à afficher qui édite quoi et depuis quand côté client.
// Un balayage TTL (voir plus bas) nettoie les entrées périmées (onglet fermé/crashé).
app.post('/api/collab/:projetId/nodes/:nodeId/lock', async (req, res) => {
    const { projetId, nodeId } = req.params;
    const { userId, userName } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    try {
        await pool.query(
            `INSERT INTO projet_section_lock (node_id, projet_id, locked_by_id, locked_by_name)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE locked_by_name=VALUES(locked_by_name), locked_at=NOW()`,
            [nodeId, projetId, userId, userName || 'Utilisateur']
        );
        const lock = { nodeId, projetId, lockedById: userId, lockedByName: userName || 'Utilisateur', lockedAt: new Date().toISOString() };
        broadcastToProject(projetId, 'lock', lock);
        await broadcastPresence(projetId, nodeId);
        res.json(lock);
    } catch (e) {
        console.error('[COLLAB] lock error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/collab/:projetId/nodes/:nodeId/lock
app.delete('/api/collab/:projetId/nodes/:nodeId/lock', async (req, res) => {
    const { projetId, nodeId } = req.params;
    const userId = req.query.userId;
    try {
        if (!userId) return res.status(400).json({ error: 'userId requis' });
        await pool.query('DELETE FROM projet_section_lock WHERE node_id = ? AND locked_by_id = ?', [nodeId, userId]);
        broadcastToProject(projetId, 'unlock', { nodeId, projetId, userId });
        await broadcastPresence(projetId, nodeId);
        res.json({ success: true });
    } catch (e) {
        console.error('[COLLAB] unlock error:', e);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Balayage périodique : libère les présences périmées (onglet fermé sans
// déverrouillage explicite, crash navigateur) après 5 minutes d'inactivité.
setInterval(async () => {
    try {
        const [stale] = await pool.query(
            'SELECT node_id, projet_id, locked_by_id FROM projet_section_lock WHERE locked_at < (NOW() - INTERVAL 5 MINUTE)'
        );
        if (!stale.length) return;
        await pool.query('DELETE FROM projet_section_lock WHERE locked_at < (NOW() - INTERVAL 5 MINUTE)');
        const seenNodes = new Set();
        for (const row of stale) {
            broadcastToProject(row.projet_id, 'unlock', { nodeId: row.node_id, projetId: row.projet_id, userId: row.locked_by_id });
            const key = `${row.projet_id}::${row.node_id}`;
            if (!seenNodes.has(key)) {
                seenNodes.add(key);
                await broadcastPresence(row.projet_id, row.node_id);
            }
        }
        console.log(`[PRESENCE] ${stale.length} présence(s) périmée(s) nettoyée(s)`);
    } catch (e) {
        console.warn('[PRESENCE] TTL sweep error:', e.message);
    }
}, 60 * 1000);

// Balayage périodique (best-effort) : purge les brouillons locaux abandonnés
// depuis longtemps (utilisateur parti sans jamais valider ni annuler). TTL
// large car un brouillon peut légitimement rester ouvert plusieurs jours.
setInterval(async () => {
    try {
        const [result] = await pool.query(
            'DELETE FROM projet_local_draft WHERE updated_at < (NOW() - INTERVAL 30 DAY)'
        );
        if (result.affectedRows) {
            console.log(`[DRAFT] ${result.affectedRows} brouillon(s) local(aux) abandonné(s) nettoyé(s)`);
        }
    } catch (e) {
        console.warn('[DRAFT] TTL sweep error:', e.message);
    }
}, 60 * 60 * 1000);

// Balayage périodique : purge physiquement les entrées de corbeille dont la
// rétention (30 jours) est écoulée et qui n'ont jamais été restaurées.
setInterval(async () => {
    try {
        const [expired] = await pool.query(
            `SELECT id, project_id, trash_disk_path FROM projet_trash_entry
             WHERE purge_at < NOW() AND restored_at IS NULL AND purged_at IS NULL`
        );
        if (!expired.length) return;
        for (const entry of expired) {
            try {
                const trashFull = safeProjectPath(entry.project_id, entry.trash_disk_path);
                if (trashFull && fs.existsSync(trashFull)) {
                    fs.rmSync(trashFull, { recursive: true, force: true });
                    removeEmptyTrashParentDir(trashFull);
                }
                await pool.query('UPDATE projet_trash_entry SET purged_at = NOW() WHERE id = ?', [entry.id]);
            } catch (entryErr) {
                console.warn(`[TRASH] purge entrée ${entry.id} échouée:`, entryErr.message);
            }
        }
        console.log(`[TRASH] ${expired.length} entrée(s) de corbeille purgée(s) définitivement`);
    } catch (e) {
        console.warn('[TRASH] TTL sweep error:', e.message);
    }
}, 60 * 60 * 1000);
// ============================================================
// POST /api/ai/execute-file-prompt — Appel IA direct (sans executor Electron)
// Utilise la clé API stockée dans le userConfig en DB
// SSE format identique à l'executor
// ============================================================
app.post('/api/ai/execute-file-prompt', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { fileName, promptContent, fileContent, systemInstructions, provider: bodyProvider, model: bodyModel } = req.body;
    if (!fileName || !promptContent) {
        return res.status(400).json({ error: 'fileName et promptContent requis' });
    }

    const rawCfg = user.config || {};
    const userConfig = typeof rawCfg === 'string' ? (() => { try { return JSON.parse(rawCfg); } catch { return {}; } })() : rawCfg;
    const apiKeys = userConfig.apiKeys || {};

    const provider = (bodyProvider || 'claude').split('-')[0];
    let model = bodyModel || 'claude-sonnet-4-6';

    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sseWrite = (type, message, extra = {}) => {
        res.write(`data: ${JSON.stringify({ type, message, ...extra })}\n\n`);
    };

    sseWrite('start', `> Calling ${provider}/${model} directly...\n`);

    try {
        if (provider === 'gemini') {
            const geminiKey = apiKeys.gemini?.key || '';
            if (!geminiKey) { sseWrite('error', 'Clé API Gemini non configurée'); res.end(); return; }

            const formatInstruction = 'Retourne UNIQUEMENT le contenu complet du fichier modifié, sans aucun texte supplémentaire ni explication.';
            const systemBlock = systemInstructions ? `${systemInstructions}\n\n${formatInstruction}\n\n` : `${formatInstruction}\n\n`;
            const fullPrompt = systemBlock + (fileContent
                ? `${promptContent}\n\n---\n\n**Fichier actuel (${fileName}):**\n\`\`\`\n${fileContent}\n\`\`\``
                : promptContent);

            if (!model.startsWith('gemini-')) model = 'gemini-2.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`;
            const https = require('https');
            const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] });
            const urlObj = new URL(url);
            const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };

            const apiReq = https.request(options, (apiRes) => {
                let buffer = '';
                apiRes.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';
                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        try {
                            const data = JSON.parse(line.slice(5).trim());
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (text) sseWrite('stdout', text);
                        } catch {}
                    }
                });
                apiRes.on('end', () => { sseWrite('end', '\nTerminé', { code: 0 }); res.end(); });
            });
            apiReq.on('error', (e) => { sseWrite('error', e.message); res.end(); });
            apiReq.write(body);
            apiReq.end();

        } else {
            // Claude
            const claudeKey = apiKeys.claude?.key || '';
            if (!claudeKey) { sseWrite('error', 'Clé API Claude non configurée. Configures ta clé dans Admin > Config > Intelligence Artificielle.'); res.end(); return; }

            if (!model.startsWith('claude-')) model = 'claude-sonnet-4-6';

            const Anthropic = require('@anthropic-ai/sdk');
            const client = new Anthropic.default({ apiKey: claudeKey });

            // L'instruction de format est toujours dans le system prompt (jamais dans le user)
            // pour éviter que Claude détecte une injection depuis le contenu du fichier.
            const formatInstruction = 'Return ONLY the complete modified file content, without any additional text or explanations.';
            const systemBlock = systemInstructions
                ? `${systemInstructions}\n\n${formatInstruction}`
                : `You are a helpful assistant for modifying file content. ${formatInstruction}`;

            const userContent = fileContent
                ? `${promptContent}\n\n---\n\n**Current file (${fileName}):**\n\`\`\`\n${fileContent}\n\`\`\``
                : promptContent;

            const stream = await client.messages.stream({
                model,
                max_tokens: 8096,
                system: systemBlock,
                messages: [{ role: 'user', content: userContent }]
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    sseWrite('stdout', event.delta.text);
                }
            }

            const finalMsg = await stream.finalMessage();
            const usage = finalMsg.usage;
            if (usage) {
                sseWrite('tokens', '', {
                    used: usage.input_tokens + usage.output_tokens,
                    total: 200000,
                    remaining: 200000 - usage.input_tokens - usage.output_tokens
                });
            }
            sseWrite('end', '\nTerminé', { code: 0 });
            res.end();
        }
    } catch (err) {
        sseWrite('error', err.message || 'Erreur API IA');
        res.end();
    }
});

// POST /api/ai/execute-simple-prompt — Prompt simple sans fichier (fallback executor)
app.post('/api/ai/execute-simple-prompt', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    const { systemPrompt, userPrompt, provider: bodyProvider, model: bodyModel } = req.body;
    if (!userPrompt) return res.status(400).json({ error: 'userPrompt requis' });

    const rawCfg = user.config || {};
    const userConfig = typeof rawCfg === 'string' ? (() => { try { return JSON.parse(rawCfg); } catch { return {}; } })() : rawCfg;
    const apiKeys = userConfig.apiKeys || {};

    const rawProvider = (bodyProvider || 'claude').split('-')[0];
    // 'antigravity' est le CLI AGY (Gemini) — utiliser l'API Gemini en fallback
    const provider = rawProvider === 'antigravity' ? 'gemini' : rawProvider;
    let model = bodyModel || 'claude-sonnet-4-6';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sseWrite = (type, message, extra = {}) => {
        res.write(`data: ${JSON.stringify({ type, message, ...extra })}\n\n`);
    };

    sseWrite('start', `> Calling ${provider}/${model}...\n`);

    try {
        if (provider === 'gemini') {
            const geminiKey = apiKeys.gemini?.key || '';
            if (!geminiKey) { sseWrite('error', 'Clé API Gemini non configurée'); res.end(); return; }
            if (!model.startsWith('gemini-')) model = 'gemini-2.5-flash';

            const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${userPrompt}` : userPrompt;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`;
            const https = require('https');
            const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] });
            const urlObj = new URL(url);
            const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };

            const apiReq = https.request(options, (apiRes) => {
                let buffer = '';
                apiRes.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';
                    for (const line of lines) {
                        if (!line.startsWith('data:')) continue;
                        try {
                            const data = JSON.parse(line.slice(5).trim());
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (text) sseWrite('stdout', text);
                        } catch {}
                    }
                });
                apiRes.on('end', () => { sseWrite('end', '\nTerminé', { code: 0 }); res.end(); });
            });
            apiReq.on('error', (e) => { sseWrite('error', e.message); res.end(); });
            apiReq.write(body);
            apiReq.end();

        } else {
            const claudeKey = apiKeys.claude?.key || '';
            if (!claudeKey) { sseWrite('error', 'Clé API Claude non configurée. Configures ta clé dans Admin > Config > Intelligence Artificielle.'); res.end(); return; }
            if (!model.startsWith('claude-')) model = 'claude-sonnet-4-6';

            const Anthropic = require('@anthropic-ai/sdk');
            const client = new Anthropic.default({ apiKey: claudeKey });

            const systemBlock = systemPrompt || 'You are a helpful assistant.';

            const stream = await client.messages.stream({
                model,
                max_tokens: 8096,
                system: systemBlock,
                messages: [{ role: 'user', content: userPrompt }]
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    sseWrite('stdout', event.delta.text);
                }
            }

            const finalMsg = await stream.finalMessage();
            const usage = finalMsg.usage;
            if (usage) {
                sseWrite('tokens', '', {
                    used: usage.input_tokens + usage.output_tokens,
                    total: 200000,
                    remaining: 200000 - usage.input_tokens - usage.output_tokens
                });
            }
            sseWrite('end', '\nTerminé', { code: 0 });
            res.end();
        }
    } catch (err) {
        sseWrite('error', err.message || 'Erreur API IA');
        res.end();
    }
});
// ============================================================
// Mega-Outils
// ============================================================

// Diffuse un événement SSE 'trello_update' aux collaborateurs du projet.
// projectId optionnel : si absent, résolu depuis l'instance.
async function broadcastTrelloUpdate(instanceId, action, projectId) {
    try {
        let pid = projectId;
        if (!pid && instanceId) {
            const [r] = await pool.query('SELECT project_id FROM mega_outil_instances WHERE id = ?', [instanceId]);
            pid = r[0]?.project_id;
        }
        if (pid) broadcastToProject(pid, 'trello_update', { instanceId: instanceId || null, projectId: pid, action });
    } catch (e) { console.warn('[mega-outils] broadcastTrelloUpdate failed:', e.message); }
}

// GET /api/mega-outils/instances?projectId=&type=
app.get('/api/mega-outils/instances', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { projectId, type } = req.query;
    try {
        let sql = 'SELECT * FROM mega_outil_instances';
        const params = [];
        const where = [];
        if (projectId) { where.push('project_id = ?'); params.push(projectId); }
        if (type)      { where.push('type = ?');       params.push(type); }
        if (where.length) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY created_at ASC';
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(r => ({
            id: r.id, type: r.type, name: r.name, projectId: r.project_id,
            outilId: r.outil_id || undefined, folderId: r.folder_id || undefined, createdBy: r.created_by || undefined,
            createdAt: r.created_at, updatedAt: r.updated_at,
            thumbnailData: r.thumbnail_data || undefined
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/instances/all  (admin : toutes instances)
app.get('/api/mega-outils/instances/all', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(`
            SELECT i.*, fpm.display_name AS project_name
            FROM mega_outil_instances i
            LEFT JOIN file_project_meta fpm ON fpm.id = i.project_id
            ORDER BY i.created_at DESC
        `);
        res.json(rows.map(r => ({
            instance: { id: r.id, type: r.type, name: r.name, projectId: r.project_id,
                outilId: r.outil_id || undefined, folderId: r.folder_id || undefined, createdBy: r.created_by || undefined,
                createdAt: r.created_at, updatedAt: r.updated_at },
            projectName: r.project_name || r.project_id
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/instances
app.post('/api/mega-outils/instances', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { type, name, projectId, outilId, folderId } = req.body;
    if (!type || !name || !projectId) return res.status(400).json({ error: 'type, name et projectId requis' });
    try {
        const id = require('crypto').randomUUID();
        await pool.query(
            'INSERT INTO mega_outil_instances (id, type, name, project_id, outil_id, folder_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, type, name, projectId, outilId || null, folderId || null, user.id || null]
        );
        const [rows] = await pool.query('SELECT * FROM mega_outil_instances WHERE id = ?', [id]);
        const r = rows[0];
        broadcastTrelloUpdate(r.id, 'instance_create', r.project_id);
        res.status(201).json({ id: r.id, type: r.type, name: r.name, projectId: r.project_id,
            outilId: r.outil_id || undefined, folderId: r.folder_id || undefined, createdBy: r.created_by || undefined,
            createdAt: r.created_at, updatedAt: r.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mega-outils/instances/:id
app.patch('/api/mega-outils/instances/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { name, folderId } = req.body;
    if (name === undefined && folderId === undefined) return res.status(400).json({ error: 'name ou folderId requis' });
    try {
        const sets = [], vals = [];
        if (name !== undefined)     { sets.push('name = ?');      vals.push(name); }
        if (folderId !== undefined) { sets.push('folder_id = ?'); vals.push(folderId || null); }
        vals.push(req.params.id);
        await pool.query(`UPDATE mega_outil_instances SET ${sets.join(', ')} WHERE id = ?`, vals);
        const [rows] = await pool.query('SELECT * FROM mega_outil_instances WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Instance non trouvée' });
        const r = rows[0];
        broadcastTrelloUpdate(r.id, 'instance_update', r.project_id);
        res.json({ id: r.id, type: r.type, name: r.name, projectId: r.project_id,
            outilId: r.outil_id || undefined, folderId: r.folder_id || undefined, createdBy: r.created_by || undefined,
            createdAt: r.created_at, updatedAt: r.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/instances/:id
app.delete('/api/mega-outils/instances/:id', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        // Résoudre le projet avant suppression pour le broadcast
        const [pr] = await pool.query('SELECT project_id FROM mega_outil_instances WHERE id = ?', [req.params.id]);
        const projectId = pr[0]?.project_id;
        await pool.query('DELETE FROM mega_outil_trello_cards WHERE instance_id = ?', [req.params.id]);
        await pool.query('DELETE FROM mega_outil_instances WHERE id = ?', [req.params.id]);
        broadcastTrelloUpdate(req.params.id, 'instance_delete', projectId);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/trello/all
app.get('/api/mega-outils/trello/all', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [instances] = await pool.query(`
            SELECT i.*, COALESCE(fp.title, fpm.display_name) AS project_name
            FROM mega_outil_instances i
            LEFT JOIN file_project_meta fpm ON fpm.id = i.project_id
            LEFT JOIN frank_projects fp ON fp.id = i.project_id COLLATE utf8mb4_unicode_ci
            WHERE i.type = 'trello' ORDER BY i.created_at ASC
        `);
        const result = [];
        const configCache = new Map(); // project_id → config (évite de recharger)
        for (const r of instances) {
            const [cards] = await pool.query(
                'SELECT * FROM mega_outil_trello_cards WHERE instance_id = ? ORDER BY order_index ASC, created_at ASC',
                [r.id]
            );
            // Résoudre le nom de la section (folder) et de l'outil dans la structure du projet
            let folderName = null, outilName = null;
            try {
                if (!configCache.has(r.project_id)) configCache.set(r.project_id, await getProjectConfig(r.project_id));
                const cfg = configCache.get(r.project_id);
                if (cfg) {
                    if (r.folder_id && cfg.structure) folderName = findNodeById(cfg.structure, r.folder_id)?.name || null;
                    if (r.outil_id && Array.isArray(cfg.outils)) outilName = cfg.outils.find(o => o.id === r.outil_id)?.name || null;
                }
            } catch (_) {}
            result.push({
                instance: { id: r.id, type: r.type, name: r.name, projectId: r.project_id,
                    outilId: r.outil_id || undefined, folderId: r.folder_id || undefined, createdBy: r.created_by || undefined,
                    createdAt: r.created_at, updatedAt: r.updated_at },
                projectName: r.project_name || r.project_id,
                folderName, outilName,
                cards: cards.map(c => ({ id: c.id, instanceId: c.instance_id, title: c.title,
                    description: c.description || undefined, status: c.status, priority: c.priority,
                    orderIndex: c.order_index, creatorId: c.creator_id || undefined,
                    creatorName: c.creator_name || undefined, createdAt: c.created_at, updatedAt: c.updated_at }))
            });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/trello/:instanceId/cards
app.get('/api/mega-outils/trello/:instanceId/cards', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            'SELECT * FROM mega_outil_trello_cards WHERE instance_id = ? ORDER BY order_index ASC, created_at ASC',
            [req.params.instanceId]
        );
        res.json(rows.map(c => ({ id: c.id, instanceId: c.instance_id, title: c.title,
            description: c.description || undefined, status: c.status, priority: c.priority,
            orderIndex: c.order_index, creatorId: c.creator_id || undefined,
            creatorName: c.creator_name || undefined, createdAt: c.created_at, updatedAt: c.updated_at })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/trello/:instanceId/cards/reorder  (avant :cardId pour éviter conflit)
app.post('/api/mega-outils/trello/:instanceId/cards/reorder', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds requis' });
    try {
        for (let i = 0; i < orderedIds.length; i++) {
            await pool.query('UPDATE mega_outil_trello_cards SET order_index = ? WHERE id = ? AND instance_id = ?',
                [i, orderedIds[i], req.params.instanceId]);
        }
        broadcastTrelloUpdate(req.params.instanceId, 'card_reorder');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/trello/:instanceId/cards
app.post('/api/mega-outils/trello/:instanceId/cards', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { title, description, status, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'title requis' });
    try {
        const [countRows] = await pool.query(
            'SELECT COUNT(*) AS cnt FROM mega_outil_trello_cards WHERE instance_id = ?', [req.params.instanceId]);
        const orderIndex = countRows[0].cnt;
        const id = require('crypto').randomUUID();
        await pool.query(
            `INSERT INTO mega_outil_trello_cards (id, instance_id, title, description, status, priority, order_index, creator_id, creator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.params.instanceId, title, description || null,
             status || 'todo', priority || 'medium', orderIndex,
             user.id || null, user.username || user.email || null]
        );
        const [rows] = await pool.query('SELECT * FROM mega_outil_trello_cards WHERE id = ?', [id]);
        const c = rows[0];
        broadcastTrelloUpdate(req.params.instanceId, 'card_create');
        res.status(201).json({ id: c.id, instanceId: c.instance_id, title: c.title,
            description: c.description || undefined, status: c.status, priority: c.priority,
            orderIndex: c.order_index, creatorId: c.creator_id || undefined,
            creatorName: c.creator_name || undefined, createdAt: c.created_at, updatedAt: c.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mega-outils/trello/:instanceId/cards/:cardId
app.patch('/api/mega-outils/trello/:instanceId/cards/:cardId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const fields = [];
    const vals   = [];
    const allowed = { title: req.body.title, description: req.body.description,
        status: req.body.status, priority: req.body.priority, order_index: req.body.orderIndex };
    for (const [k, v] of Object.entries(allowed)) {
        if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); }
    }
    if (!fields.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    try {
        vals.push(req.params.cardId, req.params.instanceId);
        await pool.query(`UPDATE mega_outil_trello_cards SET ${fields.join(', ')} WHERE id = ? AND instance_id = ?`, vals);
        const [rows] = await pool.query('SELECT * FROM mega_outil_trello_cards WHERE id = ?', [req.params.cardId]);
        if (!rows.length) return res.status(404).json({ error: 'Carte non trouvée' });
        const c = rows[0];
        broadcastTrelloUpdate(req.params.instanceId, 'card_update');
        res.json({ id: c.id, instanceId: c.instance_id, title: c.title,
            description: c.description || undefined, status: c.status, priority: c.priority,
            orderIndex: c.order_index, creatorId: c.creator_id || undefined,
            creatorName: c.creator_name || undefined, createdAt: c.created_at, updatedAt: c.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/trello/:instanceId/cards/:cardId
app.delete('/api/mega-outils/trello/:instanceId/cards/:cardId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        await pool.query('DELETE FROM mega_outil_trello_cards WHERE id = ? AND instance_id = ?',
            [req.params.cardId, req.params.instanceId]);
        broadcastTrelloUpdate(req.params.instanceId, 'card_delete');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// Mega-Outils — Mockup
// ============================================================

async function broadcastMockupUpdate(instanceId, action, projectId) {
    try {
        let pid = projectId;
        if (!pid && instanceId) {
            const [r] = await pool.query('SELECT project_id FROM mega_outil_instances WHERE id = ?', [instanceId]);
            pid = r[0]?.project_id;
        }
        if (pid) broadcastToProject(pid, 'mockup_update', { instanceId: instanceId || null, projectId: pid, action });
    } catch (e) { console.warn('[mega-outils] broadcastMockupUpdate failed:', e.message); }
}

function mapMockupElement(r) {
    return { id: r.id, instanceId: r.instance_id, type: r.type, x: r.x, y: r.y, width: r.width, height: r.height, label: r.label || '', createdAt: r.created_at, updatedAt: r.updated_at };
}

function mapMockupComment(r) {
    return { id: r.id, instanceId: r.instance_id, elementId: r.element_id, text: r.text, authorId: r.author_id || undefined, authorName: r.author_name || undefined, createdAt: r.created_at };
}

// GET /api/mega-outils/mockup/all
app.get('/api/mega-outils/mockup/all', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [instances] = await pool.query(`
            SELECT i.*, COALESCE(fp.title, fpm.display_name) AS project_name
            FROM mega_outil_instances i
            LEFT JOIN file_project_meta fpm ON fpm.id = i.project_id
            LEFT JOIN frank_projects fp ON fp.id = i.project_id COLLATE utf8mb4_unicode_ci
            WHERE i.type = 'mockup'
            ORDER BY i.created_at DESC
        `);
        const result = [];
        const configCache = new Map();
        for (const r of instances) {
            const [elements] = await pool.query('SELECT * FROM mega_outil_mockup_elements WHERE instance_id = ? ORDER BY created_at ASC', [r.id]);
            let folderName = null;
            try {
                if (!configCache.has(r.project_id)) configCache.set(r.project_id, await getProjectConfig(r.project_id));
                const cfg = configCache.get(r.project_id);
                if (cfg && r.folder_id && cfg.structure) folderName = findNodeById(cfg.structure, r.folder_id)?.name || null;
            } catch (_) {}
            result.push({
                instance: {
                    id: r.id, type: r.type, name: r.name, projectId: r.project_id,
                    outilId: r.outil_id || undefined, folderId: r.folder_id || undefined,
                    createdAt: r.created_at, updatedAt: r.updated_at,
                },
                elements: elements.map(mapMockupElement),
                projectName: r.project_name || r.project_id,
                folderName,
            });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/mockup/:instanceId/elements
app.get('/api/mega-outils/mockup/:instanceId/elements', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_mockup_elements WHERE instance_id = ? ORDER BY created_at ASC', [req.params.instanceId]);
        res.json(rows.map(mapMockupElement));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/mockup/:instanceId/elements
app.post('/api/mega-outils/mockup/:instanceId/elements', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { type, x, y, width, height, label } = req.body;
    try {
        const id = require('crypto').randomUUID();
        await pool.query(
            'INSERT INTO mega_outil_mockup_elements (id, instance_id, type, x, y, width, height, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, req.params.instanceId, type, x, y, width, height, label || '']
        );
        const [rows] = await pool.query('SELECT * FROM mega_outil_mockup_elements WHERE id = ?', [id]);
        broadcastMockupUpdate(req.params.instanceId, 'element_create');
        res.status(201).json(mapMockupElement(rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mega-outils/mockup/:instanceId/elements/:elementId
app.patch('/api/mega-outils/mockup/:instanceId/elements/:elementId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const allowed = ['x', 'y', 'width', 'height', 'label'];
    const sets = []; const vals = [];
    for (const k of allowed) {
        if (req.body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(req.body[k]); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Rien à mettre à jour' });
    vals.push(req.params.elementId, req.params.instanceId);
    try {
        await pool.query(`UPDATE mega_outil_mockup_elements SET ${sets.join(', ')} WHERE id = ? AND instance_id = ?`, vals);
        const [rows] = await pool.query('SELECT * FROM mega_outil_mockup_elements WHERE id = ?', [req.params.elementId]);
        if (!rows.length) return res.status(404).json({ error: 'Élément non trouvé' });
        res.json(mapMockupElement(rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/mockup/:instanceId/elements/:elementId
app.delete('/api/mega-outils/mockup/:instanceId/elements/:elementId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        await pool.query('DELETE FROM mega_outil_mockup_elements WHERE id = ? AND instance_id = ?', [req.params.elementId, req.params.instanceId]);
        broadcastMockupUpdate(req.params.instanceId, 'element_delete');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/mockup/:instanceId/comments
app.get('/api/mega-outils/mockup/:instanceId/comments', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_mockup_comments WHERE instance_id = ? ORDER BY created_at ASC', [req.params.instanceId]);
        res.json(rows.map(mapMockupComment));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/mockup/:instanceId/comments
app.post('/api/mega-outils/mockup/:instanceId/comments', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { elementId, text } = req.body;
    if (!elementId || !text?.trim()) return res.status(400).json({ error: 'elementId et text requis' });
    try {
        const id = require('crypto').randomUUID();
        await pool.query(
            'INSERT INTO mega_outil_mockup_comments (id, instance_id, element_id, text, author_id, author_name) VALUES (?, ?, ?, ?, ?, ?)',
            [id, req.params.instanceId, elementId, text.trim(), user.id || null, user.username || user.email || null]
        );
        const [rows] = await pool.query('SELECT * FROM mega_outil_mockup_comments WHERE id = ?', [id]);
        res.status(201).json(mapMockupComment(rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/mockup/:instanceId/comments/:commentId
app.delete('/api/mega-outils/mockup/:instanceId/comments/:commentId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        await pool.query('DELETE FROM mega_outil_mockup_comments WHERE id = ? AND instance_id = ?', [req.params.commentId, req.params.instanceId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/mockup/:projectName/diagram
app.get('/api/mega-outils/mockup/:projectName/diagram', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const pn = decodeURIComponent(req.params.projectName);
    try {
        const [conns] = await pool.query('SELECT * FROM mega_outil_mockup_connections WHERE project_name = ? ORDER BY created_at ASC', [pn]);
        const [pos] = await pool.query('SELECT * FROM mega_outil_mockup_diagram_positions WHERE project_name = ?', [pn]);
        res.json({
            connections: conns.map(r => ({ id: r.id, projectName: r.project_name, fromInstanceId: r.from_instance_id, toInstanceId: r.to_instance_id, label: r.label || undefined, createdAt: r.created_at })),
            positions: pos.map(r => ({ instanceId: r.instance_id, x: r.x, y: r.y }))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/mockup/:projectName/diagram/positions
app.post('/api/mega-outils/mockup/:projectName/diagram/positions', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const pn = decodeURIComponent(req.params.projectName);
    const { positions } = req.body;
    if (!Array.isArray(positions)) return res.status(400).json({ error: 'positions doit être un tableau' });
    try {
        for (const p of positions) {
            await pool.query(
                'INSERT INTO mega_outil_mockup_diagram_positions (instance_id, project_name, x, y) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE x = VALUES(x), y = VALUES(y)',
                [p.instanceId, pn, p.x, p.y]
            );
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/mockup/:projectName/connections
app.post('/api/mega-outils/mockup/:projectName/connections', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const pn = decodeURIComponent(req.params.projectName);
    const { fromInstanceId, toInstanceId, label } = req.body;
    if (!fromInstanceId || !toInstanceId) return res.status(400).json({ error: 'fromInstanceId et toInstanceId requis' });
    try {
        const id = require('crypto').randomUUID();
        await pool.query(
            'INSERT INTO mega_outil_mockup_connections (id, project_name, from_instance_id, to_instance_id, label) VALUES (?, ?, ?, ?, ?)',
            [id, pn, fromInstanceId, toInstanceId, label || null]
        );
        const [rows] = await pool.query('SELECT * FROM mega_outil_mockup_connections WHERE id = ?', [id]);
        const r = rows[0];
        res.status(201).json({ id: r.id, projectName: r.project_name, fromInstanceId: r.from_instance_id, toInstanceId: r.to_instance_id, label: r.label || undefined, createdAt: r.created_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/mockup/:projectName/connections/:connId
app.delete('/api/mega-outils/mockup/:projectName/connections/:connId', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const pn = decodeURIComponent(req.params.projectName);
    try {
        await pool.query('DELETE FROM mega_outil_mockup_connections WHERE id = ? AND project_name = ?', [req.params.connId, pn]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ARRAY (Tableur) ───────────────────────────────────────────────────────────

async function broadcastArrayUpdate(instanceId, action, projectId) {
    try {
        let pid = projectId;
        if (!pid && instanceId) {
            const [r] = await pool.query('SELECT project_id FROM mega_outil_instances WHERE id = ?', [instanceId]);
            pid = r[0]?.project_id;
        }
        if (pid) broadcastToProject(pid, 'array_update', { instanceId: instanceId || null, projectId: pid, action });
    } catch (e) { console.warn('[mega-outils] broadcastArrayUpdate failed:', e.message); }
}

function emptyGrid(colCount = 3, rowCount = 5) {
    const cells = Array.from({ length: rowCount }, () =>
        Array.from({ length: colCount }, () => ({ value: '' }))
    );
    const colWidths  = Array(colCount).fill(100);
    const rowHeights = Array(rowCount).fill(28);
    return { cells, colWidths, rowHeights, colCount, rowCount };
}

// GET /api/mega-outils/array/all
app.get('/api/mega-outils/array/all', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(`
            SELECT i.*, g.cells, g.col_widths, g.row_heights, g.col_count, g.row_count, g.updated_at AS grid_updated_at,
                   COALESCE(fp.title, fpm.display_name) AS project_name
            FROM mega_outil_instances i
            LEFT JOIN mega_outil_array_grids g ON g.instance_id = i.id
            LEFT JOIN file_project_meta fpm ON fpm.id = i.project_id
            LEFT JOIN frank_projects fp ON fp.id = i.project_id COLLATE utf8mb4_unicode_ci
            WHERE i.type = 'array'
            ORDER BY i.created_at DESC
        `);
        const result = [];
        const configCache = new Map();
        for (const r of rows) {
            let folderName = null;
            try {
                if (!configCache.has(r.project_id)) configCache.set(r.project_id, await getProjectConfig(r.project_id));
                const cfg = configCache.get(r.project_id);
                if (cfg && r.folder_id && cfg.structure) folderName = findNodeById(cfg.structure, r.folder_id)?.name || null;
            } catch (_) {}
            result.push({
                instance: {
                    id: r.id, type: r.type, name: r.name, projectId: r.project_id,
                    outilId: r.outil_id, folderId: r.folder_id,
                    createdAt: r.created_at, updatedAt: r.updated_at,
                },
                grid: r.cells ? {
                    instanceId: r.id,
                    cells: JSON.parse(r.cells),
                    colWidths: JSON.parse(r.col_widths || '[]'),
                    rowHeights: JSON.parse(r.row_heights || '[]'),
                    colCount: r.col_count || 3,
                    rowCount: r.row_count || 5,
                    updatedAt: r.grid_updated_at,
                } : null,
                projectName: r.project_name || r.project_id,
                folderName,
            });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/array/:instanceId/grid
app.get('/api/mega-outils/array/:instanceId/grid', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        if (rows.length === 0) {
            const g = emptyGrid();
            await pool.query(
                'INSERT INTO mega_outil_array_grids (instance_id, cells, col_widths, row_heights, col_count, row_count) VALUES (?,?,?,?,?,?)',
                [instanceId, JSON.stringify(g.cells), JSON.stringify(g.colWidths), JSON.stringify(g.rowHeights), g.colCount, g.rowCount]
            );
            return res.json({ instanceId, ...g, updatedAt: new Date().toISOString() });
        }
        const r = rows[0];
        res.json({
            instanceId,
            cells: JSON.parse(r.cells),
            colWidths: JSON.parse(r.col_widths || '[]'),
            rowHeights: JSON.parse(r.row_heights || '[]'),
            colCount: r.col_count,
            rowCount: r.row_count,
            updatedAt: r.updated_at,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/mega-outils/array/:instanceId/grid
app.put('/api/mega-outils/array/:instanceId/grid', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    const { cells, colWidths, rowHeights, colCount, rowCount } = req.body;
    try {
        await pool.query(`
            INSERT INTO mega_outil_array_grids (instance_id, cells, col_widths, row_heights, col_count, row_count)
            VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE cells=VALUES(cells), col_widths=VALUES(col_widths),
              row_heights=VALUES(row_heights), col_count=VALUES(col_count), row_count=VALUES(row_count)
        `, [instanceId, JSON.stringify(cells), JSON.stringify(colWidths), JSON.stringify(rowHeights), colCount, rowCount]);
        await broadcastArrayUpdate(instanceId, 'update', null);
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        const r = rows[0];
        res.json({
            instanceId,
            cells: JSON.parse(r.cells),
            colWidths: JSON.parse(r.col_widths || '[]'),
            rowHeights: JSON.parse(r.row_heights || '[]'),
            colCount: r.col_count,
            rowCount: r.row_count,
            updatedAt: r.updated_at,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mega-outils/array/:instanceId/cell
app.patch('/api/mega-outils/array/:instanceId/cell', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    const { row, col, cell } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        let g;
        if (rows.length === 0) { g = emptyGrid(); }
        else {
            const r = rows[0];
            g = {
                cells: JSON.parse(r.cells),
                colWidths: JSON.parse(r.col_widths || '[]'),
                rowHeights: JSON.parse(r.row_heights || '[]'),
                colCount: r.col_count,
                rowCount: r.row_count,
            };
        }
        if (g.cells[row] && g.cells[row][col] !== undefined) {
            g.cells[row][col] = cell;
        }
        await pool.query(`
            INSERT INTO mega_outil_array_grids (instance_id, cells, col_widths, row_heights, col_count, row_count)
            VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE cells=VALUES(cells)
        `, [instanceId, JSON.stringify(g.cells), JSON.stringify(g.colWidths), JSON.stringify(g.rowHeights), g.colCount, g.rowCount]);
        await broadcastArrayUpdate(instanceId, 'cell_update', null);
        const [updated] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        const ur = updated[0];
        res.json({
            instanceId,
            cells: JSON.parse(ur.cells),
            colWidths: JSON.parse(ur.col_widths || '[]'),
            rowHeights: JSON.parse(ur.row_heights || '[]'),
            colCount: ur.col_count,
            rowCount: ur.row_count,
            updatedAt: ur.updated_at,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/array/:instanceId/grid/addRow
app.post('/api/mega-outils/array/:instanceId/grid/addRow', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        let g = rows.length === 0 ? emptyGrid() : {
            cells: JSON.parse(rows[0].cells),
            colWidths: JSON.parse(rows[0].col_widths || '[]'),
            rowHeights: JSON.parse(rows[0].row_heights || '[]'),
            colCount: rows[0].col_count,
            rowCount: rows[0].row_count,
        };
        g.cells.push(Array(g.colCount).fill(null).map(() => ({ value: '' })));
        g.rowHeights.push(28);
        g.rowCount++;
        await pool.query(`
            INSERT INTO mega_outil_array_grids (instance_id, cells, col_widths, row_heights, col_count, row_count)
            VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE cells=VALUES(cells), row_heights=VALUES(row_heights), row_count=VALUES(row_count)
        `, [instanceId, JSON.stringify(g.cells), JSON.stringify(g.colWidths), JSON.stringify(g.rowHeights), g.colCount, g.rowCount]);
        await broadcastArrayUpdate(instanceId, 'add_row', null);
        const [updated] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        const ur = updated[0];
        res.json({ instanceId, cells: JSON.parse(ur.cells), colWidths: JSON.parse(ur.col_widths || '[]'), rowHeights: JSON.parse(ur.row_heights || '[]'), colCount: ur.col_count, rowCount: ur.row_count, updatedAt: ur.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/array/:instanceId/grid/addCol
app.post('/api/mega-outils/array/:instanceId/grid/addCol', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        let g = rows.length === 0 ? emptyGrid() : {
            cells: JSON.parse(rows[0].cells),
            colWidths: JSON.parse(rows[0].col_widths || '[]'),
            rowHeights: JSON.parse(rows[0].row_heights || '[]'),
            colCount: rows[0].col_count,
            rowCount: rows[0].row_count,
        };
        g.cells.forEach(row => row.push({ value: '' }));
        g.colWidths.push(100);
        g.colCount++;
        await pool.query(`
            INSERT INTO mega_outil_array_grids (instance_id, cells, col_widths, row_heights, col_count, row_count)
            VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE cells=VALUES(cells), col_widths=VALUES(col_widths), col_count=VALUES(col_count)
        `, [instanceId, JSON.stringify(g.cells), JSON.stringify(g.colWidths), JSON.stringify(g.rowHeights), g.colCount, g.rowCount]);
        await broadcastArrayUpdate(instanceId, 'add_col', null);
        const [updated] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        const ur = updated[0];
        res.json({ instanceId, cells: JSON.parse(ur.cells), colWidths: JSON.parse(ur.col_widths || '[]'), rowHeights: JSON.parse(ur.row_heights || '[]'), colCount: ur.col_count, rowCount: ur.row_count, updatedAt: ur.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/array/:instanceId/grid/row/:row
app.delete('/api/mega-outils/array/:instanceId/grid/row/:row', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    const rowIdx = parseInt(req.params.row, 10);
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Grille introuvable' });
        const g = {
            cells: JSON.parse(rows[0].cells),
            colWidths: JSON.parse(rows[0].col_widths || '[]'),
            rowHeights: JSON.parse(rows[0].row_heights || '[]'),
            colCount: rows[0].col_count,
            rowCount: rows[0].row_count,
        };
        if (rowIdx >= 0 && rowIdx < g.cells.length && g.cells.length > 1) {
            g.cells.splice(rowIdx, 1);
            if (g.rowHeights.length > rowIdx) g.rowHeights.splice(rowIdx, 1);
            g.rowCount = g.cells.length;
        }
        await pool.query('UPDATE mega_outil_array_grids SET cells=?, row_heights=?, row_count=? WHERE instance_id=?',
            [JSON.stringify(g.cells), JSON.stringify(g.rowHeights), g.rowCount, instanceId]);
        await broadcastArrayUpdate(instanceId, 'delete_row', null);
        const [updated] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        const ur = updated[0];
        res.json({ instanceId, cells: JSON.parse(ur.cells), colWidths: JSON.parse(ur.col_widths || '[]'), rowHeights: JSON.parse(ur.row_heights || '[]'), colCount: ur.col_count, rowCount: ur.row_count, updatedAt: ur.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/array/:instanceId/grid/col/:col
app.delete('/api/mega-outils/array/:instanceId/grid/col/:col', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { instanceId } = req.params;
    const colIdx = parseInt(req.params.col, 10);
    try {
        const [rows] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Grille introuvable' });
        const g = {
            cells: JSON.parse(rows[0].cells),
            colWidths: JSON.parse(rows[0].col_widths || '[]'),
            rowHeights: JSON.parse(rows[0].row_heights || '[]'),
            colCount: rows[0].col_count,
            rowCount: rows[0].row_count,
        };
        if (colIdx >= 0 && colIdx < g.colCount && g.colCount > 1) {
            g.cells.forEach(row => row.splice(colIdx, 1));
            if (g.colWidths.length > colIdx) g.colWidths.splice(colIdx, 1);
            g.colCount = g.cells[0]?.length || 0;
        }
        await pool.query('UPDATE mega_outil_array_grids SET cells=?, col_widths=?, col_count=? WHERE instance_id=?',
            [JSON.stringify(g.cells), JSON.stringify(g.colWidths), g.colCount, instanceId]);
        await broadcastArrayUpdate(instanceId, 'delete_col', null);
        const [updated] = await pool.query('SELECT * FROM mega_outil_array_grids WHERE instance_id = ?', [instanceId]);
        const ur = updated[0];
        res.json({ instanceId, cells: JSON.parse(ur.cells), colWidths: JSON.parse(ur.col_widths || '[]'), rowHeights: JSON.parse(ur.row_heights || '[]'), colCount: ur.col_count, rowCount: ur.row_count, updatedAt: ur.updated_at });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// Mega-Outils — PROMPT
// ============================================================

async function broadcastPromptUpdate(instanceId, action, projectId) {
    try {
        let pid = projectId;
        if (!pid && instanceId) {
            const [r] = await pool.query('SELECT project_id FROM mega_outil_instances WHERE id = ?', [instanceId]);
            pid = r[0]?.project_id;
        }
        if (pid) broadcastToProject(pid, 'prompt_update', { instanceId: instanceId || null, projectId: pid, action });
    } catch (e) { console.warn('[mega-outils] broadcastPromptUpdate failed:', e.message); }
}

// GET /api/mega-outils/prompt/all
app.get('/api/mega-outils/prompt/all', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(`
            SELECT i.*, COALESCE(fp.title, fpm.display_name) AS project_name
            FROM mega_outil_instances i
            LEFT JOIN file_project_meta fpm ON fpm.id = i.project_id
            LEFT JOIN frank_projects fp ON fp.id = i.project_id COLLATE utf8mb4_unicode_ci
            WHERE i.type = 'prompt'
            ORDER BY i.created_at DESC
        `);
        const result = [];
        const configCache = new Map();
        for (const r of rows) {
            let folderName = null;
            try {
                if (!configCache.has(r.project_id)) configCache.set(r.project_id, await getProjectConfig(r.project_id));
                const cfg = configCache.get(r.project_id);
                if (cfg && r.folder_id && cfg.structure) folderName = findNodeById(cfg.structure, r.folder_id)?.name || null;
            } catch (_) {}
            result.push({
                instance: {
                    id: r.id, type: r.type, name: r.name, projectId: r.project_id,
                    outilId: r.outil_id, folderId: r.folder_id,
                    createdAt: r.created_at, updatedAt: r.updated_at,
                },
                projectName: r.project_name || r.project_id,
                folderName,
            });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sessions de tchat (mode Tchat du MO Prompt) ──────────────────────────────

// POST /api/mega-outils/prompt/:instanceId/chat-session — crée une nouvelle session
app.post('/api/mega-outils/prompt/:instanceId/chat-session', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { provider, model } = req.body || {};
    const id = `mpcs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
        await pool.query(
            'INSERT INTO mega_outil_prompt_chat_sessions (id, instance_id, provider, model, created_by) VALUES (?,?,?,?,?)',
            [id, req.params.instanceId, provider || 'claude', model || null, user.id]
        );
        res.json({ id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mega-outils/prompt/chat-session/:sessionId/message — ajoute un message
app.post('/api/mega-outils/prompt/chat-session/:sessionId/message', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { role, text, seq } = req.body || {};
    if (!role || text == null || seq == null) return res.status(400).json({ error: 'role, text, seq requis' });
    const id = `mpcm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
        await pool.query(
            'INSERT INTO mega_outil_prompt_chat_messages (id, session_id, role, text, seq) VALUES (?,?,?,?,?)',
            [id, req.params.sessionId, role, text, seq]
        );
        await pool.query('UPDATE mega_outil_prompt_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.sessionId]);
        res.json({ id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/prompt/:instanceId/chat-sessions — liste des sessions (reprise)
app.get('/api/mega-outils/prompt/:instanceId/chat-sessions', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            'SELECT id, provider, model, created_at, updated_at FROM mega_outil_prompt_chat_sessions WHERE instance_id = ? ORDER BY updated_at DESC LIMIT 20',
            [req.params.instanceId]
        );
        res.json(rows.map(r => ({
            id: r.id, provider: r.provider, model: r.model,
            createdAt: r.created_at, updatedAt: r.updated_at,
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/prompt/chat-session/:sessionId/messages — messages d'une session (reprise)
app.get('/api/mega-outils/prompt/chat-session/:sessionId/messages', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            'SELECT role, text FROM mega_outil_prompt_chat_messages WHERE session_id = ? ORDER BY seq ASC',
            [req.params.sessionId]
        );
        res.json(rows.map(r => ({ role: r.role, text: r.text })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/prompt/:instanceId/chat-sessions — efface tout l'historique de tchat
// (toutes les sessions + messages) d'une instance Prompt. Pas de contrainte FK sur ces tables
// (juste un index) → suppression explicite des messages avant les sessions.
app.delete('/api/mega-outils/prompt/:instanceId/chat-sessions', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [sessions] = await pool.query(
            'SELECT id FROM mega_outil_prompt_chat_sessions WHERE instance_id = ?',
            [req.params.instanceId]
        );
        const ids = sessions.map(s => s.id);
        if (ids.length > 0) {
            await pool.query('DELETE FROM mega_outil_prompt_chat_messages WHERE session_id IN (?)', [ids]);
            await pool.query('DELETE FROM mega_outil_prompt_chat_sessions WHERE id IN (?)', [ids]);
        }
        res.json({ deleted: ids.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mega-outils/prompt/:instanceId/history
app.get('/api/mega-outils/prompt/:instanceId/history', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            'SELECT * FROM mega_outil_prompt_history WHERE instance_id = ? ORDER BY executed_at DESC LIMIT 20',
            [req.params.instanceId]
        );
        res.json(rows.map(r => ({
            id: r.id, instanceId: r.instance_id,
            userPrompt: r.user_prompt, systemPrompt: r.system_prompt,
            result: r.result, provider: r.provider, model: r.model,
            executedBy: r.executed_by, executedAt: r.executed_at,
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Méta-prompts par défaut du workflow guidé (cadrage + génération). Servis si la clé
// BDD est absente. Modifiables dans Admin › Mega-outils › Prompt.
const DEFAULT_WORKFLOW_CLARIFY_PROMPT = `Tu es un assistant de cadrage. Ton rôle : avant de produire quoi que ce soit, poser UNIQUEMENT les questions nécessaires pour cerner précisément le besoin de l'utilisateur.

RÈGLES DE SORTIE (strictes, aucune autre forme acceptée) :
- Si tu as besoin d'informations, réponds EXCLUSIVEMENT par un formulaire Markdown au format :
    * **Intitulé de la question :**
      * [ ] Option (choix multiple : plusieurs cases possibles)
      * ( ) Option (choix unique : une seule possible)
  Pour une réponse libre, insère « ______ » dans l'option (ex : « Autre : ______ »).
- Pose 3 à 8 questions max, regroupées logiquement, chacune avec au moins 2 options.
- Ne propose AUCUN texte hors du formulaire (pas d'intro, pas de conclusion).
- Concentre-toi sur les PARAMÈTRES (niveau, durée, objectifs, format, contraintes, public…), jamais sur le contenu final.
- Si — et seulement si — tu disposes déjà de tout le nécessaire pour produire un livrable précis, réponds par la ligne unique : ===PRÊT===

DÉTECTION DU TYPE DE PROJET :
Avant de poser des questions, qualifie mentalement le projet dans l'une de ces deux catégories :

TYPE A — FORMATION / APPRENTISSAGE : cours, programme pédagogique, coaching, préparation à un examen, plan d'entraînement… Le but est d'APPRENDRE ou d'ENSEIGNER quelque chose.
→ Questions spécifiques à ajouter : durée et date de début, fréquence des séances, niveau de départ + objectif mesurable, modalités d'évaluation (notes /20, QCM, auto-évaluation), points prioritaires à travailler.

TYPE B — PROJET OPÉRATIONNEL : création d'entreprise, business plan, projet immobilier, lancement d'un produit, chantier, campagne, événement, gestion de projet… Le but est de RÉALISER quelque chose.
→ Questions spécifiques à ajouter : horizon temporel et date de démarrage, étapes ou jalons clés, contraintes principales (budget, réglementation, ressources), critères de succès mesurables, risques ou blocages anticipés.

NE MÉLANGE PAS les deux types : un projet maison d'hôte, une création d'entreprise ou un business plan est TOUJOURS un projet opérationnel (Type B), même s'il s'étale sur plusieurs mois. Ne demande JAMAIS de modalités d'évaluation académiques pour un projet opérationnel.`;

const DEFAULT_WORKFLOW_GENERATE_PROMPT = `Tu produis maintenant le livrable final à partir du besoin et des réponses fournies.

RÈGLES DE SORTIE :
- Produis directement le livrable structuré en Markdown (titres ##, ###, listes…).
- Matérialise les éléments pertinents dans des « MegaOutils » avec EXACTEMENT ces syntaxes, délimités par des fences \`\`\` :

  • Tableau Kanban (tâches, actions, avancement) :
    \`\`\`TRELLO: Nom du tableau
    ### À faire
    - [ ] Titre de la carte \`[medium]\`
      Description optionnelle
    ### En cours
    ### Terminé
    \`\`\`
    statuts : « À faire » | « En cours » | « Terminé » | « Bloqué » ; priorités (entre backticks) : low | medium | high | critical

  • Tableau de données (planning, suivi, comparatif, grille) :
    \`\`\`ARRAY: Nom du tableau
    | Colonne 1 | Colonne 2 |
    |-----------|-----------|
    | valeur    | valeur    |
    \`\`\`
    Formules supportées dans les cellules : =SUM(A2:A10), =AVG(A2:A10), =COUNT(A2:A10), =MAX(A2:A10), =MIN(A2:A10), =A1/B1*100, etc.

  • Formulaire (questionnaire, validation, décision, quiz) :
    \`\`\`FORM: Nom du formulaire
    * **Question :**
      * [ ] Option (choix multiple)
      * ( ) Option (choix unique)
    \`\`\`

  • Agenda (événements datés, jalons, réunions, séances) :
    \`\`\`AGENDA: Nom de l'agenda
    YYYY-MM-DD | HH:MM-HH:MM | Titre de l'événement | Description optionnelle
    \`\`\`

  • Graphique de progression (courbe d'évolution numérique) :
    \`\`\`CHART: Titre du graphique
    source: Nom du tableau | col: Nom de la colonne
    \`\`\`
    Référence une colonne numérique d'un tableau ARRAY existant. Ou valeurs inline :
    \`\`\`CHART: Titre
    Étape 1: 40
    Étape 2: 65
    \`\`\`

- N'utilise AUCUN autre bloc de code que ces cinq MegaOutils.
- Donne des noms courts et uniques à chaque MegaOutil.
- RÈGLE ABSOLUE : n'inclus un MegaOutil que s'il apporte une valeur réelle pour le projet décrit. Un tableau de suivi des notes ou un graphique de progression de notes n'a de sens que dans un contexte pédagogique.

────────────────────────────────────────────────────────────────
DÉTERMINE D'ABORD LE TYPE DE PROJET :

TYPE A — FORMATION / APPRENTISSAGE : cours, programme pédagogique, coaching, entraînement sportif, préparation à un examen, plan d'apprentissage d'une langue…
→ Le but est d'apprendre ou d'enseigner. Les notes, exercices et progression ont du sens.

TYPE B — PROJET OPÉRATIONNEL : création d'entreprise, business plan, projet immobilier, maison d'hôte, lancement de produit, chantier, campagne marketing, événementiel, démarche administrative…
→ Le but est de réaliser quelque chose de concret. Les exercices académiques et les notes /20 n'ont AUCUN sens.

NE MÉLANGE JAMAIS les deux types. Si le projet concerne une maison d'hôte, une création d'activité, un business plan ou tout projet professionnel/immobilier : c'est TOUJOURS le Type B, même s'il s'étale sur plusieurs mois.
────────────────────────────────────────────────────────────────

DISPOSITIF TYPE A — FORMATION / APPRENTISSAGE :
(Utilise ce dispositif UNIQUEMENT pour les formations, cours, programmes pédagogiques)

STRUCTURE OBLIGATOIRE — le cours DOIT être découpé en plusieurs sections (chaque titre \`##\` devient un dossier navigable). Respecte EXACTEMENT cet ordre et ces titres :

═══ A) EN PREMIER, une seule section de pilotage ═══
\`## 📊 Bilan général et suivi du cours\`
Cette section centralise TOUT le suivi global. Elle contient, dans cet ordre :

  1. \`\`\`ARRAY: Planning
     Colonnes : Séance | Date | Thème | Objectif | Statut
     Une ligne par séance, dates réelles calculées depuis la date de début + la fréquence.

  2. \`\`\`AGENDA: Séances
     Une entrée par séance. IMPÉRATIF : le titre de chaque événement doit être STRICTEMENT IDENTIQUE au titre de la séance correspondante (« Séance N — Thème »), pour permettre le lien agenda → dossier.

  3. \`\`\`ARRAY: Suivi des notes
     Colonnes : Séance | Date | Note | Max | % | Moyenne
     Une ligne par séance, dans le MÊME ordre que le planning. Laisse les colonnes Note, % et Moyenne VIDES au départ : elles seront remplies automatiquement après correction des QCM.
     Formules : =D2/E2*100 pour le %, =AVG(D2:D20) pour la moyenne.

  4. \`\`\`CHART: Progression des notes
     source: Suivi des notes | col: Note

  5. (optionnel) \`\`\`TRELLO: Avancement\`\`\` pour le suivi des tâches/séances.

═══ B) PUIS une section par séance ═══
Pour CHAQUE séance, un titre \`## Séance N — YYYY-MM-DD : Thème\` (date réelle de la séance), au niveau 2 EXACTEMENT (deux #). Chaque section de séance contient :
  - Le **contenu du cours** de la séance : explication pédagogique structurée du thème (texte, exemples, points clés).
  - **UN QCM d'exercices** : un bloc \`\`\`FORM: QCM Séance N avec 3 à 6 questions à choix.
    FORMAT OBLIGATOIRE du QCM (respecte-le À LA LETTRE, chaque option commence par « * ( ) » pour un choix unique ou « * [ ] » pour un choix multiple) :
    \`\`\`FORM: QCM Séance 1
    * **Question 1 : énoncé de la question ?**
      * ( ) Première proposition
      * ( ) Deuxième proposition
      * ( ) Troisième proposition
    * **Question 2 : autre énoncé ?**
      * [ ] Proposition A
      * [ ] Proposition B
    \`\`\`
    CHAQUE question DOIT avoir au moins 2 options en \`( )\` ou \`[ ]\`. N'écris JAMAIS une question sans ses options de réponse.

RÈGLES STRICTES :
- Les MegaOutils de pilotage (Planning, Agenda, Suivi des notes, Progression, Avancement) vont UNIQUEMENT dans « 📊 Bilan général et suivi du cours », JAMAIS dans une séance.
- Le QCM va UNIQUEMENT dans sa séance, JAMAIS dans le Bilan.
- Le titre d'une séance et le titre de son événement agenda doivent être rigoureusement identiques.
- Ne fusionne pas plusieurs séances dans un même titre : une séance = un titre \`##\` = un dossier.

────────────────────────────────────────────────────────────────

DISPOSITIF TYPE B — PROJET OPÉRATIONNEL :
(Utilise ce dispositif pour TOUT projet de création, réalisation, déploiement, gestion…)

1. **Planning** → \`\`\`ARRAY: Planning
   Colonnes adaptées au contexte, exemples :
   - Projet création : N° | Date | Étape | Objectif | Livrable | Statut
   - Projet immobilier/maison d'hôte : N° | Date | Phase | Actions | Intervenants | Statut
   - Business plan : N° | Date | Thème | Livrables | Responsable | Statut
   Remplis les lignes avec les vraies étapes du projet aux bonnes dates.

2. **Agenda** → \`\`\`AGENDA: Jalons
   Jalons clés, réunions importantes, échéances réglementaires ou financières.

3. **Suivi (adapté)** → \`\`\`ARRAY: Suivi [contexte]\`\`\`
   Tableau de suivi pertinent pour le projet, exemples :
   - Maison d'hôte : Indicateur | Cible | Valeur actuelle | Écart (taux d'occupation, CA prévisionnel…)
   - Création d'entreprise : Démarche | Organisme | Statut | Date limite
   - Chantier : Poste | Budget prévu | Dépensé | Restant
   N'inclus ce tableau QUE s'il apporte une vraie valeur de suivi. Adapte TOUJOURS les colonnes au projet réel.

4. (optionnel) \`\`\`TRELLO: Avancement\`\`\` avec les actions concrètes à mener.

5. (optionnel) \`\`\`FORM: Validation [Étape]\`\`\` pour les points de décision ou checks critiques.
   NE NOMME PAS ces formulaires "Exercices". Ce sont des validations ou questionnaires de décision.

6. (optionnel) \`\`\`CHART: Évolution [indicateur]\`\`\` UNIQUEMENT si un indicateur numérique mérite d'être suivi graphiquement (CA, budget consommé, taux d'occupation…). Si aucun indicateur n'est pertinent, n'en crée pas.

────────────────────────────────────────────────────────────────

ADAPTATION (si un [État actuel du projet] est fourni) :
- ANALYSE l'état réel : réponses aux formulaires, données des tableaux, avancement Trello.
- TYPE A : identifie les thèmes avec notes basses → propose des séances de remédiation.
- TYPE B : identifie les étapes en retard ou bloquées → propose des ajustements du planning.
- Ne recrée PAS les MegaOutils existants — propose UNIQUEMENT les ajustements nécessaires sur les éléments futurs non encore réalisés.`;

const DEFAULT_CHAT_STRUCTURED_PROMPT = `Tu discutes en mode conversationnel libre, mais l'application sait transformer certaines réponses en éléments interactifs (formulaire cliquable, tableau, kanban, agenda, graphique) SI tu utilises exactement les syntaxes ci-dessous. Applique-les systématiquement dès que la situation correspond — ne réponds jamais par de simples questions en texte libre ou une liste à puces quand l'une de ces syntaxes s'applique.

- **Dès que tu poses une ou plusieurs questions à l'utilisateur** (recueil d'informations, profil, préférences, cadrage d'un besoin…), formate CHAQUE question ainsi, sans exception :
    \`**Intitulé exact de la question ?**\`
    \`_____\`
  (le label en gras suivi, sur la ligne d'après, d'exactement une ligne de 5 underscores ou plus — rien d'autre sur cette ligne). Une ligne vide entre deux questions.
  Si la question attend un choix parmi des options plutôt qu'une réponse libre, remplace la ligne d'underscores par une liste \`- [ ] Option\` (choix multiple) ou \`- ( ) Option\` (choix unique) — jamais de simple liste à puces \`-\` sans case.
- Un tableau Kanban (tâches, avancement) : \`\`\`TRELLO: Nom\`\`\` avec les mêmes conventions que le mode Workflow guidé (colonnes \`### À faire/En cours/Terminé\`, cartes \`- [ ] Titre \`[priorité]\`\`).
- **Dès que la réponse contient des données structurées en lignes/colonnes** (comparatif, profil, récapitulatif, liste de caractéristiques…), formate-la EXACTEMENT ainsi, sans exception :
    \`\`\`ARRAY: Nom du tableau
    | Colonne A | Colonne B |
    | --- | --- |
    | Valeur 1 | Valeur 2 |
    | Valeur 3 | Valeur 4 |
    \`\`\`
  (fence \`\`\`ARRAY: ouvrant avec le nom sur la même ligne, tableau Markdown à pipes \`|\` avec ligne de séparation \`| --- | --- |\`, fence \`\`\`\` fermant seul sur sa ligne). **Jamais** de tableau en texte brut sans les \`|\`, jamais sans les fences \`\`\`ARRAY:\`\`\`/\`\`\`\` — un texte aligné en colonnes sans cette syntaxe ne sera pas reconnu par l'application.
- Un agenda (événements datés) : \`\`\`AGENDA: Nom\`\`\` avec des lignes \`YYYY-MM-DD | HH:MM-HH:MM | Titre | Description\`.
- Un graphique de progression : \`\`\`CHART: Titre\`\`\` avec des lignes \`Label: valeur\`.

En dehors de ces cas précis, réponds normalement en texte libre et conversationnel.`;

// GET /api/mega-outils/prompt/config — Prompts globaux (base + cadrage + génération du workflow guidé + tchat)
app.get('/api/mega-outils/prompt/config', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        const [rows] = await pool.query(
            "SELECT key_name, value FROM mega_outil_prompt_config WHERE key_name IN ('base_system_prompt', 'workflow_clarify_prompt', 'workflow_generate_prompt', 'chat_structured_prompt')"
        );
        const map = {};
        for (const r of rows) map[r.key_name] = r.value;
        res.json({
            baseSystemPrompt: map['base_system_prompt'] || '',
            workflowClarifyPrompt: map['workflow_clarify_prompt'] || DEFAULT_WORKFLOW_CLARIFY_PROMPT,
            workflowGeneratePrompt: map['workflow_generate_prompt'] || DEFAULT_WORKFLOW_GENERATE_PROMPT,
            chatStructuredPrompt: map['chat_structured_prompt'] || DEFAULT_CHAT_STRUCTURED_PROMPT,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/mega-outils/prompt/config — Sauvegarder les prompts globaux (upsert par clé fournie)
app.put('/api/mega-outils/prompt/config', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { baseSystemPrompt, workflowClarifyPrompt, workflowGeneratePrompt, chatStructuredPrompt } = req.body;
    const upserts = [
        ['base_system_prompt', baseSystemPrompt],
        ['workflow_clarify_prompt', workflowClarifyPrompt],
        ['workflow_generate_prompt', workflowGeneratePrompt],
        ['chat_structured_prompt', chatStructuredPrompt],
    ].filter(([, v]) => v !== undefined);
    try {
        for (const [key, value] of upserts) {
            await pool.query(
                "INSERT INTO mega_outil_prompt_config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP",
                [key, value || '']
            );
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/prompt/config/workflow — Remet les méta-prompts cadrage+génération aux valeurs par défaut
app.delete('/api/mega-outils/prompt/config/workflow', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        await pool.query(
            "DELETE FROM mega_outil_prompt_config WHERE key_name IN ('workflow_clarify_prompt', 'workflow_generate_prompt')"
        );
        res.json({ ok: true, workflowClarifyPrompt: DEFAULT_WORKFLOW_CLARIFY_PROMPT, workflowGeneratePrompt: DEFAULT_WORKFLOW_GENERATE_PROMPT });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mega-outils/prompt/config/chat — Remet le prompt structuré du tchat à sa valeur par défaut
app.delete('/api/mega-outils/prompt/config/chat', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    try {
        await pool.query("DELETE FROM mega_outil_prompt_config WHERE key_name = 'chat_structured_prompt'");
        res.json({ ok: true, chatStructuredPrompt: DEFAULT_CHAT_STRUCTURED_PROMPT });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Store temporaire des prompts à exécuter (mécanisme prepare→stream). Évite de passer de gros
// prompts en query string d'URL (EventSource = GET) : au-delà de ~16 Ko d'en-tête, Node rejette
// la requête → flux SSE jamais établi (bug génération avec gros prompts). TTL 5 min.
const _promptExecJobs = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _promptExecJobs) if (now - v.createdAt > 5 * 60 * 1000) _promptExecJobs.delete(k);
}, 60000).unref?.();

// POST /api/mega-outils/prompt/execute-prepare — enregistre un prompt et renvoie un jobId à passer
// à execute-stream. Le corps POST n'a pas de limite d'en-tête → supporte des prompts volumineux.
app.post('/api/mega-outils/prompt/execute-prepare', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { systemPrompt, userPrompt, provider, model } = req.body || {};
    if (!userPrompt) return res.status(400).json({ error: 'userPrompt requis' });
    const jobId = require('crypto').randomUUID();
    _promptExecJobs.set(jobId, {
        systemPrompt: (systemPrompt || '').toString(),
        userPrompt: userPrompt.toString(),
        provider: (provider || 'claude').toString(),
        model: (model || '').toString(),
        userId: user.id,
        createdAt: Date.now()
    });
    res.json({ jobId });
});

// GET /api/mega-outils/prompt/execute-stream — Exécution SSE d'un prompt MO via l'executor local (port 3002).
// Claude → stdout streamé. Agy → fichier de sortie pollé (agy bufferise stdout sur Windows pipe).
// Événements nommés : start, ai-log {stream, text}, ai-error {message}, complete {text}, run-failed {message}
// Deux modes d'entrée : ?jobId=… (recommandé, gros prompts via prepare) OU params directs (legacy, petits prompts).
app.get('/api/mega-outils/prompt/execute-stream', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    let systemPrompt, userPrompt, provider, model;
    const jobId = (req.query.jobId || '').toString();
    if (jobId) {
        const job = _promptExecJobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Job de prompt introuvable ou expiré' });
        _promptExecJobs.delete(jobId); // usage unique
        ({ systemPrompt, userPrompt, provider, model } = job);
    } else {
        systemPrompt = (req.query.systemPrompt || '').toString();
        userPrompt   = (req.query.userPrompt   || '').toString();
        provider     = (req.query.provider     || 'claude').toString();
        model        = (req.query.model        || '').toString();
    }
    const isAgy = provider === 'antigravity' || provider === 'agy';

    if (!userPrompt) return res.status(400).json({ error: 'userPrompt requis' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sse = (event, payload) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`); };

    sse('start', { provider, model });

    const stepId  = `prompt-mo-${Date.now()}`;
    let content   = systemPrompt ? `[System]\n${systemPrompt}\n\n[User]\n${userPrompt}` : userPrompt;

    if (isAgy) {
        // Agy ne streame pas sur stdout (buffering pipe Windows) : on lui demande d'écrire sa réponse dans un fichier.
        let agyOutFile;
        try {
            const runDir = path.join(BASE_DIR, 'tests-admin', 'mo-runs', stepId);
            fs.mkdirSync(runDir, { recursive: true });
            agyOutFile = path.join(runDir, 'response.txt');
            fs.writeFileSync(agyOutFile, '', 'utf8');
        } catch (e) {
            sse('run-failed', { message: `Préparation fichier agy impossible : ${e.message}` });
            return res.end();
        }
        const of = agyOutFile.replace(/\\/g, '/');
        content += `\n\n---\nIMPORTANT : Écris ta réponse complète dans le fichier \`${of}\` en utilisant ton outil d'écriture de fichier. N'écris rien dans ta réponse texte.`;

        let lastSize = 0, fullText = '';
        const pollAgy = () => {
            try {
                const txt = fs.readFileSync(agyOutFile, 'utf8');
                if (txt.length > lastSize) {
                    const chunk = txt.slice(lastSize);
                    lastSize = txt.length;
                    fullText += chunk;
                    sse('ai-log', { stream: 'stdout', text: chunk });
                }
            } catch { /* ignore */ }
        };
        const agyPoller = setInterval(pollAgy, 1500);

        // Statut périodique : agy ne streame pas sur stdout (sortie fichier) → sans ce retour,
        // le client n'a AUCUNE visibilité pendant que le modèle réfléchit/écrit. On émet un état
        // toutes les 5s (temps écoulé + octets reçus dans le fichier de sortie).
        const agyStart = Date.now();
        const statusPoller = setInterval(() => {
            const elapsed = Math.round((Date.now() - agyStart) / 1000);
            sse('ai-log', { stream: 'info', text: lastSize > 0
                ? `agy en cours… ${elapsed}s — ${lastSize} octets reçus`
                : `agy en cours… ${elapsed}s — en attente de la réponse du modèle (rien écrit pour l'instant)` });
        }, 5000);

        callExecutorSse(sse, res, req,
            { stepId, content, provider, model, cwd: PROJECT_ROOT },
            { onEnd: () => {
                clearInterval(agyPoller);
                clearInterval(statusPoller);
                pollAgy();
                if (!fullText.trim()) {
                    sse('ai-log', { stream: 'stderr', text: `⚠ agy s'est terminé sans écrire dans le fichier de sortie. La réponse est vide — vérifie l'installation/authentification d'agy ou réessaie avec le provider Claude.` });
                }
                sse('complete', { text: fullText });
                res.end();
            }}
        );
    } else {
        callExecutorSse(sse, res, req, { stepId, content, provider, model });
    }
});

// POST /api/mega-outils/prompt/:instanceId/history
app.post('/api/mega-outils/prompt/:instanceId/history', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { userPrompt, systemPrompt, result, provider, model } = req.body;
    if (!userPrompt || !result) return res.status(400).json({ error: 'userPrompt et result requis' });
    const id = require('crypto').randomUUID();
    try {
        await pool.query(
            'INSERT INTO mega_outil_prompt_history (id, instance_id, user_prompt, system_prompt, result, provider, model, executed_by) VALUES (?,?,?,?,?,?,?,?)',
            [id, req.params.instanceId, userPrompt, systemPrompt || null, result, provider || 'claude', model || null, user.id]
        );
        await broadcastPromptUpdate(req.params.instanceId, 'history_add', null);
        res.json({ id, instanceId: req.params.instanceId, userPrompt, systemPrompt, result, provider, model, executedBy: user.id, executedAt: new Date().toISOString() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// ============================================================
// PROJETS-TESTS — Outil Tests (Cahier de recette + Exécution + Résultats)
// ============================================================

function projTestsDir(projectId) {
    return path.join(BASE_DIR, 'projets', projectId, 'tests');
}
function projTestsLoad(projectId, file) {
    const p = path.join(projTestsDir(projectId), file);
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { console.error('[PROJ-TESTS] load error:', p, e.message); }
    return null;
}
function projTestsSave(projectId, file, data) {
    const filePath = path.join(projTestsDir(projectId), file);
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) { console.error('[PROJ-TESTS] save error:', e.message); return false; }
}
function projTestsRunDir(projectId) { return path.join(projTestsDir(projectId), 'runs'); }
function projTestsLoadRun(projectId, runId) { return projTestsLoad(projectId, `runs/${runId}.json`); }
function projTestsSaveRun(projectId, runId, data) { return projTestsSave(projectId, `runs/${runId}.json`, data); }
function projTestsRunId() { return 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
function projTestsCaseId() { return 'tc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
function projTestsCatId() { return 'cat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6); }

function computeTestSummary(results, cases, startedAt) {
    const total = results.length;
    const pass = results.filter(r => r.status === 'pass').length;
    const fail = results.filter(r => r.status === 'fail').length;
    const skip = results.filter(r => r.status === 'skip').length;
    const pending = results.filter(r => r.status === 'pending').length;
    const countable = pass + fail;
    const score = countable > 0 ? Math.round((pass / countable) * 100) : 0;
    const hasBloquantFail = results.some(r => {
        if (r.status !== 'fail') return false;
        const tc = cases.find(c => c.id === r.caseId);
        return tc?.criticality === 'bloquant';
    });
    const goNoGo = hasBloquantFail ? 'NO-GO' : 'GO';
    const durationMs = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
    return { total, pass, fail, skip, pending, score, goNoGo, durationMs };
}

// GET /api/projets-tests/:id/suite
app.get('/api/projets-tests/:id/suite', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const id = req.params.id;
    let suite = projTestsLoad(id, 'suite.json');
    if (!suite) {
        suite = { projectId: id, categories: [], cases: [], updatedAt: new Date().toISOString() };
        projTestsSave(id, 'suite.json', suite);
    }
    res.json(suite);
});

// PUT /api/projets-tests/:id/suite
app.put('/api/projets-tests/:id/suite', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const id = req.params.id;
    const existing = projTestsLoad(id, 'suite.json') || { projectId: id, categories: [], cases: [] };
    const suite = { ...existing, ...req.body, projectId: id, updatedAt: new Date().toISOString() };
    if (projTestsSave(id, 'suite.json', suite)) res.json(suite);
    else res.status(500).json({ error: 'Erreur sauvegarde' });
});

// GET /api/projets-tests/:id/edition/sections
app.get('/api/projets-tests/:id/edition/sections', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const config = await getProjectConfig(req.params.id);
    if (!config) return res.status(404).json({ error: 'Projet non trouvé' });
    function collectFolders(nodes, depth) {
        const result = [];
        for (const node of nodes || []) {
            if (node.type === 'folder') {
                result.push({ id: node.id, name: node.name, depth: depth || 0 });
                result.push(...collectFolders(node.children, (depth || 0) + 1));
            }
        }
        return result;
    }
    res.json({ sections: collectFolders(config.structure) });
});

// POST /api/projets-tests/:id/suite/generate
app.post('/api/projets-tests/:id/suite/generate', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const id = req.params.id;
    const { source, sectionId, sectionName } = req.body;
    const now = new Date().toISOString();

    if (source === 'ia') {
        if (!sectionId) return res.json({ generated: [], message: 'Sélectionne une section d\'édition d\'abord.' });

        const config = await getProjectConfig(id);
        if (!config) return res.json({ generated: [], message: 'Projet non trouvé.' });
        const sectionNode = findNodeById(config.structure, sectionId);
        if (!sectionNode) return res.json({ generated: [], message: 'Section non trouvée.' });

        function collectMdPaths(node) {
            const paths = [];
            if (node.type === 'file' && node.path && node.name.endsWith('.md')) paths.push(node.path);
            for (const child of node.children || []) paths.push(...collectMdPaths(child));
            return paths;
        }

        const projDir = path.join(PROJECTS_DIR, id);
        const fileContents = [];
        for (const filePath of collectMdPaths(sectionNode)) {
            const abs = path.join(projDir, filePath);
            if (fs.existsSync(abs)) {
                try { fileContents.push(`### ${path.basename(filePath, '.md')}\n${fs.readFileSync(abs, 'utf8')}`); } catch {}
            }
        }

        if (!fileContents.length) return res.json({ generated: [], message: `Aucun fichier Markdown dans la section "${sectionName}".` });

        const prompt = `Tu es un expert QA. Analyse ce contenu de la section "${sectionName}" et génère une liste exhaustive de tests fonctionnels.

${fileContents.join('\n\n---\n\n')}

IMPORTANT : Retourne UNIQUEMENT un tableau JSON valide, sans aucun texte avant ou après :
[{"title":"Titre court actionnable","description":"Ce qui est vérifié en détail","criticality":"bloquant","steps":[{"order":1,"action":"Action précise à effectuer","expected":"Résultat attendu"}]}]

Règles :
- criticality : "bloquant" (bloque la livraison), "majeur" (fonctionnalité importante), "mineur" (edge case)
- Entre 3 et 15 tests, au minimum 1 étape par test
- Les titres doivent être courts et actionnables`;

        try {
            // Appel à l'executor local (port 3002) qui gère Claude CLI / Antigravity CLI (agy)
            const executorBody = JSON.stringify({ content: prompt });
            const output = await new Promise((resolve, reject) => {
                const http = require('http');
                const req2 = http.request({
                    hostname: 'localhost', port: 3002, path: '/execute-prompt-sync',
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(executorBody) }
                }, (r) => {
                    let data = '';
                    r.on('data', c => data += c);
                    r.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Réponse executor invalide')); } });
                });
                req2.setTimeout(120000, () => { req2.destroy(); reject(new Error('L\'IA met trop de temps à répondre (timeout 120s)')); });
                req2.on('error', e => reject(new Error(`Executor inaccessible : ${e.message}. Vérifie que l'application est lancée.`)));
                req2.write(executorBody);
                req2.end();
            });

            if (output.error && !output.output) return res.json({ generated: [], message: `Erreur IA : ${output.error}` });
            const text = output.output || '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return res.json({ generated: [], message: 'Réponse IA invalide — réessaie ou vérifie que l\'IA est bien configurée.' });
            const proposals = JSON.parse(jsonMatch[0]);
            const generated = proposals.map(p => ({
                id: projTestsCaseId(), title: p.title || 'Test sans titre',
                description: p.description, categoryId: '',
                criticality: ['bloquant', 'majeur', 'mineur'].includes(p.criticality) ? p.criticality : 'majeur',
                status: 'draft', source: 'ia', sourceRef: sectionId,
                steps: (p.steps || []).map((s, i) => ({ order: i + 1, action: s.action || '', expected: s.expected || '' })),
                createdAt: now, updatedAt: now
            }));
            return res.json({ generated });
        } catch (e) {
            return res.json({ generated: [], message: e.message });
        }
    }

    if (source === 'edition') {
        const generated = [];
        const projDir = path.join(BASE_DIR, 'projets', id);
        function scanDir(dir) {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) { scanDir(full); continue; }
                if (!entry.name.endsWith('.md')) continue;
                let content;
                try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
                const lines = content.split('\n');
                let current = null;
                for (const line of lines) {
                    const headMatch = line.match(/^#{1,3}\s+(.+)/);
                    const testMatch = line.match(/^[-*]\s+\[[ x]\]\s+(.+)/i);
                    const criteriaMatch = line.match(/crit[eè]re[s]?\s+(d['']acceptation|de\s+test)/i);
                    if (headMatch) {
                        current = headMatch[1].trim();
                    }
                    if (testMatch) {
                        generated.push({
                            id: projTestsCaseId(), categoryId: '', title: testMatch[1].trim(),
                            description: current ? `Section : ${current}` : undefined,
                            criticality: 'majeur', status: 'draft', source: 'edition',
                            sourceRef: path.relative(projDir, full).replace(/\\/g, '/'),
                            steps: [], createdAt: now, updatedAt: now
                        });
                    } else if (criteriaMatch && current) {
                        generated.push({
                            id: projTestsCaseId(), categoryId: '', title: `Vérifier : ${current}`,
                            criticality: 'majeur', status: 'draft', source: 'edition',
                            sourceRef: path.relative(projDir, full).replace(/\\/g, '/'),
                            steps: [], createdAt: now, updatedAt: now
                        });
                    }
                }
            }
        }
        scanDir(projDir);
        if (!generated.length) return res.json({ generated: [], message: 'Aucun critère de test trouvé dans les fichiers édition' });
        return res.json({ generated });
    }

    if (source === 'mockup') {
        try {
            const [instances] = await pool.query(
                "SELECT * FROM mega_outil_instances WHERE project_id = ? AND type = 'mockup' ORDER BY created_at ASC",
                [id]
            );
            if (!instances.length) return res.json({ generated: [], message: 'Aucun mockup trouvé pour ce projet' });
            const generated = [];
            for (const inst of instances) {
                const [elements] = await pool.query(
                    'SELECT * FROM mega_outil_mockup_elements WHERE instance_id = ? ORDER BY created_at ASC',
                    [inst.id]
                );
                const steps = elements.map((el, i) => ({
                    order: i + 1,
                    action: `Vérifier la présence de l'élément "${el.label || el.type}"`,
                    expected: `L'élément "${el.label || el.type}" est visible`
                }));
                generated.push({
                    id: projTestsCaseId(), categoryId: '', title: `Vérifier les éléments de "${inst.name}"`,
                    description: `Board mockup : ${inst.name}`,
                    criticality: 'majeur', status: 'draft', source: 'mockup', sourceRef: inst.id,
                    steps, createdAt: now, updatedAt: now
                });
            }
            return res.json({ generated });
        } catch (e) { return res.status(500).json({ error: e.message }); }
    }

    res.status(400).json({ error: 'Source inconnue' });
});

// GET /api/projets-tests/:id/runs
app.get('/api/projets-tests/:id/runs', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const id = req.params.id;
    const runsDir = projTestsRunDir(id);
    const runs = [];
    if (fs.existsSync(runsDir)) {
        for (const f of fs.readdirSync(runsDir)) {
            if (!f.endsWith('.json')) continue;
            try {
                const run = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
                const { results: _r, ...light } = run;
                runs.push(light);
            } catch { /* ignore */ }
        }
    }
    runs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ runs });
});

// GET /api/projets-tests/:id/runs/:runId
app.get('/api/projets-tests/:id/runs/:runId', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const run = projTestsLoadRun(req.params.id, req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run introuvable' });
    res.json(run);
});

// DELETE /api/projets-tests/:id/runs/:runId
app.delete('/api/projets-tests/:id/runs/:runId', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const p = path.join(projTestsRunDir(req.params.id), `${req.params.runId}.json`);
    try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projets-tests/:id/runs/launch  (manuel)
// GET  /api/projets-tests/:id/runs/launch  (auto SSE via EventSource)

function projTestsCreateRun(id, { mode, testerName, targetUrl, caseIds, comment }) {
    const suite = projTestsLoad(id, 'suite.json') || { categories: [], cases: [] };
    const caseIdList = caseIds ? (Array.isArray(caseIds) ? caseIds : caseIds.split(',')) : null;
    const activeCases = suite.cases.filter(c => c.status === 'active' && (!caseIdList || caseIdList.includes(c.id)));
    if (!activeCases.length) return null;
    const runId = projTestsRunId();
    const now = new Date().toISOString();
    const run = {
        id: runId, projectId: id, date: now, mode: mode || 'manual',
        status: 'running',
        testerName: testerName || undefined,
        targetUrl: targetUrl || undefined,
        comment: comment || undefined,
        caseIds: activeCases.map(c => c.id),
        results: activeCases.map(c => ({ caseId: c.id, status: 'pending' })),
        summary: { total: activeCases.length, pass: 0, fail: 0, skip: 0, pending: activeCases.length, score: 0, goNoGo: 'GO', durationMs: 0 },
        createdAt: now
    };
    projTestsSaveRun(id, runId, run);
    return { run, activeCases };
}

app.post('/api/projets-tests/:id/runs/launch', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const result = projTestsCreateRun(req.params.id, req.body);
    if (!result) return res.status(400).json({ error: 'Aucun test actif à exécuter' });
    res.json({ runId: result.run.id });
});

app.get('/api/projets-tests/:id/runs/launch', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const { targetUrl, caseIds, comment } = req.query;
    const result = projTestsCreateRun(req.params.id, { mode: 'auto', targetUrl, caseIds, comment });
    if (!result) return res.status(400).json({ error: 'Aucun test actif à exécuter' });
    const { run, activeCases } = result;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    send('start', { runId: run.id, total: activeCases.length });
    for (let i = 0; i < activeCases.length; i++) {
        const tc = activeCases[i];
        send('case-start', { caseId: tc.id, name: tc.title, index: i });
        await new Promise(r => setTimeout(r, 200));
        const result2 = { caseId: tc.id, status: 'pending', aiComment: 'Analyse automatique non encore implémentée' };
        run.results[i] = result2;
        send('case-result', { result: result2, index: i, total: activeCases.length });
    }
    run.status = 'completed';
    run.summary = computeTestSummary(run.results, activeCases, run.createdAt);
    projTestsSaveRun(req.params.id, run.id, run);
    send('complete', { runId: run.id, summary: run.summary });
    res.end();
});

// PUT /api/projets-tests/:id/runs/:runId
app.put('/api/projets-tests/:id/runs/:runId', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });
    const run = projTestsLoadRun(req.params.id, req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run introuvable' });
    if (req.body.results) run.results = req.body.results;
    if (req.body.status) run.status = req.body.status;
    if (run.status === 'completed') {
        const suite = projTestsLoad(req.params.id, 'suite.json') || { cases: [] };
        run.summary = computeTestSummary(run.results, suite.cases, run.createdAt);
    }
    projTestsSaveRun(req.params.id, req.params.runId, run);
    res.json(run);
});

    console.log('[Projets] Routes de la sous-application projets montées');
}

module.exports = { register, ensureSchema };
