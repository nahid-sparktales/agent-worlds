# Assets and provenance

All copied bytes originate at Locus commit
`4cce6ebfaa31f76cd7790967ad8ce7d7e2338deb`. `asset-manifest.json` provides the exact
path/size/SHA-256 inventory; it is checked before every build. Model hashes and
credit-accounting records remain unchanged in the original ledgers.

- `packages/local-line/assets/themes/grand-line/` holds 44 prepared gzip GLBs,
  their manifest, 44 generated reference records, the supplied source collage
  and the complete 1,800-credit task ledger. `grand-line` stays an asset path;
  the public world identifier is `local-line`.
- `packages/local-line/assets/assets/` holds the snail communicator GLB,
  reference and separate 44-credit ledger. It belongs to Local Line, despite
  the historical shared-directory name.
- `packages/local-line/assets/presentation/` holds authored web backdrops and
  generation prompts. Build selects `captain-deck-preview.webp` for the shipped
  `static/captain-deck.webp`; both source deck variants are retained.
- `presentation/native/` retains the original CaptainDeck PNG and five island
  JPEG imagesets as source evidence. They are excluded from the runtime artifact.
- `plugin/assets/icon.svg` is the original plugin identification artwork.
  Babylon licenses/notices are preserved in `plugin/licenses/`.

The fifteen Locus profile portraits remain with Locus; they are general native
agent presentation assets, not world-owned records. No profiles, provider
credentials, transcript stores, task state or Python execution backend are
included here. No audio, separate environment maps or standalone animation
files are needed; models embed their resources and visual effects live in the
Local Line renderer.

The original model verifier passed in the source checkout and again after
restoring the independent recovery archive. The extraction preserves exact
bytes, so neither additional image decoding nor paid regeneration is necessary
to establish byte-for-byte provenance on every JavaScript build. Package checks
also verify model/reference hashes against their own ledgers and inspect GLB
embedded-resource requirements.

Source attribution is distinct from rights clearance. Original source ledgers
explicitly identify unofficial One Piece fan art and a user-supplied collage;
they do not document rightsholder redistribution permission. Keep `NOTICE` with
source and binary candidates. Do not label all artwork Apache-2.0 or treat Meshy
credit receipts as permission to redistribute reference-derived designs.

The removed Outpost source/assets are preserved outside this repository in a
verified recovery snapshot recorded by the Locus extraction audit. They never
belong in package inputs, sourcemaps, runtime catalogs, or published archives.
