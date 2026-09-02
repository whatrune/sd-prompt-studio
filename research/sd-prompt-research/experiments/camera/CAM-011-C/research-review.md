# CAM-011 Prompt-Blind Research Review

## Final Experiment Classification

**INCONCLUSIVE**

All 18 panels are independently provenance-valid. The predeclared assessability/ambiguity prerequisites FAIL. Classification uses subject frame-height occupancy and matched ordinal separation; existing framing labels are not used as the primary classifier.

## Blinding and Provenance

- Panels: 18/18; missing or corrupt: 0.
- Exact model/hash, Euler a, Automatic, 20 steps, CFG 4.5, 1024x1024, and frozen settings: PASS.
- Across runs, the only positive-prompt difference is the terminal subject-distance phrase; negative prompts and ordered seeds are equal.
- response.parameters, parsed response.info, structural infotext, and PNG bindings: PASS 18/18.
- Observer input contained only opaque condition IDs, opaque panel IDs, and pixels.
- Canonical observer-input SHA-256: `32bcd7c6492f2737e1e9dd7ebc20c65ab0b2467f3a949a12d9514b3d4a204308`.
- Frozen visual observation SHA-256: `1207e68094d282305cbf3a5e3c5de8d0a0bf6a6db35530b6049a58caf3ca766f`.
- Sealed condition mapping SHA-256: `7d82edc53ced13949e1680b415a4fcbfb151f297e9b98b6a8654693144b614e9`.
- Canonical tracked blind-record owner: `research/sd-prompt-research/experiments/camera/CAM-011-A/source/CAM-011-A_metadata.yaml`.
- Condition mapping was decoded only after the visual record was frozen; no frozen visual row changed after decode.

## Per-Arm Metrics

| Run | Phrase | Target occupancy band | Assessable | Ambiguity/artifact | Frame-height counts |
| --- | --- | ---: | ---: | ---: | --- |
| CAM-011-A | `subject close to camera` | 6/6 | 6/6 | 2/6 | {'large': 3, 'very_large': 3} |
| CAM-011-B | `subject at medium distance from camera` | 0/6 | 6/6 | 1/6 | {'large': 4, 'very_large': 2} |
| CAM-011-C | `subject far from camera` | 0/6 | 6/6 | 1/6 | {'large': 4, 'very_large': 2} |

## Matched-Seed Ordinal Discrimination

| Comparison | Correctly ordered by visible subject frame-height occupancy |
| --- | ---: |
| near vs medium | 1/6 |
| medium vs far | 0/6 |
| near vs far | 1/6 |

The ordinal comparison is derived only after decode from frozen visible occupancy bands. It does not use `full body`, `cowboy shot`, `upper body`, `close-up`, or another production framing label as the primary classifier.

## Research Boundary

CAM-011 changes no PromptTag, camera/framing slot, Concept Graph, compiler/runtime, production advisory, UI, schema, platform, or production behavior.
