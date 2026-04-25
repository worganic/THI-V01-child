/**
 * MySQL connection pool — Hostinger
 * Base : u995922796_frankenstein
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '193.203.168.175',
    user: 'u995922796_worg',
    password: 'Mplokiju.098',
    database: 'u995922796_frankenstein',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
    dateStrings: false,
});

pool.getConnection()
    .then(conn => { console.log('[DB] MySQL Hostinger connecté'); conn.release(); })
    .catch(err => console.error('[DB] Erreur connexion MySQL:', err.message));

module.exports = pool;
