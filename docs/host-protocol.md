# Locus ↔ Agent Worlds wire protocol 2

Canonical executable schema: `packages/sdk/src/protocol.ts`. Canonical cross-language vectors: `tests/fixtures/wire-v2.json`. Locus vendors a hash-pinned copy and implements the same strict validation. TypeScript types alone are not a validation boundary. The extracted host accepts web wire 2 only. A legacy web-v1 plugin requires an explicit upgrade; there is no automatic downgrade. Native Social Studio version 1 is a separate surface and has no world bridge access.

Transport uses the existing `window.webkit.messageHandlers.locusScreen.postMessage` and `window.locusAgentWorld.receive` conventions. Only `plugin/src/transport.ts` knows WebKit. No network transport, iframe messaging, arbitrary selector or file access is added.

## Handshake

Client sends `hello` with integer version 2, request ID, supported protocol integers, runtime semantic version, SDK integer version, and disjoint required/optional capability lists. Host validates the trusted installed plugin identity/digest/root/screen, current workspace, runtime 0.2.x, SDK 1 and protocol 2. Missing required permissions fail with `rejected`; missing optional permissions remove their actions. Granted capabilities cannot exceed the request or installed grants.

`welcome` correlates the hello and supplies protocol, Locus version, granted capabilities, session ID, opaque workspace scope ID and stream ID. No real data is delivered before negotiation. Every following invocation includes session and scope; the host rechecks installed identity, capability, project and entity membership on every invocation. Revocation, uninstall, plugin replacement and workspace change invalidate the session. Resource confinement and main-frame checks remain native.

## State and ordering

`snapshot` carries session, scope, stream, nonnegative safe-integer sequence and `state`. State contains at most 500 UUID-keyed agents (display name/role ≤256 Unicode codepoints and safe status), project display label, selected authorized UUID, at most 256 attention tokens and 128 transfer tokens, validated cosmetic preferences and native presentation counters. No private instructions, messages, portrait bytes, credentials, paths or raw provider errors are permitted; unknown keys fail closed.

`event` is `projection.updated`: a coalesced replacement of that same bounded display projection. Locus retains its existing observations/domain services; this is not application event sourcing. A snapshot is an atomic cut of observed state; subsequent ordered replacements derive from native changes. There is no exactly-once delivery claim.

The client ignores duplicate/late sequences and old sessions/scopes. A gap or unknown stream invalidates the projection and requests one fresh `host.snapshot`, without buffering unbounded events or replaying mutations. A snapshot can leap forward authoritatively. A new stream requires a new welcome/session. Local Line seeds historical transfer IDs from snapshots, so reconnect does not replay old handoffs. Approval tokens open native confirmation; they cannot approve anything.

## Requests

`request` has `{version,type,requestID,sessionID,scopeID,command,arguments}`. Exact argument keys are checked. UUID entity IDs are validated against current authorized state.

| Command | Capability | Native effect |
| --- | --- | --- |
| `host.snapshot` | agents.read | Return current authorized display projection |
| `agents.open` | agents.interact | Open/select existing native agent surface |
| `agents.create` | agents.interact | Open native agent creation draft |
| `selection.clear` | agents.interact | Dismiss world selection |
| `attention.open`, `transfers.open` | agents.interact | Open exact known native request/result token |
| `chats.openShared` | agents.interact | Open existing Crew Chat |
| `navigation.open` | agents.interact | Allowlist: agents, activity, calendar, board |
| `presentation.open` | agents.interact | Open an installed, validated decorative presentation over native surfaces |
| `preferences.set`, `preferences.reset` | world.preferences | Bounded cosmetic namespace only |
| `placements.set` | agents.read | Bounded display-only primary/secondary labels for known roster UUIDs |

There is no prompt/send/tool/provider/task execution API. User drafts, cancellation, validation and permission confirmation remain native. A command response reports accepted native intention, not successful agent work.

Responses correlate request/session/scope and carry either `ok:true,result` or a typed error: incompatible, denied, stale_session, invalid_request, not_found, unavailable, timeout, cancelled, quota. Reusing a request identity with changed arguments is rejected; repeated same identity returns the stored outcome within bounded host session history. After the cache quota is reached, new requests are rejected until explicit reconnect, never evicted in a way that permits replayed mutations. The client permits at most 64 pending requests and times out in 10 seconds, sending cancellation best effort. Timeout/disconnect can leave outcome uncertain; **mutations are never automatically replayed**. Inspect fresh authoritative state/native UI before retrying.

## Bounds and native isolation

Total JSON payload ≤524,288 UTF-8 bytes, nesting ≤8, bounded child counts, finite numbers, printable display strings, exact keys, opaque session tokens ≤80 characters, namespaced preference keys ≤80, preference dictionary ≤32 keys/32 KiB. Capability names remain agents.read / agents.interact / world.preferences. Navigation targets, asset paths and presentation schema are explicitly confined.

The native resource handler preserves local scheme/root checks, one-pass decoding, symlink containment, CSP, external network denial, main-frame-only messaging, popup/navigation/media denial and nonpersistent WebKit storage. Cosmetic persistence therefore uses native storage scoped to plugin/screen and canonical workspace, not browser localStorage. Reset affects only that active visual namespace. Legacy visual keys are retained for rollback, while canonical agent, conversation and work records stay outside the namespace. A browser test cannot prove this native boundary; the Locus test report records actual WK round trips separately.
