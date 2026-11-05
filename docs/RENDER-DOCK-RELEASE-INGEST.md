# Render Dock → BKESIT GitHub distribution (first product)

## Authority and repositories

- Engineering/build source: `jan2xo/BKE_RENDER_DOCK`.
- Customer-facing GitHub distribution: `BKESITSolutions/Software-Catalogs`.
- Product identity: `bke-render-dock`; Windows x64; initial existing stable version `v1.0.3`.
- Existing trusted source tag `v1.0.3` resolves to exact source commit `7a7c82bf9c7c135b1c744e6ada550cda356e4da4`.
- The BKE Digital Solutions application and database remain owners of catalog visibility, pricing, purchases, entitlement and licensing. This workflow does **not** modify that application or its production state.

## Two safe stages

**Verify-only:** GitHub Actions → **BKESIT GitHub product distribution (Render Dock)** → Run workflow on **main** → set:
- `tag` to `v1.0.3`;
- `source_sha` to `7a7c82bf9c7c135b1c744e6ada550cda356e4da4`;
- `publish` to `false`.

The run verifies the source tag is an exact commit, reads that commit's canonical product manifest, requires a published non-prerelease release and five exact named assets, validates the source-origin GitHub links and provider-reported digests and sizes, **downloads the real bytes** and independently hashes them, and downloads the pinned product-image blob and checks its exact Git blob SHA. All resulting files and `catalog-entry.json` are retained as a short-lived CI artifact, **not published to customers**.

**Release publication (separate authorization):** The authorized publisher runs the workflow again with `publish=true` and the exact `acknowledgement=PUBLISH_RENDER_DOCK_TO_BKESIT`. The trusted default-branch workflow uses the catalog repository's own ephemeral `GITHUB_TOKEN` (`contents:write`) to create the **new** `bke-render-dock-v1.0.3` GitHub Release and upload the certified installer, updater ZIP and JSON, SHA256SUMS, SOURCE.txt, pinned product image, and `catalog-entry.json`. No PAT, external artifact server, R2 or S3 is required.

The workflow refuses an existing destination release/tag instead of modifying or replacing published assets. Multiple concurrent runs for one version are serialized. Failing verification never publishes. The token is scoped to this catalog repository only. The other engineering repository does **not** receive BKESIT write credentials.

The source repo's `bkesit-catalog.yml` creates a read-only candidate when an approved stable release is published; it never transfers files or writes across GitHub accounts. This repository verifies bytes independently before distribution.

## Security and product boundaries

- No GitHub-supplied data or binaries are ever executed under the publication token.
- The trusted publishing workflow can only ingest the explicitly allowed source repository and canonical Render Dock product ID. No arbitrary repo/URL/script input.
- HTTPS URL/source-commit/tag, exact filenames, file sizes, SHA-256, and Git image blob SHA are checked.
- The source release/tag is not currently GitHub immutable by policy. The exact source SHA and bytes are therefore pinned and rechecked at each ingestion; protect release/tag mutation and review any new version.
- PUBLIC installer download **does not** grant a valid BKE software license. Product code must continue to enforce licensing.
- This is a GitHub **distribution** CI, not Digital Solutions customer storefront database synchronization. The storefront consumer should read the validated manifest after its separate application change.
- No existing source release is rewritten or deleted; no source code is published with the binaries.
- No source project UI/Avalonia PRs, Workers/Google/PostgreSQL PRs, payments, secrets, production database or production deployment are changed.

## Minimum certification

1. Both contract suites pass on the exact candidate PR head.
2. Verify-only dispatch succeeds on the trusted merged workflow and proves exact `source_sha`, expected release assets and image, including real bytes, in the CI log and artifact.
3. Authorize publication independently; do not infer it from successful verify-only runs.
4. If publishing is explicitly authorized, check BKESIT tag/release creation and downloaded assets' SHA-256 before presenting the links in the storefront.
