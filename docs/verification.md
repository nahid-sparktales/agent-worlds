# Local candidate verification

Status: extraction candidate; native destructive cutover is not yet accepted.

The source baseline was Locus `4cce6ebfaa31f76cd7790967ad8ce7d7e2338deb`. Audit `d7f05e63` preceded implementation. Relevant source paths and all authored asset hashes are recorded in the renderer and asset guides. No remote repository, push, published release or paid generation was performed.

## Executed checks

- Original renderer: 144 tests, typecheck and build passed. The extracted Local Line suite preserves 128 applicable tests and adds eight World-wrapper tests (136); the 16 Outpost-only tests are retained in the external verified recovery archive.
- `npm run typecheck` and `npm test`: 220 tests passed, zero failures/skips, Node 25.5.0 on macOS. Includes real Local Line logic, SDK/Core, a non-nautical test world, deterministic mock host and archive boundaries.
- Swift and TypeScript consume identical 57 wire-fixture vectors. Swift standalone validation passed all 70 checks including session authorization and duplicate-request handling. Native XCTest also consumes the pinned vectors.
- Locus Python suite: 3,130 tests and 31 subtests passed. Actual installer rehearsal accepted the candidate, upgraded legacy v1 to v2, rejected a stale trust digest, rolled back, reinstalled, disabled and uninstalled in disposable state.
- Browser inspection loaded all 44 Local Line models without asset fallback, exercised empty/large rosters, native-intention logging, capabilities, workspace reset and reconnect. Production without a bridge showed an unavailable screen with zero invented residents. Images and detailed interaction evidence live in Locus `Docs/agent-worlds-verification` and `Docs/agent-worlds-browser-verification.md`.

The browser screenshots are interaction evidence, not deterministic pixel-golden tests. They do not prove native hosted forms, graphics performance, reduced-motion OS emulation, every canonical running-work failure scenario or security immunity.

## Pending evidence and limitations

Final isolated clean-clone/package reproducibility, artifact hash, complete native XCTest integration and the T01–T40 acceptance matrix are recorded by the matching Locus migration report as those runs finish. A passed unit/NullEngine test is not described as an end-to-end native pass. Missing prerequisites or failed required native checks block deleting the original implementation.

Native installation currently needs a reviewed pinned local artifact through Locus's existing installer; no published marketplace URL is fabricated. Asset derivative/redistribution rights in NOTICE remain a publication blocker. CI is supplied but has not been run on a remote service.
