from aqt import mw
from .sync import Syncer

from aqt.qt import QAction

def syncAll():
    s = Syncer()
    s.sync()

action = QAction("Sync Roam and Anki", mw)
action.triggered.connect(syncAll)
mw.form.menuTools.addAction(action)