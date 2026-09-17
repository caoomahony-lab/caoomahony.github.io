# HHF-3 Context-Inference Hotfix Checkpoint

## Purpose

Correct a real-browser scientific defect discovered during phone acceptance of the HHF-3 continuation app.

Observed progression:

`Cmaj7 | E7/G# | Am9 | Fmaj7`

The accepted HHF-3 deployment at `07b399811e5512c2b6b6fc40543422ec5982d544` inferred **E Phrygian** as the leading context because pitch-collection activity was allowed to dominate sequence syntax. The progression contains stronger tonal evidence than that result reflected, especially the explicit dominant-resolution event `E7/G# -> Am` and the opening C-major anchor.

## Scientific correction

Context inference now combines three independent evidence families:

1. pitch-system support;
2. mean local chord/function support;
3. sequence-syntax support.

Sequence-syntax support is explicit and inspectable. It includes:

- tonic-compatible center anchors;
- resolved dominant motion by descending fifth / ascending fourth;
- weaker credit for a resolved applied dominant whose destination belongs to the candidate system;
- boundary evidence, with opening evidence stronger than an unsupported final-chord assumption;
- root membership in the candidate system;
- a penalty when a high-confidence chord rooted on the proposed center contradicts that system's tonic third quality.

The syntax layer is evidence for inference only. It does not claim a context as measured fact and it does not delete competing modal hypotheses.

## Additional correctness fix

Progression rows in the continuation session are now rendered from the **selected top context hypothesis**. Previously the UI could take a chord interpretation from the aggregate cross-hypothesis pool even after a specific context had been selected.

## Regression cases

New regression coverage requires that:

- `Cmaj7 | E7/G# | Am9 | Fmaj7` no longer promotes E Phrygian over C- or A-centered interpretations;
- E Phrygian can remain present as a lower-ranked competing hypothesis when a sufficiently broad hypothesis list is requested;
- syntax evidence remains exposed as inferred evidence;
- continuation rows match the selected context hypothesis exactly.

## Implementation commits

- `ff57ad739eca3585b2835b2cff9f0a0e07bf7e35` — sequence-syntax evidence added to context inference
- `880508af23ab6f08c59a35a8affc6b3dae4449e2` — progression rows bound to selected context
- `ece192539d0a6ce6b52cc784f67eb06c48bd6c2d` — initial regression test
- `2dddd68886cda82afb3622ff849004e90e510f85` — reduced unsupported final-chord tonic bias
- `22ef0f9d6813d29c9b7503f34200ee5165223592` — finalized lower-ranked E-Phrygian regression

## Verification

GitHub Actions run `35229760689` for commit `22ef0f9d6813d29c9b7503f34200ee5165223592` completed successfully:

- install: PASS
- test: PASS
- build: PASS

No merge to `main` was performed.

## Deployment rule

The prior Vercel deployment pinned to `07b399811e5512c2b6b6fc40543422ec5982d544` remains an immutable HHF-3 reference deployment. A replacement deployment must pin the new accepted branch head after this checkpoint commit passes CI.
