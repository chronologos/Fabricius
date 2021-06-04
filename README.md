# Fabricius (roam-to-anki v2)
> _Connecting the east side of the city to Tiber Island since 62 BC, the Pons Fabricius (Fabricius Bridge) is the oldest bridge in Rome to survive to the present day. - Wikipedia_

*Fabricius* is an Anki plugin that bidirectionally syncs with Roam Research. The goal is to have robust, fast syncing for the most common use-cases.

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/chronologos/Fabricius?sort=semver)

**Disclaimer:** This software is provided as-is and you are responsible for your data. While we have tested this library as far as possible, there may still be bugs. You should keep backups of both Roam and Anki data.

## Getting started
- Like any other client-side javascript plugin, install `main.js` in a javascript code block nested under a `{{roam/js}}` block. You will see a new sync button in your top navbar.
- Anki must be running, with the AnkiConnect plugin installed and configured (see below), for the sync button to work. It works fastest if Anki is running in the foreground.
- Configuring AnkiConnect: Go to Anki -> Tools -> Addons -> Anki Connect -> Config and amend `webCorsOriginList` to include `https://roamresearch.com`
- There are more constants (deck, note type etc.) that can be tweaked at the top of the js script.

## Example


If we have the following text in a Roam block with block id `f-123`:
```text
    - "In [[C]], we can have {c2:indirect references} to variables are using {c1:[[pointers]]} #srs/cloze"
```

we get this note in Anki with Text = 
```
In [[C]], we can have {{c2::indirect references}} to variables using {{c1::[[pointers]]}} #srs/cloze
```

and Metadata = `f-123`.

- This assumes the default configuration of main.js
- Note the modified cloze syntax, since Roam reserves `{{}}` and `::` for internal use. 
- An Anki note type named `ClozeRoam` with fields `Text` and `Metadata` has to exist in a deck named `Default`.
- Please see [Anki docs](https://docs.ankiweb.net/templates/generation.html?highlight=cloze#cloze-templates) for more info on how a cloze note type needs to be configured (easiest is to clone the built-in Cloze note type).

## Advanced: Group Tags

Group tags do 2 things:
1. Any child block under a block with a group tag is considered a cloze, unless there are no cloze marks `{c1:...}` on it.
2. Clozes generated from said child blocks automatically include context from the parent block.

So something like this in Roam:
```text
    - Caffeine #srs/cloze-g
        - Tastes good
        - Is an {c1:adenosine} antagonist.
        - Has a half-life of {c1:5} hours.
```

Would create 2 cloze notes (skipping the first child). Both cloze notes will have `Caffeine #srs/cloze-g` populated in the `ANKI_FIELD_FOR_GROUP_HEADER` field.

## Caveats
- Don't edit the sync metadata on the Anki note.
- The Roam block UID is used to identify the corresponding note in Anki. Avoid taking actions which cause the block UID of a Roam block to change.
- You can't create a new note in Anki and sync it to Roam.
- There is no garbage collection for unused notes in Anki (yet).
- If the same uid is updated in both Roam and Anki, Roam will be taken as the source of truth.

