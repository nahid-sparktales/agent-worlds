# Local candidate verification

Status: local extraction candidate. The native acceptance gate passed at Locus lifecycle checkpoint `0e7e7b4b`; the final thin-host cutover and its post-cutover regression run are tracked by the Locus migration report.

The source baseline was Locus `4cce6ebfaa31f76cd7790967ad8ce7d7e2338deb`. Audit `d7f05e63` preceded implementation. Relevant source paths and all authored asset hashes are recorded in the renderer and asset guides. No remote repository, push, published release or paid generation was performed.

## Executed checks

- Original renderer: 144 tests, typecheck and build passed. The extracted Local Line suite preserves 128 applicable tests and adds eight World-wrapper tests (136); the 16 Outpost-only tests are retained in the external verified recovery archive.
- `npm run typecheck` and `npm test`: 222 tests passed, zero failures/skips, Node 25.5.0 on macOS. Includes real Local Line logic, SDK/Core, a non-nautical test world, deterministic mock host and archive boundaries.
- Swift and TypeScript consume identical 57 wire-fixture vectors. Swift standalone validation passed all 74 checks including session authorization and duplicate-request handling. Native XCTest also consumes the pinned vectors.
- Locus Python suite: 3,130 tests and 31 subtests passed. Actual installer rehearsal accepted the candidate, upgraded legacy v1 to v2, rejected a stale trust digest, rolled back, reinstalled, disabled and uninstalled in disposable state.
- The corrected native app-host runner passed 12 packaged/native-host checks and 99 previously affected native tests before the cutover gate. An isolated native app also verified the six-agent map, selection and styles, Captain’s Quarters, Wano appearance, native chat and management tools. These are local acceptance runs, not remote CI results.
- Browser inspection loaded all 44 Local Line models without asset fallback, exercised empty/large rosters, native-intention logging, capabilities, workspace reset and reconnect. Production without a bridge showed an unavailable screen with zero invented residents. Images and detailed interaction evidence live in Locus `Docs/agent-worlds-verification` and `Docs/agent-worlds-browser-verification.md`.

The browser screenshots are interaction evidence, not deterministic pixel-golden tests. They do not establish graphics performance, reduced-motion OS emulation, every canonical running-work failure scenario or security immunity. Native form and bridge evidence comes from the separate app-host tests and native interaction captures.

## Pending evidence and limitations

The exact artifact hash, isolated clean-clone/package reproducibility, complete native XCTest results and the T01–T40 acceptance matrix are recorded by the matching Locus migration report. Final post-cutover results must be read there; the pre-cutover acceptance counts above do not claim that later changes have already passed. A passed unit/NullEngine test is not described as an end-to-end native pass. Missing prerequisites or failed required native checks block deleting the original implementation.

Local installation is manual through the reviewed pinned-artifact CLI backed by Locus's existing installer. Its explicit development-directory mode installs a marked immutable snapshot with the same validation and permissions. Native UI ZIP import is not implemented, and no published marketplace URL is fabricated. Asset derivative/redistribution rights in NOTICE remain a publication blocker. CI is supplied but has not been run on a remote service.
