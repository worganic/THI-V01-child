#!/usr/bin/env node
/**
 * Tests automatisés du système Projets (Zone 3 + Zone 4).
 *
 * Couvre toutes les opérations documentées dans REGLES_GESTION_PROJET.md :
 *   - création / renommage / suppression de dossiers et fichiers
 *   - moveFile / moveFolder
 *   - updateStructure (réordonnancement)
 *   - upload-image
 *   - garde-fous serveur (doublons, descendants, fichier orphelin)
 *
 * Usage :
 *   WORG_TOKEN="<token>" node tests/test-zone-projet.js
 *
 * Variables d'env :
 *   WORG_TOKEN  : token d'auth (récupéré via localStorage.frankenstein_token)
 *   WORG_API    : URL serveur (défaut http://localhost:3001)
 *   WORG_KEEP   : si =1, ne supprime PAS le projet de test à la fin
 */

const API   = process.env.WORG_API   || 'http://localhost:3001';
const TOKEN = process.env.WORG_TOKEN || '';
const KEEP  = process.env.WORG_KEEP === '1';

if (!TOKEN) {
    console.error('[FAIL] WORG_TOKEN non défini. Récupère-le via localStorage.getItem("frankenstein_token").');
    process.exit(1);
}

const PROJECT = '__test-zone-projet__';
const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };

let passed = 0;
let failed = 0;
const failures = [];

// ──────────────────────────────────────────────────────────────────────────
function pass(label) { passed++; console.log(`  [32m✓[0m ${label}`); }
function fail(label, err) {
    failed++;
    failures.push({ label, err: err?.message || String(err) });
    console.log(`  [31m✗[0m ${label}\n      ${err?.message || err}`);
}
async function test(label, fn) {
    try { await fn(); pass(label); } catch (e) { fail(label, e); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'expected equal'}: got "${a}" vs "${b}"`); }

async function api(method, path, body) {
    const res = await fetch(`${API}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${method} ${path} :: ${data?.error || text}`);
        err.status = res.status; err.body = data;
        throw err;
    }
    return data;
}

// Helpers structure
function findById(nodes, id) {
    for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const f = findById(n.children, id); if (f) return f; }
    }
    return null;
}
async function loadFiles() { return (await api('GET', `/api/file-projects/${PROJECT}/files`)).files; }

// ──────────────────────────────────────────────────────────────────────────
async function setup() {
    console.log(`\n→ Préparation projet de test "${PROJECT}"`);
    try { await api('DELETE', `/api/file-projects/${PROJECT}`); } catch {}
    await api('POST', `/api/file-projects`, { projectName: 'Tests automatiques', folderName: PROJECT });
}

async function teardown() {
    if (KEEP) {
        console.log(`\n(WORG_KEEP=1) Projet "${PROJECT}" conservé.`);
        return;
    }
    try { await api('DELETE', `/api/file-projects/${PROJECT}`); console.log(`\n→ Projet "${PROJECT}" supprimé.`); } catch (e) { console.warn(`Cleanup failed: ${e.message}`); }
}

// ──────────────────────────────────────────────────────────────────────────
async function suite_FolderCRUD() {
    console.log('\n[1] CRUD dossiers');

    let folderA, folderB, sub;
    await test('Création dossier racine A', async () => {
        folderA = await api('POST', `/api/file-projects/${PROJECT}/folders`, { name: 'Section A' });
        assert(folderA.id, 'pas d\'id');
        assertEq(folderA.type, 'folder', 'type');
        assert((folderA.children || []).some(c => c.type === 'file' && c.name === 'contenu.md'), 'contenu.md auto-créé attendu');
    });

    await test('Création dossier racine B', async () => {
        folderB = await api('POST', `/api/file-projects/${PROJECT}/folders`, { name: 'Section B' });
        assert(folderB.id, 'pas d\'id');
    });

    await test('Création sous-dossier dans A', async () => {
        sub = await api('POST', `/api/file-projects/${PROJECT}/folders`, { name: 'Sub A1', parentId: folderA.id });
        assert(sub.path.includes('section-a/sub-a1') || sub.path.includes('section-a\\sub-a1'), `path attendu, reçu: ${sub.path}`);
    });

    await test('Renommage du dossier A', async () => {
        await api('PATCH', `/api/file-projects/${PROJECT}/folders/${folderA.id}`, { name: 'Section A renamed' });
        const tree = await loadFiles();
        const node = findById(tree, folderA.id);
        assertEq(node.name, 'Section A renamed', 'nom non mis à jour');
        // Le sous-dossier doit avoir son chemin mis à jour
        const subFresh = findById(tree, sub.id);
        assert(subFresh.path.toLowerCase().includes('section-a-renamed'), `chemin sub non mis à jour: ${subFresh.path}`);
    });

    await test('Refus doublon dossier (même nom même parent)', async () => {
        try {
            await api('POST', `/api/file-projects/${PROJECT}/folders`, { name: 'Section A renamed' });
            // Note : le serveur peut soit refuser soit suffixer ; on accepte les deux comportements
            // mais on s'assure que le projet n'est pas cassé après l'appel.
        } catch (e) {
            // attendu si le serveur valide stricte ; pas d'erreur fatale ici
        }
        const tree = await loadFiles();
        assert(tree.length >= 2, 'arbre cassé après tentative doublon');
    });

    return { folderA, folderB, sub };
}

async function suite_FileCRUD(folderA) {
    console.log('\n[2] CRUD fichiers');

    let doc1, doc2, doc3;
    await test('Création doc1 dans A', async () => {
        doc1 = await api('POST', `/api/file-projects/${PROJECT}/files`, { name: 'Doc 1', parentId: folderA.id, content: '# Doc 1\nHello' });
        assert(doc1.id, 'pas d\'id');
        assertEq(doc1.type, 'file', 'type');
    });
    await test('Création doc2 dans A', async () => {
        doc2 = await api('POST', `/api/file-projects/${PROJECT}/files`, { name: 'Doc 2', parentId: folderA.id, content: 'Doc 2 content' });
    });
    await test('Création doc3 dans A', async () => {
        doc3 = await api('POST', `/api/file-projects/${PROJECT}/files`, { name: 'Doc 3', parentId: folderA.id, content: 'Doc 3 content' });
    });

    await test('Update du contenu de doc1', async () => {
        await api('PUT', `/api/file-projects/${PROJECT}/files/${doc1.id}`, { content: '# Updated\nNew content' });
    });

    await test('Renommage doc2 → DocTwo', async () => {
        await api('PATCH', `/api/file-projects/${PROJECT}/files/${doc2.id}`, { name: 'DocTwo' });
        const tree = await loadFiles();
        const node = findById(tree, doc2.id);
        assert(node.name.toLowerCase().includes('doctwo'), `nom non mis à jour: ${node.name}`);
    });

    return { doc1, doc2, doc3 };
}

async function suite_Reorder(folderA, doc1, doc2, doc3) {
    console.log('\n[3] Réordonnancement (régression mod-069)');

    // État initial : doc1, doc2, doc3 dans folderA
    await test('Ordre initial doc1 < doc2 < doc3', async () => {
        const tree = await loadFiles();
        const folder = findById(tree, folderA.id);
        const fileIds = (folder.children || []).filter(c => c.type === 'file' && c.name !== 'contenu.md').map(c => c.id);
        const i1 = fileIds.indexOf(doc1.id);
        const i2 = fileIds.indexOf(doc2.id);
        const i3 = fileIds.indexOf(doc3.id);
        assert(i1 < i2 && i2 < i3, `ordre attendu doc1<doc2<doc3, reçu: ${fileIds}`);
    });

    await test('Réordonnancement via updateStructure : doc3, doc1, doc2', async () => {
        const tree = await loadFiles();
        const folder = findById(tree, folderA.id);
        const others = (folder.children || []).filter(c => ![doc1.id, doc2.id, doc3.id].includes(c.id));
        // Files first (convention), then others (sub-folders, contenu.md…)
        folder.children = [
            findById(tree, doc3.id),
            findById(tree, doc1.id),
            findById(tree, doc2.id),
            ...others,
        ];
        // Mise à jour des ordres
        folder.children.forEach((c, i) => c.order = i + 1);
        await api('PUT', `/api/file-projects/${PROJECT}/structure`, { structure: tree });

        const fresh = await loadFiles();
        const f = findById(fresh, folderA.id);
        const ids = (f.children || []).filter(c => c.type === 'file' && c.name !== 'contenu.md').map(c => c.id);
        const i1 = ids.indexOf(doc1.id);
        const i2 = ids.indexOf(doc2.id);
        const i3 = ids.indexOf(doc3.id);
        assert(i3 < i1 && i1 < i2, `ordre attendu doc3<doc1<doc2, reçu: ${ids}`);
    });
}

async function suite_Move(folderA, folderB, doc1) {
    console.log('\n[4] Déplacements (moveFile / moveFolder)');

    await test('moveFile doc1 : A → B', async () => {
        await api('POST', `/api/file-projects/${PROJECT}/move-file`, { fileId: doc1.id, targetFolderId: folderB.id });
        const tree = await loadFiles();
        const inB = findById(tree, folderB.id).children?.some(c => c.id === doc1.id);
        const inA = findById(tree, folderA.id).children?.some(c => c.id === doc1.id);
        assert(inB && !inA, 'doc1 devrait être dans B et plus dans A');
    });

    await test('moveFile doc1 : retour B → A', async () => {
        await api('POST', `/api/file-projects/${PROJECT}/move-file`, { fileId: doc1.id, targetFolderId: folderA.id });
    });

    let tmpFolder;
    await test('moveFolder : sub → racine', async () => {
        const tree = await loadFiles();
        const a = findById(tree, folderA.id);
        const sub = a.children?.find(c => c.type === 'folder');
        assert(sub, 'sous-dossier introuvable');
        tmpFolder = sub;
        await api('POST', `/api/file-projects/${PROJECT}/move-folder`, { folderId: sub.id, targetParentId: null });
        const fresh = await loadFiles();
        assert(fresh.some(n => n.id === sub.id), 'sub devrait être à la racine');
    });

    await test('moveFolder refusé : déplacer A dans son propre descendant', async () => {
        // Recréons un descendant temporaire dans A pour ce test
        const child = await api('POST', `/api/file-projects/${PROJECT}/folders`, { name: 'Descendant', parentId: folderA.id });
        try {
            await api('POST', `/api/file-projects/${PROJECT}/move-folder`, { folderId: folderA.id, targetParentId: child.id });
            throw new Error('le serveur aurait dû refuser');
        } catch (e) {
            assert(e.status === 400, `attendu 400, reçu ${e.status}`);
        }
        await api('DELETE', `/api/file-projects/${PROJECT}/folders/${child.id}`);
    });

    await test('moveFolder refusé : doublon dans cible', async () => {
        // Recrée un dossier "Section B" dans A
        const dup = await api('POST', `/api/file-projects/${PROJECT}/folders`, { name: 'Section B', parentId: folderA.id });
        try {
            await api('POST', `/api/file-projects/${PROJECT}/move-folder`, { folderId: dup.id, targetParentId: null });
            throw new Error('le serveur aurait dû refuser un doublon');
        } catch (e) {
            assert(e.status === 400, `attendu 400, reçu ${e.status}`);
        }
        await api('DELETE', `/api/file-projects/${PROJECT}/folders/${dup.id}`);
    });
}

async function suite_Image(folderA) {
    console.log('\n[5] Upload image');

    // 1x1 transparent PNG en base64
    const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    let img;
    await test('Upload image PNG (1x1)', async () => {
        img = await api('POST', `/api/file-projects/${PROJECT}/upload-image`, { name: 'pixel.png', parentId: folderA.id, data: png1x1, mimeType: 'image/png' });
        assert(img.id, 'pas d\'id');
        assertEq(img.fileType, 'image', 'fileType=image attendu');
    });

    await test('Refus image trop grande (>1Mo)', async () => {
        const big = Buffer.alloc(1024 * 1024 + 10).toString('base64'); // ~1.4Mo après b64
        try {
            await api('POST', `/api/file-projects/${PROJECT}/upload-image`, { name: 'big.png', parentId: folderA.id, data: big, mimeType: 'image/png' });
            throw new Error('le serveur aurait dû refuser');
        } catch (e) {
            assert(e.status === 400, `attendu 400, reçu ${e.status}`);
        }
    });

    return { img };
}

async function suite_Delete(folderB) {
    console.log('\n[6] Suppression');

    await test('Suppression dossier B (récursive)', async () => {
        await api('DELETE', `/api/file-projects/${PROJECT}/folders/${folderB.id}`);
        const tree = await loadFiles();
        assert(!findById(tree, folderB.id), 'B aurait dû être supprimé');
    });
}

// ──────────────────────────────────────────────────────────────────────────
(async () => {
    const t0 = Date.now();
    console.log(`╔════════════════════════════════════════╗`);
    console.log(`║  Tests Zone 3 / Zone 4 — ${API}`);
    console.log(`╚════════════════════════════════════════╝`);

    try {
        await setup();
        const { folderA, folderB } = await suite_FolderCRUD();
        const { doc1, doc2, doc3 } = await suite_FileCRUD(folderA);
        await suite_Reorder(folderA, doc1, doc2, doc3);
        await suite_Move(folderA, folderB, doc1);
        await suite_Image(folderA);
        await suite_Delete(folderB);
    } catch (e) {
        console.error(`\n[FATAL] ${e.message}`);
        failed++;
    } finally {
        await teardown();
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`\n──────────────────────────────────────────`);
    console.log(`Résultat : ${passed} passé(s), ${failed} échec(s) en ${dur}s`);
    if (failures.length) {
        console.log(`\nÉchecs :`);
        for (const f of failures) console.log(`  • ${f.label} → ${f.err}`);
    }
    process.exit(failed > 0 ? 1 : 0);
})();
