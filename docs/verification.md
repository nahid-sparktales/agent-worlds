# Local delivery verification

Status: the independent runtime and unpublished local artifact are delivered, with local verification complete. Native acceptance passed at Locus lifecycle checkpoint `0e7e7b4b` before the thin-host cutover. The cutover removed the old renderer, world backdrops, generation inputs and bundled marketplace entry from active Locus inputs. Shared native profile portraits remain with Locus. The final full native app-host regression run passed all 1,989 tests with zero failures or skips.

The source baseline was Locus `4cce6ebfaa31f76cd7790967ad8ce7d7e2338deb`. Audit `d7f05e63` preceded implementation. Relevant source paths and all authored asset hashes are recorded in the renderer and asset guides. The independent recovery archive restored all 1,239 baseline files with matching hashes and passed the original two-world package verifier. No remote repository, push, published release, actual user plugin installation or paid generation was performed during the local extraction checks below. The user subsequently authorized public source publication at [nahid-sparktales/agent-worlds](https://github.com/nahid-sparktales/agent-worlds); GitHub Actions results are separate from the local evidence.

## Verified artifact

The artifact was built from source commit `ec94166`; later documentation-only commits do not change its inputs or checksum. Two clean independent builds produced identical bytes without a sibling Locus checkout.

- File: `release/agent-worlds-0.2.0.zip`
- SHA-256: `4a4ca458bd1e0391e2ead1b52a58977329e85c30280218e605e992808f99eff8`
- Installed content digest: `71588bfd345d2ed1090385b393111f54cf6bf355d9ff00f7f0c494714c183c81`
- Inventory: 113 files, 221,540,432 installed bytes; ZIP size 221,559,432 bytes.

The actual 1,170-input bundle graph and archive exclude Outpost, mocks, test worlds, recovery material and external source imports. The checksum and installed-file inventory accompany the ZIP.

## Executed checks

- Original renderer: 144 tests, typecheck and build passed. The extracted Local Line suite preserves 128 applicable tests and adds eight World-wrapper tests (136); the 16 Outpost-only tests are retained in the external verified recovery archive.
- `npm run typecheck` and `npm test`: 222 tests passed, zero failures/skips, Node 25.5.0 on macOS. Includes real Local Line logic, SDK/Core, a non-nautical test world, deterministic mock host and archive boundaries.
- Swift and TypeScript consume identical 57 wire-fixture vectors. Swift standalone validation passed all 74 checks including session authorization and duplicate-request handling. Native XCTest also consumes the pinned vectors.
- Final Locus Python suite: 3,138 tests and 31 subtests passed. Actual installer rehearsal accepted the candidate, upgraded legacy v1 to v2, rejected a stale trust digest, rolled back, reinstalled, disabled and uninstalled in disposable state. All 13 focused local-installer tests passed, including failed commit, tampered rollback caches and immutable marked development snapshots.
- The corrected native app-host runner passed 12 packaged/native-host checks and 99 previously affected native tests before the cutover gate. An isolated native app also verified the six-agent map, selection and styles, Captain’s Quarters, Wano appearance, native chat and management tools. These are local acceptance runs, not remote CI results.
- Post-cutover focused native checks passed all 16 bridge tests and 36 Agent World tests, including positive native board handoff. All 24 malformed/incompatible shared client vectors crossed the real WebKit transport and were rejected without native effects; an authorized selection and duplicate-request control passed. Pending native work survived explicit close/reopen, an actual JavaScript exception, an actual event-loop hang and termination of the exact identified disposable WebContent process. Each recovery mounted a new native coordinator, negotiated a new session, received a fresh authoritative snapshot and completed both queued prompts exactly once. No live provider work was submitted.
- The final isolated native UI pass verified the real portrait picker, cancellation, applying a bundled portrait, its retention through cosmetic reset/reopen and the six-profile chat switch menu. It found a cropped avatar in the native menu label; Locus `86077f43` corrected the layout, all 42 focused Agent World/palette checks passed, and a fresh app capture verified the bounded avatar and working switch menu against the unchanged artifact.
- Final `LocusTests` run in a real native app host: **1,989 tests passed, zero failures, skips or expected failures**, in 345.776 test seconds. It used production host checkpoint `86077f43` and the unchanged `ec94166` artifact above. All 16 bridge, 36 Agent World and seven companion pointer tests passed in this aggregate run.
- Browser inspection loaded all 44 Local Line models without asset fallback, exercised empty/large rosters, native-intention logging, capabilities, workspace reset and reconnect. Production without a bridge showed an unavailable screen with zero invented residents. Images and detailed interaction evidence live in Locus `Docs/agent-worlds-verification` and `Docs/agent-worlds-browser-verification.md`.

The browser screenshots are interaction evidence, not deterministic pixel-golden tests. They do not establish quantitative graphics performance, reduced-motion OS emulation or security immunity. Deterministic reduced-motion behavior is tested. Native form and bridge evidence comes from the separate app-host tests and native interaction captures; the WebContent termination experiment used a disposable test process, not a user window.

Earlier failures remain recorded in the matching Locus reports and Git history. The first full post-cutover run exercised 1,983 tests with one unavailable-system-symbol failure and one focus-dependent pointer-test skip. The symbol was corrected in `3c519cb3`; the final aggregate passed both cases without skipping. A subsequent new close/reopen recovery test exposed a test-helper lookup that stopped at a retained closed window; `12786fb4` corrected the lookup, and all four real renderer recovery cases passed. The native portrait layout defect and its verified correction are recorded above.

## Verification limits

The matching Locus `Docs/agent-worlds-extraction-report.md`, `Docs/agent-worlds-acceptance.md` and native verification reports record the T01–T40 matrix, native UI evidence, failures and final aggregate results. The separate `LocusUITests` target was not run; actual native UI interactions were exercised through CUA. Live provider execution, quantitative CPU/GPU/frame/memory profiling, OS reduced-motion emulation and signed distribution were not performed. A passed unit/NullEngine test is not described as an end-to-end native pass.

Local installation is manual through the reviewed pinned-artifact CLI backed by Locus's existing installer. Its explicit development-directory mode installs a marked immutable snapshot with the same validation and permissions. Native UI ZIP import is not implemented, and no published marketplace URL is fabricated. The asset derivative/redistribution status in NOTICE remains unverified; public source availability does not establish artwork rights. No packaged release or npm publication has occurred. Remote CI status is available in [GitHub Actions](https://github.com/nahid-sparktales/agent-worlds/actions); the local counts above do not claim a remote result.
