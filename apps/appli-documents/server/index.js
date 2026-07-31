/**
 * Worganic — Backend de la sous-application `apps/appli-documents` (montée
 * dans le portail sur /documents) : catégories et documents Markdown partagés.
 *
 * Co-localisé avec le frontend (apps/appli-documents/) plutôt que dans
 * server/modules/ : c'est le contrat "sous-application" (voir
 * docs/architecture-sous-applications.md) — tout ce qui compose les documents
 * vit dans ce seul dossier, portable tel quel vers un autre portail.
 *
 * Données en MySQL (tables doc_categories, documents) : données transverses
 * partagées entre tous les utilisateurs du portail (voir CLAUDE.md).
 *
 * Montage : require('../apps/appli-documents/server').register(app, { pool, getSessionUser })
 */

const { upsertCatalogEntry, markAppMounted } = require('../../../server/modules/portal-apps');

// Entrée de catalogue `portal_apps` propre aux documents (voir upsertCatalogEntry
// ci-dessous) : ce module n'a plus besoin d'être connu par son nom dans
// server/modules/portal-apps.js pour apparaître dans le menu des applications.
const CATALOG_ENTRY = {
    code: 'appli-documents', nom: 'Documents', description: 'Documents Markdown partagés, classés par catégorie',
    url_path: '/documents', icone: 'description', ordre: 4
};

const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS doc_categories (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by VARCHAR(64) NOT NULL,
        created_by_username VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(64) PRIMARY KEY,
        category_id VARCHAR(64) DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        text LONGTEXT,
        is_public TINYINT(1) NOT NULL DEFAULT 1,
        created_by VARCHAR(64) NOT NULL,
        created_by_username VARCHAR(128) NOT NULL,
        updated_by VARCHAR(64) DEFAULT NULL,
        updated_by_username VARCHAR(128) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
];

async function ensureSchema(pool) {
    try {
        for (const stmt of SCHEMA) await pool.query(stmt);
        try {
            await pool.query('ALTER TABLE doc_categories ADD COLUMN IF NOT EXISTS default_document_id VARCHAR(64) DEFAULT NULL');
        } catch (e) {
            if (e.errno !== 1060) throw e; // 1060 = colonne déjà présente
        }
        await upsertCatalogEntry(pool, CATALOG_ENTRY);
    } catch (e) {
        console.error('[Documents] Erreur init schéma:', e.message);
    }
}

function register(app, { pool, getSessionUser }) {
    // Preuve que ce module (donc le dossier apps/appli-documents/) est bien présent
    // dans cette installation — voir markAppMounted/isAppAvailable dans portal-apps.js.
    markAppMounted(CATALOG_ENTRY.code);

    // GET toutes les catégories
    app.get('/api/doc-categories', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        try {
            const [rows] = await pool.query('SELECT * FROM doc_categories ORDER BY name ASC');
            res.json(rows.map(r => ({
                id: r.id, name: r.name, description: r.description || '',
                defaultDocumentId: r.default_document_id || null,
                createdBy: r.created_by, createdByUsername: r.created_by_username,
                createdAt: r.created_at
            })));
        } catch (e) {
            console.error('[DOC-CAT] Get error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // POST créer une catégorie
    app.post('/api/doc-categories', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const { name, description } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
        try {
            const id = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            await pool.query(
                'INSERT INTO doc_categories (id, name, description, created_by, created_by_username) VALUES (?,?,?,?,?)',
                [id, name.trim(), (description || '').trim(), user.id, user.username]
            );
            const [rows] = await pool.query('SELECT * FROM doc_categories WHERE id = ?', [id]);
            const r = rows[0];
            res.json({ id: r.id, name: r.name, description: r.description || '',
                createdBy: r.created_by, createdByUsername: r.created_by_username, createdAt: r.created_at });
        } catch (e) {
            console.error('[DOC-CAT] Create error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // PUT modifier une catégorie
    app.put('/api/doc-categories/:id', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const { name, description } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis' });
        try {
            const [existing] = await pool.query('SELECT * FROM doc_categories WHERE id = ?', [req.params.id]);
            if (!existing[0]) return res.status(404).json({ error: 'Catégorie introuvable' });
            if (existing[0].created_by !== user.id && user.role !== 'admin') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            await pool.query(
                'UPDATE doc_categories SET name = ?, description = ? WHERE id = ?',
                [name.trim(), (description || '').trim(), req.params.id]
            );
            const [rows] = await pool.query('SELECT * FROM doc_categories WHERE id = ?', [req.params.id]);
            const r = rows[0];
            res.json({ id: r.id, name: r.name, description: r.description || '',
                createdBy: r.created_by, createdByUsername: r.created_by_username, createdAt: r.created_at });
        } catch (e) {
            console.error('[DOC-CAT] Update error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // PUT définir le document par défaut d'une catégorie
    app.put('/api/doc-categories/:id/default-document', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const { documentId } = req.body; // null pour retirer le défaut
        try {
            const [existing] = await pool.query('SELECT * FROM doc_categories WHERE id = ?', [req.params.id]);
            if (!existing[0]) return res.status(404).json({ error: 'Catégorie introuvable' });
            if (existing[0].created_by !== user.id && user.role !== 'admin') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            // Vérifie que le document appartient bien à cette catégorie (si fourni)
            if (documentId) {
                const [doc] = await pool.query('SELECT id FROM documents WHERE id = ? AND category_id = ?', [documentId, req.params.id]);
                if (!doc[0]) return res.status(400).json({ error: 'Ce document n\'appartient pas à cette catégorie' });
            }
            await pool.query('UPDATE doc_categories SET default_document_id = ? WHERE id = ?', [documentId || null, req.params.id]);
            const [rows] = await pool.query('SELECT * FROM doc_categories WHERE id = ?', [req.params.id]);
            const r = rows[0];
            res.json({ id: r.id, name: r.name, description: r.description || '',
                defaultDocumentId: r.default_document_id || null,
                createdBy: r.created_by, createdByUsername: r.created_by_username, createdAt: r.created_at });
        } catch (e) {
            console.error('[DOC-CAT] Default-document error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // DELETE supprimer une catégorie
    app.delete('/api/doc-categories/:id', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        try {
            const [existing] = await pool.query('SELECT * FROM doc_categories WHERE id = ?', [req.params.id]);
            if (!existing[0]) return res.status(404).json({ error: 'Catégorie introuvable' });
            if (existing[0].created_by !== user.id && user.role !== 'admin') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            await pool.query('DELETE FROM doc_categories WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) {
            console.error('[DOC-CAT] Delete error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // GET documents (publics + les privés de l'utilisateur)
    app.get('/api/documents', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        try {
            let rows;
            if (user.role === 'admin') {
                [rows] = await pool.query('SELECT * FROM documents ORDER BY updated_at DESC');
            } else {
                [rows] = await pool.query(
                    'SELECT * FROM documents WHERE is_public = 1 OR created_by = ? ORDER BY updated_at DESC',
                    [user.id]
                );
            }
            res.json(rows.map(r => ({
                id: r.id, categoryId: r.category_id || null,
                title: r.title, description: r.description || '', text: r.text || '',
                isPublic: !!r.is_public,
                createdBy: r.created_by, createdByUsername: r.created_by_username,
                updatedBy: r.updated_by || null, updatedByUsername: r.updated_by_username || null,
                createdAt: r.created_at, updatedAt: r.updated_at
            })));
        } catch (e) {
            console.error('[DOCS] Get error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // POST créer un document
    app.post('/api/documents', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const { title, description, categoryId, text, isPublic } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est requis' });
        try {
            const id = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            await pool.query(
                `INSERT INTO documents (id, category_id, title, description, text, is_public, created_by, created_by_username)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [id, categoryId || null, title.trim(), (description || '').trim(),
                 text || '', isPublic ? 1 : 0, user.id, user.username]
            );
            const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
            const r = rows[0];
            res.json({ id: r.id, categoryId: r.category_id || null,
                title: r.title, description: r.description || '', text: r.text || '',
                isPublic: !!r.is_public,
                createdBy: r.created_by, createdByUsername: r.created_by_username,
                updatedBy: null, updatedByUsername: null,
                createdAt: r.created_at, updatedAt: r.updated_at });
        } catch (e) {
            console.error('[DOCS] Create error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // PUT modifier un document
    app.put('/api/documents/:id', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const { title, description, categoryId, text, isPublic } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ error: 'Le titre est requis' });
        try {
            const [existing] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            if (!existing[0]) return res.status(404).json({ error: 'Document introuvable' });
            if (existing[0].created_by !== user.id && user.role !== 'admin') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            await pool.query(
                `UPDATE documents SET category_id = ?, title = ?, description = ?, text = ?,
                 is_public = ?, updated_by = ?, updated_by_username = ? WHERE id = ?`,
                [categoryId || null, title.trim(), (description || '').trim(),
                 text || '', isPublic ? 1 : 0, user.id, user.username, req.params.id]
            );
            const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            const r = rows[0];
            res.json({ id: r.id, categoryId: r.category_id || null,
                title: r.title, description: r.description || '', text: r.text || '',
                isPublic: !!r.is_public,
                createdBy: r.created_by, createdByUsername: r.created_by_username,
                updatedBy: r.updated_by || null, updatedByUsername: r.updated_by_username || null,
                createdAt: r.created_at, updatedAt: r.updated_at });
        } catch (e) {
            console.error('[DOCS] Update error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // DELETE supprimer un document
    app.delete('/api/documents/:id', async (req, res) => {
        const user = getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        try {
            const [existing] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
            if (!existing[0]) return res.status(404).json({ error: 'Document introuvable' });
            if (existing[0].created_by !== user.id && user.role !== 'admin') {
                return res.status(403).json({ error: 'Non autorisé' });
            }
            await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        } catch (e) {
            console.error('[DOCS] Delete error:', e);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    console.log('[Documents] Routes /api/doc-categories, /api/documents montées');
}

module.exports = { register, ensureSchema };
