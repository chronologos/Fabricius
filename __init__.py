# import the main window object (mw) from aqt
from aqt import mw
import aqt
from .sync import Syncer

# import all of the Qt GUI library
from aqt.qt import *

# We're going to add a menu item below. First we want to create a function to
# be called when the menu item is activated.


def syncAll():
    s = Syncer()
    s.sync()

# create a new menu item, "test"
action = QAction("test", mw)
# set it to call testFunction when it's clicked
action.triggered.connect(syncAll)
# and add it to the tools menu
mw.form.menuTools.addAction(action)