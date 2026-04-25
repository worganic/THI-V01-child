/**
 * tests/test-servers.js
 * Tests minimaux pour vérifier le bon fonctionnement des deux serveurs.
 *
 * Usage :
 *   1. Lancer server-data.js    → cd server && node server-data.js
 *   2. Lancer server-executor.js → cd electron/executor && node server-executor.js
 *   3. Dans un autre terminal   → node tests/test-servers.js
 */

const http = require('http');

const DATA_URL = 'http://localhost:3001';
const EXECUTOR_URL = 'http://localhost:3002';

let passed = 0;
let failed = 0;

// ─── Helper ──────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function post(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const parsed = new URL(url);
    opts.hostname = parsed.hostname;
    opts.port = parsed.port;
    opts.path = parsed.pathname;

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// ─── Tests server-data.js (port 3001) ────────────────────────────────────────

async function testDataServer() {
  console.log('\n[server-data.js — port 3001]\n');

  await test('Serveur accessible (GET /)', async () => {
    const res = await get(`${DATA_URL}/`);
    assert(res.status < 500, `HTTP ${res.status}`);
  });

  await test('GET /api/config renvoie un objet JSON', async () => {
    const res = await get(`${DATA_URL}/api/config`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body === 'object', 'Response is not JSON object');
  });

  await test('GET /api/projects renvoie un tableau', async () => {
    const res = await get(`${DATA_URL}/api/projects`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body), 'Expected array of projects');
  });

  await test('GET /api/config/keys renvoie un objet de config', async () => {
    const res = await get(`${DATA_URL}/api/config/keys`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body === 'object', 'Expected config object');
  });

  await test('Route inconnue renvoie 404', async () => {
    const res = await get(`${DATA_URL}/api/route-inexistante-xyz`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });
}

// ─── Tests server-executor.js (port 3002) ────────────────────────────────────

async function testExecutorServer() {
  console.log('\n[server-executor.js — port 3002]\n');

  await test('Serveur accessible (GET /api/cli-check-only)', async () => {
    const res = await get(`${EXECUTOR_URL}/api/cli-check-only`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('GET /api/cli-status renvoie état des CLI', async () => {
    const res = await get(`${EXECUTOR_URL}/api/cli-status`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body === 'object', 'Expected object');
    assert('claude' in res.body || 'gemini' in res.body, 'Expected claude or gemini keys');
  });

  await test('GET /get-model renvoie le modèle actif', async () => {
    const res = await get(`${EXECUTOR_URL}/get-model`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.body === 'object', 'Expected object');
  });

  await test('POST /stop-execution accepte un stepId inconnu sans erreur 500', async () => {
    const res = await post(`${EXECUTOR_URL}/stop-execution`, { stepId: 'test-step-xyz' });
    assert(res.status < 500, `Got server error: HTTP ${res.status}`);
  });

  await test('Route inconnue renvoie 404', async () => {
    const res = await get(`${EXECUTOR_URL}/api/route-inexistante-xyz`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });
}

// ─── Tests de séparation des responsabilités ─────────────────────────────────

async function testSeparation() {
  console.log('\n[Séparation des responsabilités]\n');

  await test('server-data.js N\'expose PAS /execute-prompt', async () => {
    const res = await post(`${DATA_URL}/execute-prompt`, { prompt: 'test' }).catch(() => ({ status: 0 }));
    assert(res.status !== 200, 'server-data.js should NOT handle /execute-prompt');
  });

  await test('server-executor.js N\'expose PAS /api/projects', async () => {
    const res = await get(`${EXECUTOR_URL}/api/projects`).catch(() => ({ status: 0 }));
    assert(res.status !== 200, 'server-executor.js should NOT handle /api/projects');
  });

  await test('server-data.js N\'expose PAS /api/cli-status', async () => {
    const res = await get(`${DATA_URL}/api/cli-status`).catch(() => ({ status: 0 }));
    // Devrait être 404 ou non-200
    assert(res.status !== 200 || res.status === 404,
      'server-data.js should NOT handle /api/cli-status (executor only)');
  });
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Worganic Platform — Tests de vérification');
  console.log('═══════════════════════════════════════════════');

  // Vérifier que les serveurs sont accessibles avant de tester
  let dataOk = false;
  let executorOk = false;

  try {
    await get(`${DATA_URL}/api/config`);
    dataOk = true;
  } catch {
    console.warn(`\n⚠ server-data.js (${DATA_URL}) inaccessible — tests data ignorés`);
    console.warn('  → Lancer: cd server && node server-data.js\n');
  }

  try {
    await get(`${EXECUTOR_URL}/api/cli-check-only`);
    executorOk = true;
  } catch {
    console.warn(`\n⚠ server-executor.js (${EXECUTOR_URL}) inaccessible — tests executor ignorés`);
    console.warn('  → Lancer: cd electron/executor && node server-executor.js\n');
  }

  if (dataOk) await testDataServer();
  if (executorOk) await testExecutorServer();
  if (dataOk && executorOk) await testSeparation();

  // Résumé
  const total = passed + failed;
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Résultats : ${passed}/${total} tests passés`);
  if (failed > 0) {
    console.log(`  ✗ ${failed} test(s) échoué(s)`);
  } else if (total > 0) {
    console.log('  ✓ Tous les tests sont passés !');
  }
  console.log('═══════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Erreur inattendue:', err);
  process.exit(1);
});
