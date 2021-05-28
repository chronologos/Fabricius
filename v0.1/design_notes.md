# Design Notes
_Updated: 2021-01-24_

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

we will expect all the fields (specified as values in `tagMap`) to exist in the given model. In addition `{field}UID` must also exist as a field. This allows the plugin to track which field in the Anki note maps to which Roam block.

Roam is the source of truth for which notes should exist. If the block uid disappears from Roam, the corresponding note in Anki will be orphaned. This will have to be deleted via `Tools -> Fabricus: Clear Orphans`.

1. Plugin pulls all relevant (block, modification date) based on configured tags from Roam.
2. If the card does not exist in anki, create a new card
3. Load the corresponding notes in Anki and read their modification date
4. If they are unequal, resolve with the newer one (either pushing back to Roam, or adding a card to Anki)

## Ideas for other note models

### Using Nesting to represent custom cards
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

Pros:
- Very flexible

Cons:
- Each model would need to have unique field names
- More complicated to implement since we don't know which field will be a parent block.

### Using "header" tags for custom models
```text
    - #srs/country <----- everything under this block will be considered as one note in Anki.
        - What is the [[srs/countrycapital]] of Italy? <----- we support this notation too
        - Rome #srs/countrycapitalans
        - Pizza came from Italy. <----- anything without relevant tags will be ignored. 
```

Simpler to implement and also quite intuitive.

## Testing Notes

These are some scenarios to test before releases:

- block changed in roam
- block deleted in roam
- note deleted in Anki
- note changed in Anki
- `config.json`: multiple items in `cards` field