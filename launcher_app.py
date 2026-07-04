#!/usr/bin/env python3
"""Worganic Launcher — Native Windows app (PyQt6)
Requires: pip install PyQt6
"""

import sys
import os
import re
import socket
import subprocess
import time
import threading
import logging
import traceback
from datetime import datetime

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QScrollArea, QFrame, QTabWidget,
    QPlainTextEdit, QGridLayout, QSplitter, QMessageBox, QDialog,
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QObject, QThread
from PyQt6.QtGui import QFont, QColor, QPalette, QTextCursor

ROOT    = os.path.dirname(os.path.abspath(__file__))
ANSI_RE = re.compile(r'\x1B\[[0-9;?]*[A-Za-z]|\x1B[()][0-9A-Z]|\r')

# ─── Logging ──────────────────────────────────────────────────────────────────

LOG_FILE = os.path.join(ROOT, 'launcher.log')
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
    ],
)
log = logging.getLogger('launcher')

def _log_exception(exc_type, exc_value, exc_tb):
    log.critical('Exception non gérée (main thread):\n%s',
                 ''.join(traceback.format_exception(exc_type, exc_value, exc_tb)))
    sys.__excepthook__(exc_type, exc_value, exc_tb)

def _log_thread_exception(args):
    log.critical('Exception non gérée (thread %s):\n%s',
                 args.thread.name if args.thread else '?',
                 ''.join(traceback.format_exception(args.exc_type, args.exc_value, args.exc_tb)))

sys.excepthook = _log_exception
threading.excepthook = _log_thread_exception

# Instance 1 = ports par défaut. Instance 2 = mêmes ports + INSTANCE_2_OFFSET,
# pour pouvoir lancer 2 systèmes complets en parallèle et tester avec 2 users différents.
INSTANCE_2_OFFSET = 10

INSTANCE_ENV_VARS = {
    'api':    'PORT',
    'agent':  'AGENT_PORT',
    'portail_executor': 'EXECUTOR_PORT',  # utilisé par electron/executor, indépendant du process electron
}

def build_services(offset: int):
    """Construit la liste des services avec les ports décalés de `offset`.
    L'app Electron (poste de dev unique, pointe en dur sur le port 4202) n'est
    lancée que pour l'instance 1 (offset=0) : ce n'est pas nécessaire d'avoir
    2 fenêtres Electron pour tester 2 users côté navigateur.
    """
    services = [
        {
            'id': 'api', 'name': 'API', 'port': 3001 + offset,
            'cmd': 'node --watch server/server-data.js',
            'env': {'PORT': str(3001 + offset)},
            'color': '#10b981',
        },
        {
            'id': 'agent', 'name': 'Agent', 'port': 3003 + offset,
            'cmd': 'node server/server-agent.js',
            'env': {'AGENT_PORT': str(3003 + offset)},
            'color': '#6366f1',
        },
        {
            'id': 'portail', 'name': 'Portail', 'port': 4202 + offset,
            'cmd': f'npx nx serve portail --port={4202 + offset}',
            'env': {},
            'color': '#f59e0b',
        },
        {
            'id': 'projets', 'name': 'Projets', 'port': 4203 + offset,
            'cmd': f'npx nx serve projets --port={4203 + offset}',
            'env': {},
            'color': '#3b82f6',
        },
    ]
    if offset == 0:
        services.append({
            'id': 'electron', 'name': 'Electron', 'port': None,
            'cmd': 'powershell -ExecutionPolicy Bypass -File start-electron.ps1',
            'env': {},
            'color': '#a855f7',
        })
        services.append({
            'id': 'monitor', 'name': 'Monitor DB', 'port': None,
            'cmd': f'{sys.executable} monitor_app.py',
            'env': {},
            'color': '#ec4899',
        })
    return services


# ─── Sélecteur d'instance (au lancement) ──────────────────────────────────────

class InstanceSelectDialog(QDialog):
    """Popup affichée au lancement pour choisir quelle instance démarrer,
    afin de pouvoir lancer 2 systèmes complets en parallèle (2 users de test)."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle('Worganic Launcher — Choix de l\'instance')
        self.setFixedSize(420, 260)
        self.setStyleSheet('background:#0f0f0f;color:#e2e2e2')
        self.offset = 0

        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 24, 24, 24)
        lay.setSpacing(14)

        title = QLabel('Quelle instance lancer ?')
        title.setFont(QFont('Segoe UI', 14, QFont.Weight.Bold))
        title.setStyleSheet('color:#e2e2e2;background:transparent')
        lay.addWidget(title)

        subtitle = QLabel('Permet de lancer 2 systèmes en parallèle pour tester avec 2 users différents.')
        subtitle.setWordWrap(True)
        subtitle.setFont(QFont('Segoe UI', 10))
        subtitle.setStyleSheet('color:#71717a;background:transparent')
        lay.addWidget(subtitle)

        def make_btn(text, sub, offset, color):
            btn = QPushButton(f'{text}\n{sub}')
            btn.setFont(QFont('Segoe UI', 11, QFont.Weight.Medium))
            btn.setFixedHeight(56)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setStyleSheet(
                f'QPushButton{{background:#111;color:{color};border:1px solid #222;'
                f'border-radius:8px;text-align:left;padding:6px 16px}}'
                f'QPushButton:hover{{border-color:{color}}}'
            )
            btn.clicked.connect(lambda: self._choose(offset))
            return btn

        lay.addWidget(make_btn(
            'Instance 1 (défaut)',
            'API 3001 · Agent 3003 · Portail 4202 · Projets 4203 · Electron',
            0, '#10b981',
        ))
        lay.addWidget(make_btn(
            f'Instance 2 (+{INSTANCE_2_OFFSET})',
            f'API {3001+INSTANCE_2_OFFSET} · Agent {3003+INSTANCE_2_OFFSET} · '
            f'Portail {4202+INSTANCE_2_OFFSET} · Projets {4203+INSTANCE_2_OFFSET}',
            INSTANCE_2_OFFSET, '#f59e0b',
        ))
        lay.addStretch()

    def _choose(self, offset: int):
        self.offset = offset
        self.accept()


# ─── Utilities ────────────────────────────────────────────────────────────────

def strip_ansi(s: str) -> str:
    return ANSI_RE.sub('', s).strip()

def port_in_use(port: int) -> bool:
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.3):
            return True
    except OSError:
        return False

def kill_port(port: int):
    r = subprocess.run(
        f'netstat -ano | findstr ":{port} "',
        shell=True, capture_output=True, text=True, timeout=5,
    )
    for line in r.stdout.strip().splitlines():
        p = line.strip().split()
        if len(p) >= 5 and p[3] == 'LISTENING':
            subprocess.run(['taskkill', '/PID', p[4], '/T', '/F'],
                           capture_output=True, timeout=5)


# ─── Info Worker (Background Thread) ──────────────────────────────────────────

class InfoWorker(QThread):
    sig_updated = pyqtSignal(str, str, int)  # branch, last_model, call_count

    def __init__(self, root_dir, api_port=3001):
        super().__init__()
        self.root_dir = root_dir
        self.api_port = api_port
        self.running = True

    def run(self):
        import urllib.request
        import json
        import subprocess

        while self.running:
            # 1. Obtenir la branche git
            branch = "inconnu"
            try:
                res = subprocess.run(
                    ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                    capture_output=True, text=True, timeout=2, cwd=self.root_dir, shell=True
                )
                if res.returncode == 0:
                    branch = res.stdout.strip()
            except Exception:
                pass

            # 2. Obtenir les infos d'utilisation de l'API locale
            last_model = "-"
            call_count = 0
            try:
                req = urllib.request.Request(f"http://localhost:{self.api_port}/api/ai-logs")
                with urllib.request.urlopen(req, timeout=1.5) as response:
                    logs = json.loads(response.read().decode('utf-8'))
                    if isinstance(logs, list):
                        call_count = len(logs)
                        if call_count > 0:
                            last_model = logs[0].get('model', '-')
            except Exception:
                pass

            # Émettre le signal vers l'UI
            self.sig_updated.emit(branch, last_model, call_count)

            # Attendre 5 secondes avant la prochaine mise à jour
            for _ in range(50):
                if not self.running:
                    break
                self.msleep(100)

    def stop(self):
        self.running = False
        self.wait()


# ─── Service Manager ──────────────────────────────────────────────────────────

class Manager(QObject):
    sig_log    = pyqtSignal(str, str)   # svc_id, line
    sig_status = pyqtSignal(str, bool)  # svc_id, running

    def __init__(self, services: list):
        super().__init__()
        self.services = services
        self._procs: dict = {}
        self._lock = threading.Lock()
        self._daemon_retried: set = set()  # services ayant déjà eu un retry daemon NX

    def _emit_log(self, svc_id: str, text: str):
        clean = strip_ansi(text)
        if clean:
            ts = datetime.now().strftime('%H:%M:%S')
            self.sig_log.emit(svc_id, f'[{ts}] {clean}')

    def is_running(self, svc_id: str) -> bool:
        with self._lock:
            p = self._procs.get(svc_id)
            if not p:
                return False
            if p['proc'].poll() is not None:
                del self._procs[svc_id]
                self.sig_status.emit(svc_id, False)
                return False
            return True

    def get_info(self, svc_id: str) -> dict | None:
        with self._lock:
            return dict(self._procs[svc_id]) if svc_id in self._procs else None

    def _watch(self, svc_id: str, proc):
        log.debug('[%s] _watch démarré (PID %s)', svc_id, proc.pid)
        daemon_restart_needed = False
        try:
            for raw in proc.stdout:
                clean = strip_ansi(raw)
                if clean:
                    ts = datetime.now().strftime('%H:%M:%S')
                    self.sig_log.emit(svc_id, f'[{ts}] {clean}')
                    if 'Please rerun the command' in clean and svc_id not in self._daemon_retried:
                        log.info('[%s] Daemon NX demande une relance', svc_id)
                        daemon_restart_needed = True
        except Exception:
            log.exception('[%s] Erreur lecture stdout', svc_id)
        rc = proc.poll()
        log.debug('[%s] Processus terminé (returncode=%s)', svc_id, rc)
        with self._lock:
            if svc_id in self._procs and self._procs[svc_id]['proc'] is proc:
                del self._procs[svc_id]
        self.sig_status.emit(svc_id, False)
        # Relance automatique si le daemon NX avait besoin d'un restart (une seule fois)
        if daemon_restart_needed:
            self._daemon_retried.add(svc_id)
            self.sig_log.emit(svc_id, f'[{datetime.now().strftime("%H:%M:%S")}] [launcher] Daemon NX redémarré → relance automatique...')
            log.info('[%s] Relance automatique après restart daemon NX', svc_id)
            time.sleep(1.5)
            threading.Thread(target=self.start, args=(svc_id,), daemon=True).start()

    def start(self, svc_id: str):
        svc = next((s for s in self.services if s['id'] == svc_id), None)
        if not svc:
            log.warning('start: service inconnu "%s"', svc_id)
            return
        with self._lock:
            if svc_id in self._procs:
                log.debug('[%s] start: déjà en cours', svc_id)
                return

        if svc['port'] and port_in_use(svc['port']):
            log.info('[%s] Port %s occupé → libération', svc_id, svc['port'])
            self._emit_log(svc_id, f'[launcher] Port {svc["port"]} occupé → libération')
            kill_port(svc['port'])
            time.sleep(0.6)

        log.info('[%s] Démarrage : %s', svc_id, svc['cmd'])
        self._emit_log(svc_id, '[launcher] Démarrage...')
        env = os.environ.copy()
        env.update(svc.get('env', {}))
        try:
            proc = subprocess.Popen(
                svc['cmd'],
                cwd=ROOT, shell=True, env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                encoding='utf-8', errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except Exception as e:
            log.exception('[%s] Erreur Popen', svc_id)
            self._emit_log(svc_id, f'[launcher] Erreur spawn: {e}')
            return

        log.info('[%s] Processus lancé (PID %s)', svc_id, proc.pid)
        with self._lock:
            self._procs[svc_id] = {'proc': proc, 'pid': proc.pid, 'started': time.time()}

        threading.Thread(target=self._watch, args=(svc_id, proc), daemon=True).start()
        self.sig_status.emit(svc_id, True)

    def stop(self, svc_id: str):
        with self._lock:
            p = self._procs.get(svc_id)
        if not p:
            return
        log.info('[%s] Arrêt (PID %s)', svc_id, p['pid'])
        self._emit_log(svc_id, '[launcher] Arrêt...')
        try:
            subprocess.run(['taskkill', '/PID', str(p['pid']), '/T', '/F'],
                           capture_output=True, timeout=5)
        except Exception:
            log.exception('[%s] Erreur taskkill', svc_id)
        with self._lock:
            self._procs.pop(svc_id, None)
        self._daemon_retried.discard(svc_id)
        self.sig_status.emit(svc_id, False)

    def start_all(self, exclude: set = frozenset()):
        for s in self.services:
            if s['id'] in exclude:
                continue
            threading.Thread(target=self.start, args=(s['id'],), daemon=True).start()

    def stop_all(self):
        for s in self.services:
            self.stop(s['id'])


# ─── Service Card ─────────────────────────────────────────────────────────────

class ServiceCard(QFrame):
    def __init__(self, svc: dict, manager: Manager):
        super().__init__()
        self.svc      = svc
        self.manager  = manager
        self._running = False

        self.setObjectName('card')
        self._style_stopped()

        lay = QVBoxLayout(self)
        lay.setContentsMargins(16, 14, 16, 14)
        lay.setSpacing(9)

        # Header row
        hdr = QHBoxLayout()
        hdr.setSpacing(8)

        self.dot = QLabel('●')
        self.dot.setFixedWidth(14)
        self.dot.setFont(QFont('Segoe UI', 11))
        self._dot_off()
        hdr.addWidget(self.dot)

        name_lbl = QLabel(svc['name'])
        name_lbl.setFont(QFont('Segoe UI', 13, QFont.Weight.Bold))
        name_lbl.setStyleSheet(f'color:{svc["color"]};background:transparent')
        hdr.addWidget(name_lbl)

        if svc['port']:
            port_lbl = QLabel(f':{svc["port"]}')
            port_lbl.setFont(QFont('Consolas', 10))
            port_lbl.setStyleSheet(
                'color:#818cf8;background:#1a1a2e;border:1px solid #2d2b5a;'
                'border-radius:4px;padding:1px 6px'
            )
            hdr.addWidget(port_lbl)

        hdr.addStretch()

        self.status_lbl = QLabel('○ Inactif')
        self.status_lbl.setFont(QFont('Segoe UI', 10))
        self.status_lbl.setStyleSheet('color:#52525b;background:transparent')
        hdr.addWidget(self.status_lbl)

        lay.addLayout(hdr)

        # Meta row (pid + uptime)
        self.meta_lbl = QLabel('')
        self.meta_lbl.setFont(QFont('Segoe UI', 10))
        self.meta_lbl.setStyleSheet('color:#52525b;background:transparent')
        self.meta_lbl.setFixedHeight(16)
        lay.addWidget(self.meta_lbl)

        # Toggle button
        self.btn = QPushButton(f'▶  Démarrer {svc["name"]}')
        self.btn.setFont(QFont('Segoe UI', 11, QFont.Weight.Medium))
        self.btn.setFixedHeight(34)
        self.btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._btn_stopped()
        self.btn.clicked.connect(self._toggle)
        lay.addWidget(self.btn)

        # Mini log (last 2 lines)
        self.mini_log = QLabel('—')
        self.mini_log.setFont(QFont('Cascadia Code', 9))
        self.mini_log.setStyleSheet(
            'color:#4b5563;background:#0a0a0a;border:1px solid #1a1a1a;'
            'border-radius:5px;padding:5px 8px'
        )
        self.mini_log.setWordWrap(False)
        self.mini_log.setFixedHeight(44)
        self.mini_log.setAlignment(Qt.AlignmentFlag.AlignBottom | Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(self.mini_log)

        self._recent: list[str] = []

    # ── Style helpers ──

    def _style_stopped(self):
        self.setStyleSheet(
            '#card{background:#111;border:1px solid #222;border-radius:10px}'
            '#card:hover{border-color:#333}'
        )

    def _style_running(self):
        self.setStyleSheet(
            '#card{background:#0d160f;border:1px solid #1a3020;border-radius:10px}'
        )

    def _dot_on(self):
        self.dot.setStyleSheet('color:#10b981;background:transparent')

    def _dot_off(self):
        self.dot.setStyleSheet('color:#333;background:transparent')

    def _btn_running(self):
        self.btn.setStyleSheet(
            'QPushButton{background:#1f0d0d;color:#ef4444;border:1px solid #4a0a0a;'
            'border-radius:6px;padding:6px 14px}'
            'QPushButton:hover{background:#4a0a0a}'
            'QPushButton:disabled{opacity:.4}'
        )

    def _btn_stopped(self):
        self.btn.setStyleSheet(
            'QPushButton{background:#0d1f14;color:#10b981;border:1px solid #14532d;'
            'border-radius:6px;padding:6px 14px}'
            'QPushButton:hover{background:#14532d}'
            'QPushButton:disabled{opacity:.4}'
        )

    # ── Slots ──

    def _toggle(self):
        self.btn.setEnabled(False)
        fn = self.manager.stop if self._running else self.manager.start
        threading.Thread(target=fn, args=(self.svc['id'],), daemon=True).start()

    def on_status(self, running: bool):
        self._running = running
        self.btn.setEnabled(True)
        if running:
            self._style_running()
            self._dot_on()
            self.status_lbl.setText('● Actif')
            self.status_lbl.setStyleSheet('color:#10b981;background:transparent')
            self.btn.setText(f'■  Arrêter {self.svc["name"]}')
            self._btn_running()
        else:
            self._style_stopped()
            self._dot_off()
            self.status_lbl.setText('○ Inactif')
            self.status_lbl.setStyleSheet('color:#52525b;background:transparent')
            self.btn.setText(f'▶  Démarrer {self.svc["name"]}')
            self._btn_stopped()
            self.meta_lbl.setText('')

    def on_log(self, line: str):
        self._recent.append(line)
        if len(self._recent) > 2:
            self._recent.pop(0)
        # Tronquer à 55 chars pour ne jamais forcer l'élargissement de la carte
        self.mini_log.setText('\n'.join(
            (r[:55] + '…') if len(r) > 55 else r for r in self._recent
        ))

    def tick(self):
        if not self._running:
            return
        info = self.manager.get_info(self.svc['id'])
        if not info:
            return
        elapsed = time.time() - info['started']
        if elapsed < 60:
            up = f'{int(elapsed)}s'
        elif elapsed < 3600:
            up = f'{int(elapsed // 60)}m {int(elapsed % 60)}s'
        else:
            up = f'{int(elapsed // 3600)}h {int((elapsed % 3600) // 60)}m'
        self.meta_lbl.setText(f'PID {info["pid"]}  ·  ↑ {up}')


# ─── Responsive Cards Container ───────────────────────────────────────────────

class CardsContainer(QWidget):
    """2 colonnes par défaut, bascule en 1 colonne si la largeur est insuffisante."""
    COLS       = 2
    MIN_WIDTH  = 300  # largeur minimale d'une carte avant de passer en 1 colonne

    def __init__(self):
        super().__init__()
        self.setStyleSheet('background:#0a0a0a')
        self._gl = QGridLayout(self)
        self._gl.setContentsMargins(20, 20, 20, 10)
        self._gl.setSpacing(14)
        self._cards: list = []
        self._cur_cols = self.COLS
        for c in range(self.COLS):
            self._gl.setColumnStretch(c, 1)

    def add_card(self, card: QFrame):
        from PyQt6.QtWidgets import QSizePolicy
        card.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        self._cards.append(card)
        self._place(self._cur_cols)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        w = event.size().width() - 40  # marges 2×20
        cols = self.COLS if w // self.COLS >= self.MIN_WIDTH else 1
        if cols != self._cur_cols:
            self._cur_cols = cols
            self._place(cols)

    def _place(self, cols: int):
        for card in self._cards:
            self._gl.removeWidget(card)
        for c in range(max(self.COLS, cols) + 1):
            self._gl.setColumnStretch(c, 1 if c < cols else 0)
        for i, card in enumerate(self._cards):
            self._gl.addWidget(card, i // cols, i % cols)


# ─── Main Window ──────────────────────────────────────────────────────────────

class MainWindow(QMainWindow):
    def __init__(self, manager: Manager, offset: int = 0):
        super().__init__()
        self.manager = manager
        self.offset = offset
        title = 'Worganic Launcher' if offset == 0 else f'Worganic Launcher — Instance 2 (+{offset})'
        self.setWindowTitle(title)
        self.resize(920, 720)
        self.setMinimumSize(700, 520)

        center = QWidget()
        self.setCentralWidget(center)
        root = QVBoxLayout(center)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ── Header ──
        hdr = QWidget()
        hdr.setFixedHeight(56)
        hdr.setStyleSheet('background:#111;border-bottom:1px solid #222')
        hdr_lay = QHBoxLayout(hdr)
        hdr_lay.setContentsMargins(20, 0, 20, 0)
        hdr_lay.setSpacing(10)

        brand = QLabel('◈  Worganic <b>Launcher</b>')
        brand.setFont(QFont('Segoe UI', 13))
        brand.setStyleSheet('color:#a1a1aa;background:transparent')
        hdr_lay.addWidget(brand)
        hdr_lay.addStretch()

        self.global_status = QLabel('—')
        self.global_status.setFont(QFont('Segoe UI', 10))
        self.global_status.setStyleSheet('color:#52525b;background:transparent')
        hdr_lay.addWidget(self.global_status)

        for label, color, slot in [
            ('▶  Start All', '#10b981', lambda: threading.Thread(target=manager.start_all, daemon=True).start()),
            ('■  Stop All',  '#ef4444', lambda: threading.Thread(target=manager.stop_all,  daemon=True).start()),
        ]:
            btn = QPushButton(label)
            btn.setFont(QFont('Segoe UI', 11, QFont.Weight.Medium))
            btn.setFixedHeight(32)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setStyleSheet(
                f'QPushButton{{background:{color};color:#fff;border:none;border-radius:6px;padding:0 14px}}'
                f'QPushButton:hover{{filter:brightness(1.1)}}'
            )
            btn.clicked.connect(slot)
            hdr_lay.addWidget(btn)

        btn_quit = QPushButton('⏻')
        btn_quit.setFont(QFont('Segoe UI', 12))
        btn_quit.setFixedSize(32, 32)
        btn_quit.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_quit.setToolTip('Tout arrêter et quitter')
        btn_quit.setStyleSheet(
            'QPushButton{background:#1c1c1e;color:#a1a1aa;border:1px solid #2e2e2e;border-radius:6px}'
            'QPushButton:hover{color:#fff;border-color:#555}'
        )
        btn_quit.clicked.connect(self._shutdown)
        hdr_lay.addWidget(btn_quit)

        root.addWidget(hdr)

        # ── Splitter: cards (top) + logs (bottom) ──
        splitter = QSplitter(Qt.Orientation.Vertical)
        splitter.setStyleSheet('QSplitter::handle{background:#1a1a1a;height:3px}')
        root.addWidget(splitter)

        # Cards scroll area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(
            'QScrollArea{background:#0a0a0a;border:none}'
            'QScrollBar:vertical{background:#111;width:8px;border-radius:4px}'
            'QScrollBar::handle:vertical{background:#333;border-radius:4px}'
            'QScrollBar::add-line:vertical,QScrollBar::sub-line:vertical{height:0}'
        )
        cards_container = CardsContainer()
        scroll.setWidget(cards_container)
        splitter.addWidget(scroll)

        # Log tabs
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet("""
            QTabWidget::pane {
                background: #0d0d0d;
                border: none;
                border-top: 1px solid #1a1a1a;
            }
            QTabBar::tab {
                background: #111;
                color: #71717a;
                padding: 6px 16px;
                border: none;
                border-right: 1px solid #1a1a1a;
                font-size: 12px;
                font-family: 'Segoe UI';
            }
            QTabBar::tab:selected { color: #e2e2e2; background: #0d0d0d; border-bottom: 2px solid #6366f1; }
            QTabBar::tab:hover    { color: #c4c4c4; }
        """)
        splitter.addWidget(self.tabs)
        splitter.setSizes([450, 230])

        # ── Build cards & log tabs ──
        self.cards: dict[str, ServiceCard] = {}
        self.log_views: dict[str, QPlainTextEdit] = {}

        for i, svc in enumerate(manager.services):
            card = ServiceCard(svc, manager)
            self.cards[svc['id']] = card
            cards_container.add_card(card)

            log_view = QPlainTextEdit()
            log_view.setReadOnly(True)
            log_view.setFont(QFont('Cascadia Code', 10))
            log_view.setStyleSheet(
                'QPlainTextEdit{background:#0d0d0d;color:#71717a;border:none;padding:8px}'
            )
            log_view.setMaximumBlockCount(1000)
            self.log_views[svc['id']] = log_view
            self.tabs.addTab(log_view, f'○ {svc["name"]}')

        # ── Connect signals ──
        manager.sig_status.connect(self._on_status)
        manager.sig_log.connect(self._on_log)

        # ── Timer for uptime + dead-process detection ──
        self._timer = QTimer()
        self._timer.timeout.connect(self._tick)
        self._timer.start(2000)

        # ── Info Bar (Footer) ──
        self.info_bar = QWidget()
        self.info_bar.setFixedHeight(28)
        self.info_bar.setStyleSheet('background:#111;border-top:1px solid #222;color:#71717a;')
        info_lay = QHBoxLayout(self.info_bar)
        info_lay.setContentsMargins(20, 0, 20, 0)
        info_lay.setSpacing(25)

        self.lbl_branch = QLabel('Git Branch: <b>-</b>')
        self.lbl_branch.setFont(QFont('Segoe UI', 9))
        self.lbl_branch.setStyleSheet('color:#71717a;background:transparent')

        self.lbl_model = QLabel('Last AI Model: <b>-</b>')
        self.lbl_model.setFont(QFont('Segoe UI', 9))
        self.lbl_model.setStyleSheet('color:#71717a;background:transparent')

        self.lbl_usage = QLabel('AI Usage: <b>-</b>')
        self.lbl_usage.setFont(QFont('Segoe UI', 9))
        self.lbl_usage.setStyleSheet('color:#71717a;background:transparent')

        info_lay.addWidget(self.lbl_branch)

        sep1 = QFrame()
        sep1.setFrameShape(QFrame.Shape.VLine)
        sep1.setStyleSheet('color:#222')
        sep1.setFixedWidth(1)
        info_lay.addWidget(sep1)

        info_lay.addWidget(self.lbl_model)

        sep2 = QFrame()
        sep2.setFrameShape(QFrame.Shape.VLine)
        sep2.setStyleSheet('color:#222')
        sep2.setFixedWidth(1)
        info_lay.addWidget(sep2)

        info_lay.addWidget(self.lbl_usage)

        info_lay.addStretch()

        root.addWidget(self.info_bar)

        # ── Info Worker Thread ──
        api_port = next((s['port'] for s in manager.services if s['id'] == 'api'), 3001)
        self.info_worker = InfoWorker(ROOT, api_port=api_port)
        self.info_worker.sig_updated.connect(self._on_info_updated)
        self.info_worker.start()

    # ── Signal handlers ──

    def _on_status(self, svc_id: str, running: bool):
        if svc_id in self.cards:
            self.cards[svc_id].on_status(running)
        for i, svc in enumerate(self.manager.services):
            if svc['id'] == svc_id:
                self.tabs.setTabText(i, ('● ' if running else '○ ') + svc['name'])
                break
        self._refresh_global_status()

    def _on_log(self, svc_id: str, line: str):
        if svc_id in self.cards:
            self.cards[svc_id].on_log(line)
        if svc_id in self.log_views:
            lv = self.log_views[svc_id]
            lv.appendPlainText(line)
            lv.moveCursor(QTextCursor.MoveOperation.End)

    def _on_info_updated(self, branch: str, last_model: str, call_count: int):
        self.lbl_branch.setText(f'Git Branch: <b style="color:#6366f1">{branch}</b>')
        model_color = '#a855f7' if last_model != '-' else '#71717a'
        self.lbl_model.setText(f'Last AI Model: <b style="color:{model_color}">{last_model}</b>')
        usage_color = '#f59e0b' if call_count > 0 else '#71717a'
        self.lbl_usage.setText(f'AI Usage: <b style="color:{usage_color}">{call_count} call(s)</b>')

    def _tick(self):
        for svc_id, card in self.cards.items():
            card.tick()
            self.manager.is_running(svc_id)  # detects unexpected exits
        self._refresh_global_status()

    def _refresh_global_status(self):
        n = sum(1 for s in self.manager.services if self.manager.is_running(s['id']))
        t = len(self.manager.services)
        color = '#10b981' if n == t else ('#f59e0b' if n > 0 else '#52525b')
        self.global_status.setStyleSheet(f'color:{color};background:transparent')
        self.global_status.setText(f'{n}/{t} actifs')

    # ── Shutdown ──

    def _shutdown(self):
        reply = QMessageBox.question(
            self, 'Confirmer',
            'Arrêter tous les services et quitter ?',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            self._do_quit()

    def _do_quit(self):
        self._timer.stop()
        if hasattr(self, 'info_worker') and self.info_worker.isRunning():
            self.info_worker.stop()
        self.manager.stop_all()
        time.sleep(0.4)
        QApplication.quit()

    def closeEvent(self, event):
        reply = QMessageBox.question(
            self, 'Quitter',
            'Arrêter tous les services et quitter ?',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            self._timer.stop()
            if hasattr(self, 'info_worker') and self.info_worker.isRunning():
                self.info_worker.stop()
            self.manager.stop_all()
            event.accept()
        else:
            event.ignore()


# ─── App entry point ──────────────────────────────────────────────────────────

def main():
    log.info('=== Worganic Launcher démarrage ===')
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    app.setApplicationName('Worganic Launcher')

    pal = QPalette()
    pal.setColor(QPalette.ColorRole.Window,           QColor('#0f0f0f'))
    pal.setColor(QPalette.ColorRole.WindowText,       QColor('#e2e2e2'))
    pal.setColor(QPalette.ColorRole.Base,             QColor('#111'))
    pal.setColor(QPalette.ColorRole.AlternateBase,    QColor('#1a1a1a'))
    pal.setColor(QPalette.ColorRole.Text,             QColor('#e2e2e2'))
    pal.setColor(QPalette.ColorRole.Button,           QColor('#1c1c1e'))
    pal.setColor(QPalette.ColorRole.ButtonText,       QColor('#e2e2e2'))
    pal.setColor(QPalette.ColorRole.Highlight,        QColor('#6366f1'))
    pal.setColor(QPalette.ColorRole.HighlightedText,  QColor('#ffffff'))
    pal.setColor(QPalette.ColorRole.ToolTipBase,      QColor('#1c1c1e'))
    pal.setColor(QPalette.ColorRole.ToolTipText,      QColor('#e2e2e2'))
    app.setPalette(pal)

    select_dlg = InstanceSelectDialog()
    if select_dlg.exec() != QDialog.DialogCode.Accepted:
        sys.exit(0)
    offset = select_dlg.offset
    log.info('Instance choisie : offset=%s', offset)

    services = build_services(offset)
    manager  = Manager(services)
    window   = MainWindow(manager, offset=offset)
    window.show()
    log.info('Fenêtre principale affichée')

    # Auto-start all services on launch (Monitor DB exclu : usage occasionnel,
    # démarrable manuellement via sa carte pour ne pas ouvrir une fenêtre en plus
    # à chaque lancement du launcher).
    threading.Thread(target=manager.start_all, kwargs={'exclude': {'monitor'}}, daemon=True).start()

    # Ouvre le portail dans le navigateur avec le portOffset pour propager
    # automatiquement les bons ports vers les URLs des services (API, agent, projets).
    portail_port = next((s['port'] for s in services if s['id'] == 'portail'), 4202 + offset)
    portail_url = f'http://localhost:{portail_port}'
    if offset:
        portail_url += f'/?portOffset={offset}'
    threading.Timer(4.0, lambda: __import__('webbrowser').open(portail_url)).start()

    code = app.exec()
    log.info('=== Worganic Launcher arrêt (code %s) ===', code)
    sys.exit(code)


if __name__ == '__main__':
    main()
