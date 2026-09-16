# Engineering Doctrine

Status: **Standing project-development doctrine**

This document defines how coding projects in this repository should evolve. It is intentionally broader than any single feature or implementation. Project-specific constitutions may add stricter rules, but they must not silently weaken these principles.

## 1. Preserve the goal before preserving the implementation

The implementation may change. The goal does not disappear merely because the current architecture makes it inconvenient.

A feature, scientific objective, user capability, export requirement, or interoperability requirement that has been accepted into a project goal document remains part of the project unless one of the following is demonstrated:

1. it is physically, mathematically, legally, or technically impossible under the project's stated constraints; or
2. the goal itself is explicitly replaced by a new goal that is demonstrably stronger and preserves the original user's capability.

Difficulty, schedule pressure, platform limitations, API inconvenience, or a cleaner codebase are not sufficient reasons to delete an accepted goal.

## 2. Better methods are welcome, but replacement carries a burden of proof

A proposed replacement architecture, algorithm, platform, data representation, parser, visualization, deployment method, or scientific interpretation must not replace the existing canonical implementation merely because it appears newer, simpler, more elegant, or more fashionable.

Before replacement, the proposer must demonstrate that the new method is better for the project by supplying evidence appropriate to the change. At minimum this should include:

- preserved functional requirements;
- preserved scientific semantics;
- regression-test parity;
- import/export compatibility or a documented migration path;
- data/provenance preservation;
- performance and reliability comparison where relevant;
- failure-mode comparison;
- maintainability rationale;
- rollback capability;
- explicit list of any behavior that changes.

If the evidence is incomplete, the proposed method should remain additive or experimental rather than becoming canonical.

## 3. Prefer additive evolution

When practical, new capabilities should be added beside stable ones before older mechanisms are removed. Experimental paths should be labeled as such. Canonical behavior should remain available until the replacement has passed acceptance gates.

## 4. Separate domain truth from presentation

Scientific, mathematical, musical, analytical, or business logic should live in reusable core modules rather than being encoded inside one UI framework, host platform, notebook, visualization, or vendor-specific deployment layer.

The preferred dependency direction is:

```text
canonical data / domain model
        ↓
analysis engines
        ↓
application services
        ↓
UI / visualization / adapters / deployment targets
```

A deployment target must not become the source of truth for the domain model.

## 5. Open representations first

Canonical project data should use documented, versioned, portable representations whenever practical. Proprietary formats may be supported through adapters, but the only surviving copy of important project data must not depend on a proprietary platform.

Every major canonical data format should have:

- a schema or explicit contract;
- a version;
- deterministic serialization where practical;
- import/export tests;
- migration rules when the schema changes.

## 6. Reproducibility and provenance are features

Important derived results should record enough information to reproduce them, including source identity, analysis version, configuration, assumptions, and transformation history where relevant.

Silent mutation of scientific meaning is prohibited.

## 7. Fail closed on unsupported claims

When a system cannot determine something reliably, it should expose uncertainty, alternatives, or an unsupported state rather than fabricating precision.

Measured facts, deterministic transformations, inferred interpretations, recommendations, and subjective descriptions should remain distinguishable in code and UI.

## 8. User ownership and portability

Whenever practical, users should be able to work with their own data without being forced into a paid subscription merely to access core analysis they can run locally.

Projects should prefer:

- local-first operation for user-supplied files;
- user-controlled exports;
- documented portable formats;
- no unnecessary platform lock-in;
- adapters for external platforms rather than rewrites of core logic.

## 9. Backward compatibility is an explicit consideration

Changes that alter persisted data, external interfaces, URLs, analysis semantics, or export formats require a migration or compatibility plan unless incompatibility is itself an explicit accepted goal.

## 10. Stop conditions

A builder should stop and report rather than reconstructing architecture ad hoc when:

- canonical source or data is corrupt or ambiguous;
- a required acceptance test fails;
- a requested change conflicts with a project constitution;
- a replacement cannot yet prove equivalence or superiority;
- required evidence is unavailable;
- completing the task would require silently discarding accepted goals.

## 11. Documentation precedence

For a project with a project-specific constitution, use this order of authority unless that project explicitly defines another order:

1. project constitution / non-negotiable goals;
2. scientific or domain specification;
3. master implementation plan;
4. acceptance tests and schemas;
5. work tickets;
6. deployment instructions;
7. implementation details.

Lower-level documents may refine higher-level ones but must not silently contradict them.

## 12. Amendment rule

This doctrine is not frozen against improvement. It may be amended when a better engineering principle is demonstrated. Amendments should be explicit, versioned, and explain:

- what changed;
- why the new rule is better;
- which prior behavior is affected;
- whether any accepted project capability is lost.

The standard is improvement with preservation, not rigidity for its own sake.
