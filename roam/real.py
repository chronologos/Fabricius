import requests
import json
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union
from secrets import GRAPHNAME, APIKEY, APITOKEN, ROAMAPIURL

# i would have used edn_format but Anki plugins should be low-dependency since Anki does not come with all of Python's built-in packages.

# for testing only
DEBUG = False


def debug(s):
    if DEBUG:
        print(s)


# end of testing vars section

CONTENTTYPE = "application/json"


def makeHeaders(apiKey, apiToken):
    return {"Content-Type": CONTENTTYPE, "x-api-key": apiKey, "x-api-token": apiToken}


queryTmpl = """[:find ?uid ?t ?time\
 :where \
 [?e :node/title \"{}\"]\
 [?refs :block/refs ?e]\
 [?refs :block/uid ?uid]\
 [?refs :block/string ?t]\
 [?refs :edit/time ?time]]\
"""

# query returns [[uid, text, modified time]]
def getQuery(graphName: str, tag: str):
    q = {
        "action": "q",
        "graph-name": "",
        "query": [],
    }
    q["query"] = queryTmpl.format(tag)
    q["graph-name"] = graphName
    return json.dumps(q)


def tagQuery(tag: str) -> List[List]:
    try:
        query = getQuery(GRAPHNAME, tag)
        debug(query)
        response = requests.post(
            ROAMAPIURL,
            query,
            headers=makeHeaders(APIKEY, APITOKEN),
        )
        debug(response)
        debug(response.content)
        return json.loads(response.content)["success"]
    except Exception as e:
        print("unhandled exception: {}".format(e))
        return []


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


def updateBlock(ref, newText):
    try:
        query = makeUpdate(GRAPHNAME, ref, newText)
        debug(query)
        response = requests.post(
            ROAMAPIURL,
            query,
            headers=makeHeaders(APIKEY, APITOKEN),
        )
        debug(response)
        debug(response.content)
        return json.loads(response.content)["success"]
    except Exception as e:
        print("unhandled exception: {}".format(e))
        return []


print(tagQuery("srs/cloze"))
print(updateBlock("iqIV6RbYK", "pip"))