"""Client MySQL dédié au Monitor DB — lecture seule stricte, connexions
séparées du pool Node (server/db.js, connectionLimit=10) pour ne jamais
créer de contention avec le serveur en production.
"""
import time

import pymysql
import pymysql.cursors


class MonitorDbClient:
    """Round-robin sur un petit nombre de connexions persistantes.

    N'exécute jamais rien d'autre que des SELECT (garde-fou dans select()).
    """

    def __init__(self, cfg: dict, pool_size: int = 2):
        self._cfg = cfg
        self._pool_size = max(1, pool_size)
        self._conns: list = [None] * self._pool_size
        self._next = 0

    def _new_conn(self):
        return pymysql.connect(
            host=self._cfg['host'],
            user=self._cfg['user'],
            password=self._cfg['password'],
            database=self._cfg['database'],
            connect_timeout=self._cfg.get('connect_timeout', 5),
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
        )

    def _get_conn(self):
        idx = self._next % self._pool_size
        self._next += 1
        conn = self._conns[idx]
        if conn is None:
            conn = self._new_conn()
            self._conns[idx] = conn
        else:
            try:
                conn.ping(reconnect=True)
            except Exception:
                conn = self._new_conn()
                self._conns[idx] = conn
        return conn

    def select(self, sql: str, params: tuple = ()) -> list:
        if not sql.strip().upper().startswith(('SELECT', 'SHOW')):
            raise ValueError('MonitorDbClient.select: lecture seule, SELECT/SHOW uniquement')
        conn = self._get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def ping_latency_ms(self):
        try:
            t0 = time.perf_counter()
            self.select('SELECT 1')
            return round((time.perf_counter() - t0) * 1000, 1)
        except Exception:
            return None

    def close_all(self):
        for i, c in enumerate(self._conns):
            if c is not None:
                try:
                    c.close()
                except Exception:
                    pass
            self._conns[i] = None
