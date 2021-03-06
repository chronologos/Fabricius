# Fabricius (roam-to-anki v2)
_Updated: 2021-01-24_

NOTE 🍩 - This requires access to the Roam Alpha API for now. If you have access to that, I am happy to accept alpha testers.

---

*Fabricius* is an Anki plugin that bidirectionally syncs with Roam Research. The goal is to have robust, fast syncing for the most common use-cases.

_Connecting the east side of the city to Tiber Island since 62 BC, the Pons Fabricius (Fabricius Bridge) is the oldest bridge in Rome to survive to the present day. - Wikipedia_

**Disclaimer:** This software is provided as-is and you are responsible for your data. While we have tested this library as far as possible, there may still be bugs. Ideally, you should keep backups of both Roam and Anki data.

## Getting started
You need to define a `config.json` as well as a custom [note type](https://docs.ankiweb.net/#/getting-started?id=note-types) that will be used by the plugin. As a recommended starter configuration, we recommend that you use cloze notes:

```json
{
    "apiKey": "{this is the key that identifies you to the Roam Alpha API}",
    "apiToken": "{this is the secret that identifies you to the Roam Alpha API}",
    "roam_db_name": "{this is the name of your roam graph e.g. my-db}",
    "cards": [
        {
            "model" : "ClozeRoam",
            "deck" : "default",
            "tagMap": {"srs":"Text"}
        }
    ]
}
```

This configuration requires you to first have created a matching Anki *note type* (also known as *model*) [instructions in anki docs](https://docs.ankiweb.net/#/getting-started?id=note-types). The note type needs to be called "ClozeRoam, with at least the following two fields: 
1. `Text` (which is synced by looking for blocks with the `#srs` tag in Roam), and
2. `TextUID` (which is an implementation detail that allows the plugin to track the Roam block ID where the Anki note came from).

## Syncing cloze notes

When the plugin sees the cloze syntax in Roam text, it will automatically convert it to Anki's cloze syntax. The Anki model should support clozes (but the plugin won't complain if it doesn't).

So, given the following text in Roam (*note the modified cloze syntax, since Roam reserves `{{}}` and `::` for internal use*):
```text
    - "In [[C]], we can have {c2:indirect references} to variables are using {c1:[[pointers]]} #srs"
```

and a plugin config that maps tags to fields in the Anki model:
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

we get the resulting card in Anki with Text = 
```
In [[C]], we can have {{c2::indirect references}} to variables using {{c1::[[pointers]]}} #srs
```

and TextUID = `{someRoamBlockUID}`.

## Limitations
_Updated: 2021-01-24_

Starting from the most important:
- Formatting support right now is experimental. I recommend syncing only unstyled portions of text right now.
- A synced note in Anki is linked to a fixed block ID in Roam. If the block ID changes, you will lose the review schedule of the card. Consequently, this means you need to be careful not to accidentally delete blocks with SR prompts in them.
- Syncing when the deck browser is open may cause failure to sync from anki to roam.
- If we remove cloze deletions from an already-synced Roam Block, the corresponding cloze card needs to be emptied manually in Anki after syncing (Tools -> Empty Cards...)
