# Reproducible local candidates

Agent Worlds builds independently from this checkout with pinned Node, TypeScript,
Babylon.js and esbuild dependencies. No Locus source checkout, provider service,
private generation ledger, Meshy API key or installed native application is a
build input.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

`build` first checks all 114 authored asset files against the source SHA-256
manifest. It removes only `dist/plugin`, copies allowlisted assets, then bundles
`plugin/src/main.ts` with its real dependency graph. `dist/build-meta.json` records
that graph; production dependencies on developer fixtures, tests, removed world
components or another checkout fail the build. The mock host is a separate
`dist/dev/main.js` bundle and never enters the plugin. Source and generated
resources are intentionally separate.

`dist/plugin` contains the existing `.codex-plugin/plugin.json` installation
identity, the bundled UI, Local Line models/reference provenance, native
presentation metadata and six optimized backdrop images, notices and icon.
High-resolution native backdrop sources remain in the source asset tree; they
are not redundant app resources or release inputs. All GLBs are checked for
valid containers, embedded resources and absence of remote decoder requirements.
The entire installed artifact is below Locus's 250 MiB / 5,000-file limits.

`package` rebuilds from the current source, revalidates that directory and creates:

- `release/agent-worlds-0.2.0.zip` — a deterministic ZIP with sorted entries and fixed metadata.
- `release/agent-worlds-0.2.0.zip.sha256` — the exact candidate checksum.
- `release/asset-manifest.json` — every installed file's relative path, byte count and SHA-256, plus runtime/SDK/wire/preferences versions.

The ZIP uses standard stored entries because the large assets are already
compressed. Verify its standard archive structure and reproducibility:

```sh
python3 -m zipfile -t release/agent-worlds-0.2.0.zip
cp release/agent-worlds-0.2.0.zip.sha256 /tmp/agent-worlds-first.sha256
npm run package
diff /tmp/agent-worlds-first.sha256 release/agent-worlds-0.2.0.zip.sha256
```

No build step generates assets, requests generation credits, fetches runtime
resources or publishes a release. `NOTICE` records unverified redistribution
rights for derivative/reference artwork. The artifact is an unpublished local
delivery; its exact verified checksum and native evidence are recorded in
[verification](verification.md). Local regression gates passed; publication
still requires rights clearance and a reviewed release. The standalone CI
checks build/test/archive behavior and has read-only
repository permissions; it does not publish.

## Host installation and rollback rehearsal

The Locus checkout provides `Tools/VerifyAgentWorldsArtifact.py`. Supply an explicit
artifact path and its reviewed checksum. It rejects unsafe ZIP paths, symlinks,
duplicates, excessive counts/expansion size and invalid manifests before using
the normal Locus parser/trust/install path. With `--previous-plugin` pointing to
a preserved compatible prior plugin, it tests upgrade, stale-digest rejection,
workspace scope preservation, rollback, reinstall, disable and uninstall. It
uses disposable state and preserves marketplace identity `locus/agent-world`.
It does not replace the user's actual installed version and does not establish
native UI compatibility.

The app version number alone is not a compatibility promise. The manifest
requires host support for screen protocol 2 and runtime 0.2.x negotiation. Older
hosts reject version 2 explicitly; there is no silent protocol downgrade. Use
Locus's `Tools/InstallAgentWorldsArtifact.py review` and `install` for a real local
installation after inspecting the ZIP checksum, file inventory and plugin digest.
It delegates to the existing manager and requires an explicit legacy-v1 upgrade.
The opt-in development-directory mode installs an immutable, visibly marked
snapshot under identical validation and permission rules; it never imports a
live sibling checkout. Exact commands are in Locus's
`Docs/agent-worlds-local-install.md`. No native UI ZIP import or automatic release
installation has been added. Keep the
prior digest/version available for rollback. Canonical profile/chat data and
legacy defaults stay owned by Locus.
