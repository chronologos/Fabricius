import re

from typing import Dict, Tuple, List
from aqt import mw
from aqt.utils import showInfo, showText
from .roam.real import Client, InputError
from .tools.markdown2.lib.markdown2 import markdown

DEBUGWARNING = True
DEBUGVERBOSE = False

# Dict keys for config.json
CONFIG_API_KEY_K = "apiKey"
CONFIG_API_TOKEN_K = "apiToken"
CONFIG_GRAPH_NAME_K = "graphName"
CONFIG_API_URL_K = "roamAPIUrl"
CONFIG_CARD_K = "cards"
CONFIG_CARD_MODEL_K = "model"
CONFIG_CARD_DECK_K = "deck"
CONFIG_CARD_TAGS_K = "tagMap"


def debugInfo(s):
    if DEBUGVERBOSE:
        showInfo(s)


def debugWarning(s):
    if DEBUGWARNING:
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
        for k in [
            CONFIG_API_KEY_K,
            CONFIG_API_TOKEN_K,
            CONFIG_GRAPH_NAME_K,
            CONFIG_API_URL_K,
            CONFIG_CARD_K,
        ]:
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
        self.roamClient = Client(
            config[CONFIG_GRAPH_NAME_K],
            config[CONFIG_API_KEY_K],
            config[CONFIG_API_TOKEN_K],
            config[CONFIG_API_URL_K],
        )

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
            for tag, field in cardCfg[CONFIG_CARD_TAGS_K].items():
                # [(uid, text, timestamp)]
                matchingBlocks = self.roamClient.queryForTag(tag)
                for block in matchingBlocks:
                    self.createOrUpdateNote(
                        {field: (block.text, block.uid)}, block.modifiedTime, deckID
                    )
            mw.col.decks.save(deck)
        mw.col.save()
        if len(self.errorLog) > 0:
            showAndThrowErrors(self.errorLog)

    def createOrUpdateNote(
        self, res: Dict[str, Tuple[str, str]], blockModifiedTime: str, did: int
    ):
        for textField, data in res.items():
            text, uid = data
            refField = refFieldFromTextField(textField)
            queryByRef = "{}:{}".format(refField, uid)
            ids = mw.col.find_notes(queryByRef)
            if not ids:
                debugInfo("card not found for query {}".format(queryByRef))
                note = mw.col.newNote()
                note[refField] = uid
                note[textField] = convertToCloze(text)
                mw.col.add_note(note, did)
            else:
                debugInfo("note found for query {} - {}".format(queryByRef, ids))
                if len(ids) > 1:
                    showText(
                        'should never happen: more than 1 note found with block ref {}. Please search for the duplicate and delete it. You can use the query "{}". After deleting, run Fabricus Sync again.'.format(
                            ids,
                            queryByRef,
                        )
                    )
                debugInfo("note ids found = {}".format(ids))

                # update the card based on date
                id = ids[0]
                note = mw.col.getNote(id)
                # Roam returns in msecs
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
                    try:
                        self.roamClient.updateBlock(
                            uid, convertToRoamBlock(note[textField])
                        )
                    except InputError as e:
                        self.logError(e)
                else:
                    debugWarning(
                        "block modified later: changing note {} in anki with text {}".format(
                            id, textInAnkiFormat
                        )
                    )
                    # change note
                    note[textField] = textInAnkiFormat
                    note.flush()
                    debugWarning(note.__repr__())

    def logError(self, t: str):
        self.errorLog.append(t)


def convertToCloze(s: str):
    res = re.sub(r"{\s*c(\d*):([^}]*)}", r"{{c\g<1>::\g<2>}}", s)
    basicMarkdownToHtml(res)
    return res


def convertToRoamBlock(s: str):
    res = re.sub(r"{{c(\d*)::([^}]*)}}", r"{c\g<1>:\g<2>}", s)
    res = basicHtmlToMarkdown(res)
    return res


# Markdown <-> HTML conversion using regex is hacky but the best we can do for now.
# 1 hour investigation with html->md and md->html libraries proved unsuccessful with too many edge cases.
# Main issue is that both fns need to be "inverses" otherwise cards will start to get mis-formatted.
def basicHtmlToMarkdown(s: str):
    # TODO(chronologos): Probably shouldn't be using regex here.
    s = re.sub(r"<b>", "**", s)
    s = re.sub(r"</b>", "**", s)
    s = re.sub(r"<i>", "__", s)
    s = re.sub(r"</i>", "__", s)
    return s


def basicMarkdownToHtml(s: str):
    # ungreedy match
    res = re.sub(r"\*\*(.*?)\*\*", r"<b>\g<1></b>", s)
    # ungreedy match
    res = re.sub(r"__(.*?)__", r"<i>\g<1></i>", res)
    return res


def refFieldFromTextField(s):
    return "{}UID".format(s)