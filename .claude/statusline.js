#!/usr/bin/env node
// Statusline custom Worganic — 3 lignes
//  L1 : modèle, répertoire, git (branche + staged/modified)
//  L2 : % d'utilisation du compte Claude (limite 5h) + temps avant réinitialisation
//  L3 : % de contexte + serveurs MCP utilisés

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw); } catch { /* ignore */ }

  // --- Couleurs ANSI ---
  const C = {
    reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
    red: '\x1b[31m', gray: '\x1b[90m', white: '\x1b[37m', mag: '\x1b[35m'
  };

  // --- Barre de progression colorée (10 chars) ---
  const bar = (pct) => {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const filled = Math.round(pct / 10);
    const color = pct >= 90 ? C.red : pct >= 70 ? C.yellow : C.green;
    return `${color}${'█'.repeat(filled)}${C.gray}${'░'.repeat(10 - filled)}${C.reset}`;
  };

  // --- Durée lisible à partir de secondes ---
  const fmtDur = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  // ===== Ligne 1 : modèle / répertoire / git =====
  const model = d.model?.display_name || '?';
  const dir = path.basename(d.workspace?.current_dir || d.cwd || process.cwd());

  // --- Effort du modèle (non exposé par la statusline -> lecture des settings) ---
  const readEffort = () => {
    if (process.env.CLAUDE_CODE_EFFORT_LEVEL) return process.env.CLAUDE_CODE_EFFORT_LEVEL;
    const paths = [
      path.join(d.workspace?.project_dir || d.cwd || process.cwd(), '.claude', 'settings.local.json'),
      path.join(d.workspace?.project_dir || d.cwd || process.cwd(), '.claude', 'settings.json'),
      path.join(os.homedir(), '.claude', 'settings.json'),
    ];
    for (const p of paths) {
      try {
        const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (cfg.effortLevel) return cfg.effortLevel;
      } catch { /* fichier absent ou invalide */ }
    }
    return null;
  };
  const effort = readEffort();

  let gitPart = '';
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    const branch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const staged = execSync('git diff --cached --numstat', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean).length;
    const modified = execSync('git diff --numstat', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean).length;
    let flags = '';
    if (staged) flags += ` ${C.green}+${staged}${C.reset}`;
    if (modified) flags += ` ${C.yellow}~${modified}${C.reset}`;
    if (branch) gitPart = ` ${C.gray}|${C.reset} 🌿 ${branch}${flags}`;
  } catch { /* pas un repo git */ }

  const effortPart = effort ? ` ${C.gray}·${C.reset} ${C.yellow}${effort}${C.reset}` : '';
  const line1 = `${C.cyan}[${model}]${C.reset}${effortPart} 📁 ${C.white}${dir}${C.reset}${gitPart}`;

  // ===== Ligne 2 : utilisation compte Claude (limite 5h) + reset =====
  const fh = d.rate_limits?.five_hour;
  let line2;
  if (fh && fh.used_percentage != null) {
    const pct = Math.round(fh.used_percentage);
    let reset = '';
    if (fh.resets_at) {
      const secs = fh.resets_at - Math.floor(Date.now() / 1000);
      reset = ` ${C.gray}|${C.reset} ⏱️  reset ${C.white}${fmtDur(secs)}${C.reset}`;
    }
    line2 = `${bar(pct)} ${pct}% usage${reset}`;
  } else {
    // rate_limits absent (dispo seulement pour abonnés Claude.ai après 1er appel API)
    line2 = `${C.gray}${'░'.repeat(10)} usage n/a${C.reset}`;
  }

  // ===== Ligne 3 : contexte + MCP =====
  const ctx = Math.round(d.context_window?.used_percentage || 0);

  // MCP : non exposé par la statusline -> lecture des serveurs configurés (~/.claude.json)
  let mcpLabel = 'aucun';
  try {
    const cfgPath = path.join(os.homedir(), '.claude.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const names = new Set();
    if (cfg.mcpServers) Object.keys(cfg.mcpServers).forEach(n => names.add(n));
    const projDir = d.workspace?.project_dir || d.cwd;
    if (projDir && cfg.projects?.[projDir]?.mcpServers) {
      Object.keys(cfg.projects[projDir].mcpServers).forEach(n => names.add(n));
    }
    if (names.size) {
      const list = [...names];
      mcpLabel = list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} +${list.length - 3}`;
    }
  } catch { /* pas de config MCP */ }

  // Compteur de prompts (jour / mois / total) écrit par le hook UserPromptSubmit
  let prompts = '';
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompt-stats.json'), 'utf8'));
    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const j = s.days?.[day] || 0;
    const m = s.months?.[month] || 0;
    const t = s.total || 0;
    prompts = ` ${C.gray}|${C.reset} 📝 ${C.green}J:${j}${C.reset} ${C.yellow}M:${m}${C.reset} ${C.cyan}T:${t}${C.reset}`;
  } catch { /* pas encore de stats */ }

  const line3 = `${bar(ctx)} ${ctx}% ctx ${C.gray}|${C.reset} 🔌 ${C.mag}${mcpLabel}${C.reset}${prompts}`;

  process.stdout.write(`${line1}\n${line2}\n${line3}`);
});
