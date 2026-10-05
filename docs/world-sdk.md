# World SDK 1

`packages/sdk/src/world.ts` is the interface. SDK types have no browser or Locus model dependency. Core imports only SDK; Local Line owns Babylon and all geography, ship styles, navigation, berths and visual reservations. Composition selects the installed Local Line factory; Core has no world list.

A World exposes metadata (`id`, name, semantic version, description, icon, minimum runtime, SDK version, entrypoint and assets), required/optional capabilities, initialize, snapshot/event delivery, render, activate, deactivate and dispose. Metadata paths are confined relative paths. Runtime compatibility is validated before replacing an active world.

Lifecycle is initialize once → receive authorized snapshot → activate. Snapshots may arrive during initialization or while inactive; only the newest authoritative state is retained. Ordered events replace the bounded display projection. No activation occurs before initial state. Deactivation and disposal must be idempotent. Failed initialization disposes the partially initialized world. Cancellation remains cancelled after a replacement starts; stale context calls cannot issue host requests or write settings. Response completions from disposed contexts are rejected.

**Loop ownership:** Local Line's Babylon engine and its separate bounded alert viewport own their existing loops. `World.render(frame)` deliberately schedules nothing for this world. Core never creates an additional RAF loop. Deactivation stops engine loops; disposal releases fetch cancellation, listeners, timeouts, DOM, models and GPU resources. Hidden documents/windows deactivate. Replacing a world serializes transitions and invalidates its context.

The context contains a capability-scoped bridge; cosmetic namespaced storage with a 32 KiB quota; a confined asset resolver; bounded logging; lifecycle cancellation; and injected time/randomness. It contains no profiles, transcripts, providers, filesystem access, selectors or task execution. Native commands open existing Locus surfaces and never submit work from a render callback.

World-owned storage is decorative. Reset only calls `preferences.reset`; it cannot address canonical Locus stores. Core projection is memory-only. Deleted agents and stale scopes are reconciled from host state, never recreated locally.

## Authoring example

The executable `CounterWorld` in `tests/integration/lifecycle.test.ts` is a test-only non-nautical world. It displays an agent count using the same lifecycle and host snapshots, without Babylon or Local Line assets. It is not registered, built into production or included in release archives. Run `npm run test:contract` to exercise it and the architecture-boundary checks.

A future world supplies the same interface and its own renderer. Its required capabilities are negotiated before data; optional actions must disable with an explanation. World commands remain narrow host intentions. Adding a world does not require modifying Core or importing Local Line.
