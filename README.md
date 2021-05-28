# Fabricius (roam-to-anki v2)

> _Connecting the east side of the city to Tiber Island since 62 BC, the Pons Fabricius (Fabricius Bridge) is the oldest bridge in Rome to survive to the present day. - Wikipedia_

*Fabricius* is an Anki plugin that bidirectionally syncs with Roam Research. The goal is to have robust, fast syncing for the most common use-cases. *NOTE*: Right now it only supports uni-directional sync (roam->anki).

**Disclaimer:** This software is provided as-is and you are responsible for your data. While we have tested this library as far as possible, there may still be bugs. Ideally, you should keep backups of both Roam and Anki data.

## Getting started
- Like any other client-side javascript plugin, install it under a {{roam/js}} block. You will see a new sync button in your top navbar.
- Anki must be running, with the AnkiConnect plugin installed and configured (see below), for the sync button to work. It works fastest if Anki is running in the foreground.
- Configuring AnkiConnect: Go to Anki -> Tools -> Addons -> Anki Connect -> Config and amend `webCorsOriginList` to include `https://roamresearch.com`
- There are more constants (deck, model etc.) that can be tweaked at the top of the js script.