#!/usr/bin/env python3
"""Worganic Monitor DB — fenêtre PyQt6 standalone de surveillance temps réel.

Lancé en process Python séparé depuis launcher_app.py (PyQt6 ne supporte
qu'une seule QApplication par process). 100% autonome et lecture seule sur
MySQL : aucune dépendance à l'API Node, aucune écriture possible.

Usage : python monitor_app.py [--offset N]
"""
import argparse
import logging
import os
import sys

from PyQt6.QtWidgets import QApplication, QMessageBox

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

LOG_FILE = os.path.join(ROOT, 'monitor.log')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler(LOG_FILE, encoding='utf-8')],
)
log = logging.getLogger('monitor')

from monitor import theme
from monitor.db_config import load_db_config, DbConfigError
from monitor.db_client import MonitorDbClient
from monitor.ui.main_window import MonitorWindow

INSTANCE_2_OFFSET = 10


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--offset', type=int, default=0,
                         help="Décalage de ports à surveiller (10 = instance 2)")
    args = parser.parse_args()

    log.info('=== Monitor DB démarrage (offset=%s) ===', args.offset)

    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    app.setApplicationName('Worganic Monitor DB')
    theme.apply_dark_palette(app)

    try:
        cfg = load_db_config()
    except DbConfigError as e:
        log.error('Configuration manquante: %s', e)
        QMessageBox.critical(None, 'Configuration manquante', str(e))
        sys.exit(1)

    db_client = MonitorDbClient(cfg, pool_size=2)
    service_ports = {
        'API': 3001 + args.offset,
        'Agent': 3003 + args.offset,
        'Portail': 4202 + args.offset,
        'Projets': 4203 + args.offset,
    }

    window = MonitorWindow(db_client, service_ports, offset=args.offset)
    window.show()
    log.info('Fenêtre Monitor DB affichée')

    code = app.exec()
    db_client.close_all()
    log.info('=== Monitor DB arrêt (code %s) ===', code)
    sys.exit(code)


if __name__ == '__main__':
    main()
