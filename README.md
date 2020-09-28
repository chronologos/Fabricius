# Fabricius

Fabricius is an Anki plugin that bidirectionally syncs between Roam and Anki.

Connecting the east side of the city to Tiber Island since 62 BC, the Pons Fabricius (Fabricius Bridge) is the oldest bridge in Rome to survive to the present day.

## Getting started
You need to define a `config.json` as well as custom note type(s) that will be used by the plugin. As a recommended starter configuration, we recommend that you use cloze notes:

```json
{
    "api_key": "...",
    "roam_db_name": "my-db",
    "cards": [
        {
            "model" : "ClozeRoam",
            "deck" : "default",
            "tagMap": {"srs":"Text"}
        }
    ]
}
```

create the following Anki *note type* (also known as *model*) [instructions in anki docs](https://docs.ankiweb.net/#/getting-started?id=note-types):
```text
ClozeRoam
- Text
- TextUID
```

## Syncing cloze notes

When the plugin sees the cloze syntax in Roam text, it will automatically convert it to Anki's cloze syntax. The Anki model should support clozes (but the plugin won't complain if it doesn't).

anki model:
```text
ClozeRoam
- Text
- TextUID
```

text in Roam (*note the modified cloze syntax, since Roam reserves `{{}}` for internal use*)
```text
    - "In [[C]], {c2:indirect references} to variables are done via {c1:[[pointers]]} #srs"
```

plugin config maps tags to fields in the Anki model:
```json
{
    "cards": [
        {
            "model" : "ClozeRoam",
            "deck" : "default",
            "tagMap": {"srs":"Text"}
        }
    ]
}
```

resulting card in anki 
```
In [[C]], {{c2::indirect references}} to variables are done via {{c1::[[pointers]]}} #srs
```

## Other note models

Blocks nested under one another are treated as a single note. Not all fields in a note need to be specified, and order of the fields does not matter.

anki model:
```text
MyAnkiModel
- Front
- FrontUID
- Back
- BackUID
- Info
- InfoUID
```

plugin config maps tags to fields in the Anki model:
```json
{
    "cards": [
        {
            "model" : "MyAnkiModel",
            "deck" : "default",
            "tagMap": {"srs/f":"Front", "srs/e":"Back", "srs/info": "Info"}
        }
    ]
}
```

## Sync model (simplified)
For a given config:

```json
{
    "cards": [
        {
            "model" : "MyAnkiModel",
            "deck" : "default",
            "tagMap": {"srs/f":"Front", "srs/e":"Back", "srs/info": "Info"}
        }
    ]
}
```

we will expect all the fields (specified as values in `tagMap`) to exist. In addition `{field}UID` must also exist as a field. This allows the plugin to track which field in the Anki note maps to which Roam block.

1. Plugin pulls all relevant (block, modification date) based on configured tags from Roam.
2. If the card does not exist in anki, create a new card
3. Load the corresponding notes in Anki and read their modification date
4. If they are unequal, resolve with the newer one (either pushing back to Roam, or adding a card to Anki)


### Roadmap
1. Cloze bidirectional sync
2. Support reconciliation 
   1. Probably use roam as source of truth. block refs might change, entire blocks may be deleted. What is the behaviour then?
3. Support other note models
4. Support tag sync