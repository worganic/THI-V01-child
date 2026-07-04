"""QThreads de polling — pattern calqué sur InfoWorker de launcher_app.py.

FeedPollWorker : interroge les tables actives toutes les ~1.5s, diffuse les
changements (INSERT/UPDATE/DELETE) détectés par snapshot_engine.
StatsPollWorker : interroge les agrégats (users/projets/tickets/IA/déploiements)
et la santé technique (ports de service, latence MySQL, sessions actives)
toutes les ~3s — cadence distincte car ces chiffres bougent moins vite.
"""
import socket
import threading

from PyQt6.QtCore import QThread, pyqtSignal

from monitor.snapshot_engine import TableSnapshot


def port_in_use(port: int) -> bool:
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.3):
            return True
    except OSError:
        return False


def _select_expr(col: str, spec) -> str:
    if col in spec.extra_columns:
        return f'{spec.extra_columns[col]} AS {col}'
    max_len = spec.text_preview_len.get(col)
    return f'LEFT({col}, {max_len}) AS {col}' if max_len else col


def _build_sql(spec) -> str:
    cols = [_select_expr(c, spec) for c in spec.display_cols if c != spec.ts_col]
    from_clause = f'{spec.name} {spec.extra_joins}'.strip()
    if spec.full_table_mode:
        select_cols = ', '.join(cols) if cols else '1'
        return f"SELECT {spec.id_col} AS __id, {select_cols} FROM {from_clause} LIMIT {spec.poll_limit}"
    select_cols = ', '.join([spec.ts_col] + cols) if cols else spec.ts_col
    return (f"SELECT {spec.id_col} AS __id, {select_cols} FROM {from_clause} "
            f"ORDER BY {spec.ts_col} DESC LIMIT {spec.poll_limit}")


class FeedPollWorker(QThread):
    sig_changes = pyqtSignal(list)       # list[RowChange]
    sig_error = pyqtSignal(str, str)     # table, message

    def __init__(self, db_client, tables: list, interval_s: float = 1.5, initial_active=None):
        super().__init__()
        self.db = db_client
        self.tables = tables
        self.interval_s = interval_s
        self.running = True
        self._snapshots = {t.name: TableSnapshot() for t in tables}
        self._lock = threading.Lock()
        self._active_names = set(initial_active) if initial_active is not None else {t.name for t in tables}

    def set_active_tables(self, names: set):
        with self._lock:
            self._active_names = set(names)

    def run(self):
        while self.running:
            with self._lock:
                active = set(self._active_names)
            all_changes = []
            for spec in self.tables:
                if spec.name not in active:
                    continue
                try:
                    sql = _build_sql(spec)
                    rows = self.db.select(sql)
                    snap = self._snapshots[spec.name]
                    display_cols = [c for c in spec.display_cols if c != spec.ts_col]
                    changes = snap.diff(rows, id_col='__id', display_cols=display_cols)
                    for c in changes:
                        c.table = spec.name
                    all_changes.extend(changes)
                except Exception as e:
                    self.sig_error.emit(spec.name, str(e))
            if all_changes and self.running:
                self.sig_changes.emit(all_changes)
            for _ in range(int(self.interval_s * 10)):
                if not self.running:
                    break
                self.msleep(100)

    def stop(self):
        self.running = False
        self.wait()


class StatsPollWorker(QThread):
    sig_stats = pyqtSignal(dict)

    def __init__(self, db_client, service_ports: dict, interval_s: float = 3.0):
        super().__init__()
        self.db = db_client
        self.service_ports = service_ports
        self.interval_s = interval_s
        self.running = True

    def _count(self, from_clause: str):
        try:
            rows = self.db.select(f"SELECT COUNT(*) AS n FROM {from_clause}")
            return rows[0]['n'] if rows else None
        except Exception:
            return None

    def _last_deployment(self):
        try:
            rows = self.db.select(
                "SELECT version, deployed_by, deployed_at FROM app_deployments "
                "ORDER BY deployed_at DESC LIMIT 1"
            )
            return rows[0] if rows else None
        except Exception:
            return None

    def _threads_connected(self):
        try:
            rows = self.db.select("SHOW STATUS LIKE 'Threads_connected'")
            return int(rows[0]['Value']) if rows else None
        except Exception:
            return None

    def run(self):
        while self.running:
            stats = {}
            stats['services'] = {name: port_in_use(port) for name, port in self.service_ports.items()}
            stats['mysql_latency_ms'] = self.db.ping_latency_ms()
            stats['mysql_threads_connected'] = self._threads_connected()
            stats['users_total'] = self._count('users')
            stats['users_today'] = self._count("users WHERE created_at >= CURDATE()")
            stats['projects_total'] = self._count('frank_projects')
            stats['tickets_total'] = self._count('tickets')
            stats['sessions_active'] = self._count('sessions WHERE expires_at > NOW()')
            stats['ai_calls_total'] = self._count('ai_logs')
            stats['ai_calls_error'] = self._count("ai_logs WHERE status != 'success'")
            stats['deployments_7d'] = self._count(
                'app_deployments WHERE deployed_at >= NOW() - INTERVAL 7 DAY'
            )
            stats['last_deployment'] = self._last_deployment()

            if self.running:
                self.sig_stats.emit(stats)
            for _ in range(int(self.interval_s * 10)):
                if not self.running:
                    break
                self.msleep(100)

    def stop(self):
        self.running = False
        self.wait()
