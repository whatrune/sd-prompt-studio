# EYE-001-B Opaque Condition Observation

## Blind Contract

- Opaque condition: `COND-c9f43750ab22`
- Observer manifest SHA-256: `d072b0ac6358d7cac20daca54ca0a61a34936ba0324c5be9c079a4effde9a80a`
- Frozen observation SHA-256: `cf035923db8e5c3d430e8c6d8261e304f89ffd022bb5d0874647fae17547e0ba`
- The observer saw only pixels plus opaque condition/pair IDs and hashes. Prompt, run, A/B condition, Task, seed, and generation metadata were hidden.
- The private mapping was read only after the 12-row freeze was re-read and its byte count and SHA-256 were verified. Frozen rows were not altered during decode.

## Visible Pattern

Across 6/6 opaque panels, both eye regions are visible, both eyelids are closed, eye state is assessable, gaze is not assessable, and no ambiguity or artifact is recorded. A frontal face orientation is not pupil-direction evidence.

## Frozen Panel Rows

| Panel | Opaque pair | Eyes visible | Eye state | Gaze direction | Eye-state assessable | Gaze assessable | Ambiguity/artifact |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `PAIR-6b592e7d0493` | both | closed | not_assessable | yes | no | none |
| 2 | `PAIR-d89b0ee34ba4` | both | closed | not_assessable | yes | no | none |
| 3 | `PAIR-6e13e511fbce` | both | closed | not_assessable | yes | no | none |
| 4 | `PAIR-3db2c419da39` | both | closed | not_assessable | yes | no | none |
| 5 | `PAIR-ab5a8f4cd194` | both | closed | not_assessable | yes | no | none |
| 6 | `PAIR-5089ea234de1` | both | closed | not_assessable | yes | no | none |

Each frozen row has the same visible-evidence note: “Both eye regions are visible and unobstructed with both eyelids closed; no pupil-direction evidence is visible.”

## Interpretation Boundary

- Gaze classification requires visible pupil or eye-direction evidence; face orientation alone is insufficient.
- Closed eyes may make gaze `not_assessable`; this is not an automatic gaze failure.
- Condition comparison, seed binding, and final classification were performed only after the freeze hash was verified and the private mapping decoded.
- The condition-local observation does not infer prompt compliance, suppression, contradiction, or production behavior.
