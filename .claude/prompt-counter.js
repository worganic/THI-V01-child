#!/usr/bin/env node
// Hook UserPromptSubmit : incrémente le compteur de prompts (jour / mois / total)
// Écrit dans .claude/prompt-stats.json. N'émet rien sur stdout (pas de pollution du contexte).

const fs = require('fs');
const path = require('path');

const STATS = path.join(__dirname, 'prompt-stats.json');

const now = new Date();
const day = now.toISOString().slice(0, 10);   // YYYY-MM-DD
const month = day.slice(0, 7);                // YYYY-MM

let data = { total: 0, days: {}, months: {} };
try { data = JSON.parse(fs.readFileSync(STATS, 'utf8')); } catch { /* premier prompt */ }

data.total = (data.total || 0) + 1;
data.days = data.days || {};
data.months = data.months || {};
data.days[day] = (data.days[day] || 0) + 1;
data.months[month] = (data.months[month] || 0) + 1;

try { fs.writeFileSync(STATS, JSON.stringify(data, null, 2)); } catch { /* ignore */ }

process.exit(0);
