# Agent Worlds

Agent Worlds is an independent TypeScript/Babylon.js visualization runtime for Locus. Its only production world is **Local Line**. Locus owns agents, chats, work, permissions, providers and native management surfaces. The world owns scenery, movement, decorative controls and disposable display state.

This repository produces a **local 0.2.0 candidate**. It has not been published, and the Locus destructive cutover is gated on native acceptance. See [verification](docs/verification.md) for actual evidence and limitations. Asset redistribution rights remain unverified; see [NOTICE](NOTICE).

Use Node 22.18 or newer (verified with Node 25.5.0):

```sh
npm ci
npm run dev       # Explicit synthetic Mock Locus Host, localhost:4173
npm run typecheck
npm test
npm run build     # Clean dist/plugin; separate dist/dev
npm run package   # release/agent-worlds-0.2.0.zip + SHA-256 and asset inventory
npm run check
```

Development needs no Locus checkout, provider credentials, backend, model or generation service. Set `AGENT_WORLDS_DEV_PORT` to change the local port. The mock panel controls zero/10/100/500 agents, work statuses, approvals, transfers, fixed-clock stepping, ordering faults, capabilities and workspace changes. All data is marked synthetic; native intentions are recorded without executing work. A production artifact opened without Locus shows a connection error and does not load mock data.

The source is arranged as:

- `packages/sdk`: renderer-neutral types, strict wire validation, World interface.
- `packages/core`: scoped projection, correlated client, lifecycle coordination.
- `packages/local-line`: real ocean renderer, UI, movement rules and immutable assets.
- `plugin`: WebKit transport, installed-world composition and Locus metadata.
- `dev`: explicit deterministic mock host, excluded from release imports and ZIP.
- `tests`: shared contract vectors, lifecycle tests and packaging boundaries; Local Line tests stay with the world.

Read the [SDK guide](docs/world-sdk.md), [host protocol](docs/host-protocol.md), [compatibility and rollout](docs/compatibility.md), [packaging](docs/packaging.md) and [asset provenance](docs/assets.md). Installation identity remains **locus/agent-world** even though the product and repository are Agent Worlds.
