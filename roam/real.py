import requests
import json
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union
from .secrets import GRAPHNAME, APIKEY, APITOKEN, ROAMAPIURL

# i would have used edn_format but Anki plugins should be low-dependency since Anki does not come with all of Python's built-in packages.

# for testing only
DEBUG = False


def debug(s):
    if DEBUG:
        print(s)


# end of testing vars section

CONTENTTYPE = "application/json"


class Error(Exception):
    """Base class for exceptions in this module."""

    pass


class InputError(Error):
    """Exception raised for errors in the input.

    Attributes:
        expression -- input expression in which the error occurred
        message -- explanation of the error
    """

    def __init__(self, expression: str, message: str):
        self.expression = expression
        self.message = message

    def __repr__(self) -> str:
        return 'input "{}" led to exception: {}'.format(self.expression, self.message)


def makeHeaders(apiKey: str, apiToken: str):
    return {"Content-Type": CONTENTTYPE, "x-api-key": apiKey, "x-api-token": apiToken}


def trunc(s: str):
    if len(s) < 10:
        return s
    return "{}...".format(s[0:10])


class Block:
    def __init__(self, uid="", text="", modifiedTime=0):
        self.uid = uid
        self.text = text
        # As of 2020-10-11, this is in unix epoch milliseconds.
        self.modifiedTime = modifiedTime

    def __repr__(self):
        return "(({} - {} - {}))".format(self.uid, trunc(self.text), self.modifiedTime)


queryTmpl = """[:find ?uid ?t ?time\
 :where \
 [?e :node/title \"{}\"]\
 [?refs :block/refs ?e]\
 [?refs :block/uid ?uid]\
 [?refs :block/string ?t]\
 [?refs :edit/time ?time]]\
"""


class Client:
    def __init__(self, graphName: str, apiKey: str, apiToken: str, apiUrl: str):
        self.graphName = graphName
        self.apiKey = apiKey
        self.apiToken = apiToken
        self.apiUrl = apiUrl
        self.defaultHeader = makeHeaders(self.apiKey, self.apiToken)

    def queryForTag(self, tag: str) -> List[Block]:
        """Queries for all Roam blocks that have the given tag. As of 2020-10-11, this does not match the tag if it is in a reference or embed (and this is good).

        Args:
            tag: Tag to search for.

        Returns:
            List of blocks.

        Raises:
            InputError if query call fails.
        """
        try:
            query = getQuery(self.graphName, tag)
            debug(query)
            response = requests.post(
                self.apiUrl,
                query,
                headers=self.defaultHeader,
            )
            debug(response)
            debug(response.content)
            res = json.loads(response.content)["success"]
            resBlocks = map(lambda l: Block(l[0], l[1], l[2]), res)
            return resBlocks
        except KeyError as e:
            raise InputError(query, "error querying for tag")

    def updateBlock(self, ref: str, newText: str):
        """Updates a single Roam block.
        Args:
            ref: Roam block uid of the block to be updated.
            newText: Text to update the block with.

        Returns:
            Nothing

        Raises:
            InputError if update call fails.
        """
        try:
            query = makeUpdate(self.graphName, ref, newText)
            debug(query)
            response = requests.post(
                self.apiUrl,
                query,
                headers=self.defaultHeader,
            )
            debug(response)
            debug(response.content)
            return json.loads(response.content)["success"]
        except KeyError as e:
            raise InputError(query, "error updating roam block")


def getQuery(graphName: str, tag: str) -> str:
    q = {
        "action": "q",
        "graph-name": "",
        "query": [],
    }
    q["query"] = queryTmpl.format(tag)
    q["graph-name"] = graphName
    return json.dumps(q)


def makeUpdate(graphName: str, ref: str, newText: str):
    u = {
        "action": "update-block",
        "graph-name": "",
        "block": {
            "uid": "",
            "string": "",
        },
    }
    u["graph-name"] = graphName
    u["block"]["uid"] = ref
    u["block"]["string"] = newText
    return json.dumps(u)


# TODO(chronologos) Delete before release
r = Client(GRAPHNAME, APIKEY, APITOKEN, ROAMAPIURL)
print(list(r.queryForTag("srs/cloze")))
# print(r.updateBlock("JTV1Al3Pe", "pip"))