# Compatibility, installation and rollback

| Host | Plugin | Result |
| --- | --- | --- |
| Unmodified Locus at source commit 4cce6eb | Legacy agent-world 0.1.1 / screen1 | Original supported baseline |
| Unmodified Locus at source commit 4cce6eb | Agent Worlds 0.2.x / screen2 | Rejected by unsupported screen version |
| Migrating host with reviewed wire2 adapter | Legacy screen1 | Explicit transitional v1 handling; semantics unchanged |
| Migrating host with reviewed wire2 adapter | Agent Worlds 0.2.x / SDK1 / wire2 | Negotiated only after granted agents.read and compatible scoped handshake |
| Any host | Unknown wire/SDK/runtime | Safe rejection; no synthetic fallback or guessed downgrade |

Application version strings alone do not prove support: the host commit must contain screen2 and wire2 validation. This avoids inventing a public Locus minimum version for an unpublished change. The manifest records required screen protocol2 and supported runtime range ≥0.2.0 <0.3.0. Separate versions are release0.2.0, World0.2.0, SDK1, wire2 and preferences2.

Installation identity remains marketplace `locus`, plugin `agent-world`, screen `agent-world`. Do not create a second marketplace identity merely to move repositories. Current delivered ZIP is a local candidate, with integrity hash alongside it. No remote, tag or release is assumed to exist.

Rollout order: review/build the new Locus host; build and verify the immutable plugin ZIP; review its manifest/capabilities and digest through the existing Extensions flow; stage/install through the existing atomic manager; run the actual package/native checks; only then remove old in-tree implementation/assets and change marketplace source to a resolved version/hash. The two repositories do not deploy atomically. Production never imports a sibling checkout or tracks mutable main/latest. Local development uses `npm run dev`; test overrides require an explicit package directory and are not a production fallback.

Locus's `Tools/VerifyAgentWorldsArtifact.py --artifact ZIP --sha256 SHA256 --previous-plugin LEGACY_DIRECTORY` exercises real digest review, install, update, stale-review rejection, rollback and uninstall in disposable state. It does not alter user plugin installation. See packaging docs for the bounded archive rules. The ordinary app remains usable if the plugin is missing or incompatible.

Rollback: disable the candidate, select the preserved prior digest in the existing plugin manager, and use the previously verified host/plugin combination. Keep the verified legacy archive and last installed package; no canonical agent/chat/task/provider state is rolled back. The v2 preference namespace is separate and legacy values are untouched. World reset changes only v2 cosmetic preferences. Uninstall revokes capability/session access, not canonical records.

Publication is outstanding: asset rights review, approved remote creation, reviewed commit push, version tag, integrity-pinned artifact release, then a reviewed marketplace source update retaining identity. No publication steps have been performed by this local migration.
