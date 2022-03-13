# Fabricius (roam-to-anki v2)
> _Connecting the east side of the city to Tiber Island since 62 BC, the Pons Fabricius (Fabricius Bridge) is the oldest bridge in Rome to survive to the present day. - Wikipedia_

*Fabricius* is a Roam Research plugin that allows bidirectional sync with Anki. The goal is to have robust, fast syncing for the most common use-cases.

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/chronologos/Fabricius?sort=semver)

**Disclaimer:** This software is provided as-is and you are responsible for your data. While we have tested this library as far as possible, there may still be bugs. You should keep backups of both Roam and Anki data.

## Getting started
- Like any other client-side javascript plugin, install `dist/browser.js` in a javascript code block nested under a `{{roam/js}}` block. You will see a new sync button in your top navbar.
- Anki must be running, with the AnkiConnect plugin installed and configured (see below), for the sync button to work. It works fastest if Anki is running in the foreground.
- Configuring AnkiConnect: Go to Anki -> Tools -> Addons -> Anki Connect -> Config and amend `webCorsOriginList` to include `https://roamresearch.com`
- There are more constants (deck, note type etc.) that can be tweaked at the top of the js script. Due to Typescript compilation, these config variables may be located further down in `browser.js`. Please look at `src/config.ts` to see the available variables and their names.

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

- This assumes the default configuration of browser.js
- Note the modified cloze syntax, since Roam reserves `{{}}` and `::` for internal use. 
- An Anki note type named `ClozeRoam` with fields `Text` and `Metadata` has to exist in a deck named `Max Infinity`.
- Please see [Anki docs](https://docs.ankiweb.net/templates/generation.html?highlight=cloze#cloze-templates) for more info on how a cloze note type needs to be configured (easiest is to clone the built-in Cloze note type).

Title tags provide context to 

## Advanced: Group and Title Tags - Pull in more context!

*Title tags* provide context for any nested blocks. *Group tags* augment title tags by providing extra context for a block from the *closest* context-providing block. The default title tag is `#srs/cloze-t` and syncs to the `Title` field. The default group tag is `#srs/cloze-g` and syncs to the `Extra` field.

So something like this in Roam:
```text
    - Stimulants #srs/cloze-t
      - Caffeine #srs/cloze-g
          - Tastes bitter.
          - Is an {c1:adenosine} antagonist.
          - Adenosine antagonists #srs/cloze-g
            - bind to adenosine receptors with no {c1:physiological effect}.
          - Has a half-life of {c1:5} hours.
```

Would create 3 cloze notes.

```
Title: Stimulants
Text: Is an {{c1::adenosine}} antagonist.
Extra: Caffeine
```

```
Title: Stimulants
Text: Has a half-lfe of {{c1::5}} hours.
Extra: Caffeine
```

```
Title: Stimulants
Text: Bind to adenosine receptors with no {{c1::physiological effect}}.
Extra: Adenosine antagonists
```

Specifically, group tags work in the following way:

1. Any child blocks (direct or indirect) under a block with a **group tag** is considered a cloze, unless there are no cloze marks `{c1:...}` on it.
2. Clozes generated from said child blocks automatically include context from the **closest parent** block.

## Caveats and Limitations
- Don't edit the sync metadata on the Anki note.
- The Roam block UID is used to identify the corresponding note in Anki. Avoid taking actions which cause the block UID of a Roam block to change.
- You can't create a new note in Anki and sync it to Roam.
- There is no garbage collection for unused notes in Anki (yet).
- If the same uid is updated in both Roam and Anki, Roam will be taken as the source of truth.
- Changes to group tags and title tags do not cause a sync for clozes blocks underneath them. The actual cloze block must be updated.


