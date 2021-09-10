# Development
- reload roam after replacing javascript, otherwise plugin will not update.
- `npm run bundle` to compile typescript.

# Notes
- Q: Should we resolve block refs? How about recursively?
- A: Maybe we should just support hyperlinks/aliases instead.

This is what the array of {nid, block, note} looks like:

```json
[
  {
    "nid": 1622824657081,
    "block": {
      "string": "DECK1: A nice {c1: block} #[[srs/cloze]] #[[test]]",
      "refs": [
        {
          "id": 45
        },
        {
          "id": 63
        }
      ],
      "user": {
        "id": 1
      },
      "children": [
        {
          "id": 64
        },
        {
          "id": 65
        }
      ],
      "uid": "pLrlQUqrE",
      "open": true,
      "time": 1603364362454,
      "id": 13,
      "parents": [
        {
          "id": 9
        }
      ],
      "order": 1,
      "page": {
        "id": 9
      }
    },
    "note": {
      "noteId": 1622824657081,
      "tags": [],
      "fields": {
        "Text": {
          "value": "DECK1: A nice {{c1:: block}} #[[srs/cloze]] #[[test]]",
          "order": 0
        },
        "TextUID": {
          "value": "{\"block_uid\":\"pLrlQUqrE\",\"block_time\":1603364362454}",
          "order": 1
        },
        "Back Extra": {
          "value": "",
          "order": 2
        }
      },
      "modelName": "ClozeRoam",
      "cards": [1622824657081],
      "block_time": 1603364362454,
      "block_uid": "pLrlQUqrE"
    }
  }
]
```
