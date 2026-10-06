# Compatibility, installation and rollback

| Host | Plugin | Result |
| --- | --- | --- |
| Unmodified Locus at source commit 4cce6eb | Legacy agent-world 0.1.1 / screen1 | Original supported baseline |
| Unmodified Locus at source commit 4cce6eb | Agent Worlds 0.2.x / screen2 | Rejected by unsupported screen version |
| Extracted Locus host with the reviewed wire2 adapter | Legacy web screen1 | Unsupported; explicitly install the reviewed v2 artifact or restore the legacy host/plugin pair |
| Extracted Locus host with the reviewed wire2 adapter | Agent Worlds 0.2.x / SDK1 / wire2 | Negotiated only after granted agents.read and compatible scoped handshake |
| Any host | Unknown wire/SDK/runtime | Safe rejection; no synthetic fallback or guessed downgrade |

Web screens support protocol 2 only. Social Studio remains a separate native version-1 surface with `social.workspace`; it cannot negotiate world or agent commands. No legacy web decoder or automatic protocol downgrade remains in the extracted host.

Application version strings alone do not prove support: the host commit must contain screen2 and wire2 validation. This avoids inventing a public Locus minimum version for an unpublished change. The manifest records required screen protocol2 and supported runtime range ≥0.2.0 <0.3.0. Separate versions are release0.2.0, World0.2.0, SDK1, wire2 and preferences2.

Installation identity remains marketplace `locus`, plugin `agent-world`, screen `agent-world`. Do not create a second marketplace identity merely to move repositories. The delivered ZIP is an unpublished local artifact built from `ec94166`; its exact checksum and reproducibility evidence are in [verification](verification.md). The source repository is public at [nahid-sparktales/agent-worlds](https://github.com/nahid-sparktales/agent-worlds). No release tag, hosted ZIP or npm release has been published.

The Locus thin-host cutover is complete. Old renderer source, world assets and generation inputs are removed from active Locus inputs; the independently verified recovery archive preserves the original implementation. No marketplace source has been changed to an unresolved remote. The two repositories do not deploy atomically.

For local deployment, build the compatible Locus host, verify the immutable ZIP, review its manifest/capabilities, file inventory and digest, then install through the existing atomic extension manager using the reviewed-artifact CLI below. Production never imports a sibling checkout or tracks mutable main/latest. Standalone development uses `npm run dev`. Native development requires an explicit reviewed directory snapshot through the same installer and grants as a release; it is visibly labeled development and has no live checkout fallback.

Locus's `Tools/VerifyAgentWorldsArtifact.py --artifact ZIP --sha256 SHA256 --previous-plugin LEGACY_DIRECTORY` exercises real digest review, install, update, stale-review rejection, rollback and uninstall in disposable state. It does not alter user plugin installation. See packaging docs for the bounded archive rules. The ordinary app remains usable if the plugin is missing or incompatible.

For an actual local installation, Locus provides `Tools/InstallAgentWorldsArtifact.py review` and `install`. Supply the ZIP and its SHA-256, inspect the complete file inventory and plugin digest, then supply that digest to installation with an explicit state root and workspace scope. An existing web-v1 installation requires `--upgrade-legacy-v1`. The CLI delegates trust review, installation and rollback to the existing ExtensionManager; it does not add a marketplace. Quit Locus and its backend before mutating their shared plugin state. The Locus guide `Docs/agent-worlds-local-install.md` records exact commands and rollback preconditions. Native UI ZIP-import routing has not been added.

The mutually exclusive `--development-directory PATH` mode makes an immutable copy, adds the visible `Agent Worlds (development)` marker before digest review, and uses the same validation, scope and permission flow. Source changes require a fresh snapshot and review. There is no symlink, hot reload, implicit discovery or production fallback.

Rollback: disable the candidate, select the preserved prior digest in the existing plugin manager, and use the previously verified host/plugin combination. Keep the verified legacy archive and last installed package; no canonical agent/chat/task/provider state is rolled back. The v2 preference namespace is scoped by plugin/screen and a hash of the canonical workspace; legacy visual values remain available for rollback. Migrated per-agent choices are filtered to authorized profiles. World reset changes only v2 cosmetic preferences. Uninstall revokes capability/session access, not canonical records.

Public source publication was explicitly authorized after local extraction acceptance. Artifact publication remains separate: review the asset rights, publish an integrity-pinned versioned artifact, then update the marketplace source while retaining identity. Public source availability does not establish artwork redistribution rights or replace the compatibility and digest checks.
