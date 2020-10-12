import re

from typing import Dict, Tuple, List
from aqt import mw
from aqt.utils import showInfo, showText
from .roam.real import Client
from .roam.secrets import GRAPHNAME, APIKEY, APITOKEN, ROAMAPIURL

DEBUG = False

# Dict keys for config.json
CONFIG_API_KEY_K = "apiKey"
CONFIG_API_TOKEN_K = "apiToken"
CONFIG_CARD_K = "cards"
CONFIG_CARD_MODEL_K = "model"
CONFIG_CARD_DECK_K = "deck"
CONFIG_CARD_TAGS_K = "tagMap"


def debugInfo(s):
    if DEBUG:
        showInfo(s)


def showAndThrowErrors(errors: List[str]):
    if len(errors) != 0:
        errorStr = "; ".join(errors)
        showInfo(errorStr)
        raise Exception(errorStr)


class Syncer:
    def __init__(self):
        config = mw.addonManager.getConfig(__name__)
        errors = []
        for k in [CONFIG_API_KEY_K, CONFIG_API_TOKEN_K, CONFIG_CARD_K]:
            if not k in config:
                errors.append('did not find required key "{}" in config.json'.format(k))
        showAndThrowErrors(errors)
        for i, cardConfig in enumerate(config[CONFIG_CARD_K]):
            for k in [CONFIG_CARD_MODEL_K, CONFIG_CARD_DECK_K, CONFIG_CARD_TAGS_K]:
                if not k in cardConfig:
                    errors.append(
                        'did not find required key "{}" for card at index {} in config.json'.format(
                            k, i
                        )
                    )
        showAndThrowErrors(errors)
        self.errorLog = []
        # TODO(chronologos) before releasing, use key, token and graphname from config
        self.roamClient = Client(GRAPHNAME, APIKEY, APITOKEN, ROAMAPIURL)

    # idea is to build a single query that will get all relevant blocks?
    # or is it possible that there will be too much data for a single api call?
    # def buildQuery():

    def sync(self):
        config = mw.addonManager.getConfig(__name__)
        for cardCfg in config[CONFIG_CARD_K]:
            modelName = cardCfg[CONFIG_CARD_MODEL_K]
            deckName = cardCfg[CONFIG_CARD_DECK_K]
            deckID = mw.col.decks.id(deckName, create=True)
            mw.col.decks.select(deckID)
            model = mw.col.models.byName(modelName)
            if not model:
                showInfo(
                    'no such model "{}", please create it before proceeding. Sync stopped.'.format(
                        modelName
                    )
                )
                # TODO(chronologos): Add option to auto-create model.
                # PRIORITY = P4
                return
            deck = mw.col.decks.get(deckID, default=False)
            if not deck:
                showInfo(
                    'no such deck "{}", please create it before proceeding. Sync stopped.'.format(
                        deck
                    )
                )
                return
            deck["mid"] = model["id"]
            mw.col.decks.save(deck)
            for tag, field in cardCfg[CONFIG_CARD_TAGS_K].items():
                # [(uid, text, timestamp)]
                matchingBlocks = self.roamClient.queryForTag(tag)
                for block in matchingBlocks:
                    self.createOrUpdateNote(
                        {field: (block.text, block.uid)}, block.modifiedTime, deckID
                    )

    def createOrUpdateNote(
        self, res: Dict[str, Tuple[str, str]], blockModifiedTime: str, did: int
    ):
        for textField, data in res.items():
            text, uid = data
            refField = refFieldFromTextField(textField)
            queryByRef = "{}:{}".format(refField, uid)
            ids = mw.col.find_notes(queryByRef)
            if not ids:
                # create
                # TODO(chronologos): Collect all errors and display at the end
                # PRIORITY = P2
                debugInfo("card not found for query {}".format(queryByRef))
                note = mw.col.newNote()
                note[refField] = uid
                note[textField] = convertToCloze(text)
                mw.col.add_note(note, did)
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
                # Text is from Roam
                # note[textField] is from Anki.
                textInAnkiFormat = convertToCloze(text)
                if note[textField] == textInAnkiFormat:
                    debugInfo("skipping this note/block since contents are the same")
                    continue
                if noteModifiedTime > int(blockModifiedTime):
                    debugInfo(
                        "note modified later: changing block (({})) in roam with text {}".format(
                            uid, note[textField]
                        )
                    )
                    self.roamClient.updateBlock(
                        uid, convertToRoamBlock(note[textField])
                    )
                else:
                    debugInfo(
                        "block modified later: changing note {} in anki with text {}".format(
                            id, textInAnkiFormat
                        )
                    )
                    # change note
                    note[textField] = textInAnkiFormat
                    note.flush()
                    debugInfo(note.__repr__())


def convertToCloze(s: str):
    res = re.sub(r"{\s*c(\d*):([^}]*)}", r"{{c\g<1>::\g<2>}}", s)
    return res


def convertToRoamBlock(s: str):
    res = re.sub(r"{{c(\d*)::([^}]*)}}", r"{c\g<1>:\g<2>}", s)
    return res


def refFieldFromTextField(s):
    return "{}UID".format(s)