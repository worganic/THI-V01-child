/**
 * Worganic - Git Manager Module
 * Opérations git pour l'agent orchestrateur.
 */

const { execSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
}

function exec(cmd, cwd) {
    return execSync(cmd, {
        cwd: cwd || PROJECT_ROOT,
        encoding: 'utf8',
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
}

function isGitRepo() {
    try {
        exec('git rev-parse --is-inside-work-tree');
        return true;
    } catch {
        return false;
    }
}

function initRepo() {
    try {
        exec('git init');
        exec('git add -A');
        try {
            exec('git commit -m "chore: initial commit"');
        } catch { /* nothing to commit */ }
        return true;
    } catch (e) {
        console.error('[GitManager] Error initializing repo:', e.message);
        return false;
    }
}

function ensureGitRepo() {
    if (!isGitRepo()) {
        console.log('[GitManager] No git repo found, initializing...');
        return initRepo();
    }
    return true;
}

function getCurrentBranch() {
    try {
        return exec('git branch --show-current') || 'main';
    } catch {
        return 'main';
    }
}

function checkoutMain() {
    const branches = exec('git branch').split('\n').map(b => b.trim().replace(/^\* /, ''));
    const mainBranch = branches.includes('main') ? 'main' : (branches.includes('master') ? 'master' : null);

    if (!mainBranch) {
        // No branches at all — make sure we have at least one commit
        try {
            exec('git add -A');
            exec('git commit -m "chore: initial commit" --allow-empty');
        } catch { /* ignore */ }
        return;
    }

    exec(`git checkout ${mainBranch}`);
    try {
        exec(`git pull origin ${mainBranch}`);
    } catch {
        // No remote or nothing to pull — ignore
    }
}

function branchExists(name) {
    try {
        const branches = exec('git branch').split('\n').map(b => b.trim().replace(/^\* /, ''));
        return branches.includes(name);
    } catch {
        return false;
    }
}

function createBranch(name) {
    if (branchExists(name)) {
        exec(`git checkout ${name}`);
    } else {
        exec(`git checkout -b "${name}"`);
    }
}

function getModifiedFiles() {
    try {
        const staged = exec('git diff --cached --name-only');
        const unstaged = exec('git diff --name-only');
        const untracked = exec('git ls-files --others --exclude-standard');
        const all = [
            ...staged.split('\n'),
            ...unstaged.split('\n'),
            ...untracked.split('\n')
        ].filter(Boolean);
        return [...new Set(all)];
    } catch {
        return [];
    }
}

function commitAll(message) {
    try {
        exec('git add -A');
        exec(`git commit -m "${message.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
        return exec('git rev-parse HEAD');
    } catch (e) {
        if (e.message && e.message.includes('nothing to commit')) {
            return null;
        }
        throw e;
    }
}

function pushBranch(branchName) {
    try {
        exec(`git push origin "${branchName}"`);
        return true;
    } catch (e) {
        console.warn(`[GitManager] Push failed (no remote?): ${e.message}`);
        return false;
    }
}

function getBranchStatus(branchName) {
    try {
        const log = exec(`git log --oneline -1 "${branchName}"`);
        return { exists: true, lastCommit: log };
    } catch {
        return { exists: false, lastCommit: null };
    }
}

module.exports = {
    slugify,
    isGitRepo,
    ensureGitRepo,
    getCurrentBranch,
    checkoutMain,
    createBranch,
    getModifiedFiles,
    commitAll,
    pushBranch,
    getBranchStatus,
    PROJECT_ROOT
};
