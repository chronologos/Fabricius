from .roam.mock import Roam
from typing import Dict, Tuple, 
from aqt import mw
from aqt.utils import showInfo, showText
from .roam.real import tagQuery, updateBlock

mockCurTime = int(1601249800001)
DEBUG = False

def debugInfo(s):
    if DEBUG:
        showInfo(s)


class Syncer:
    def __init__(self):
        config = mw.addonManager.getConfig(__name__)
        apiKey = config["apiKey"]
        apiToken = config["apiToken"]
        self.roamClient = Roam(apiKey, apiToken)

    # idea is to build a single query that will get all relevant blocks?
    # or is it possible that there will be too much data for a single api call?
    # def buildQuery():

    def sync(self):
        config = mw.addonManager.getConfig(__name__)
        # TODO(chronologos): Add validation for config.
        for cardCfg in config["cards"]:
            modelName = cardCfg["model"]
            deckName = cardCfg["deck"]
            did = mw.col.decks.id(deckName)
            mw.col.decks.select(did)
            model = mw.col.models.byName(modelName)
            if not model:
                showInfo("no such model {}".format(modelName))
                # TODO(chronologos): Add option to auto-create model.
                return
            deck = mw.col.decks.get(did)
            if not deck:
                showInfo("no deck")
                return
            deck["mid"] = model["id"]
            mw.col.decks.save(deck)
            if not "tagMap" in cardCfg:
                showInfo("missing tagMap in config")
                return
            for tag, field in cardCfg["tagMap"].items():
                # [(uid, text, timestamp)]
                matchingBlocks = tagQuery(tag)
                for uid, text, ts in matchingBlocks:
                    self.createOrUpdateCard({field: (text, uid)}, ts)

    def createOrUpdateCard(
        self, res: Dict[str, Tuple[str, str]], blockModifiedTime: str
    ):
        for textField, data in res.items():
            text, uid = data
            refField = refFieldFromTextField(textField)
            queryByRef = "{}:{}".format(refField, uid)
            ids = mw.col.find_notes(queryByRef)
            if not ids:
                # create
                # TODO(chronologos): Collect all errors and display at the end
                debugInfo("card not found for query {}".format(queryByRef))
                note = mw.col.newNote()
                note[refField] = uid
                note[textField] = text
                # TODO(chronologos): process note text
                mw.col.addNote(note)
            else:
                debugInfo("note found for query {} - {}".format(queryByRef, ids))
                if len(ids) > 1:
                    showText(
                        "should never happen: more than 1 note found with block ref {}".format(
                            ids
                        )
                    )
                debugInfo("note ids found = {}".format(ids))

                # update the card based on date
                id = ids[0]
                note = mw.col.getNote(id)
                # Roam returns in nanosecs
                noteModifiedTime = int(note.mod) * 1000
                debugInfo(
                    "noteModifiedTime {}, blockModifiedTime {}, (noteModifiedTime>blockModifiedTime)? {}".format(
                        noteModifiedTime,
                        blockModifiedTime,
                        (noteModifiedTime > blockModifiedTime),
                    )
                )
                if noteModifiedTime > int(blockModifiedTime):
                    debugInfo(
                        "note modified later: changing block in roam {}".format(text)
                    )
                    updateBlock(uid, note[textField])
                else:
                    debugInfo(
                        "block modified later: changing note in anki {}".format(id)
                    )
                    # change note
                    note[textField] = text
                    note.flush()


def refFieldFromTextField(s):
    return "{}UID".format(s)