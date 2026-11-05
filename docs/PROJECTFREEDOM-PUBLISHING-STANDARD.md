# ProjectFreedom → BKESIT publishing workflow standard

**Status:** Defined and source implementation staged for Render Dock. Future ProjectFreedom products **opt in independently**. This is a distribution contract, not a store purchase/entitlement service.

## Canonical flow

```text
jan2xo/<PRODUCT> — build and certify exact product release
    └── explicit Publish to BKESIT action on trusted main
          ├── verify source product identity, stable GitHub release/tag, exact source SHA
          ├── assert operator's publish/verify-only intent
          └── scoped GitHub App actions:write token → fixed BKESIT workflow_dispatch
              └── BKESITSolutions/Software-Catalogs (default-branch trusted workflow)
                    ├── verify exact source/tag/manifest and all real artifact bytes
                    ├── verify SHA-256 and any source-pinned images
                    ├── retain verification evidence
                    └── if approved: publish new versioned GitHub Release
                        └── BKE Digital Solutions storefront consumer (separate workstream)
```

No product CI pushes source files, uploads binaries, or commits directly to the destination Git repository. The destination owns published release assets; source remains the engineering/build authority. Product CI reports **dispatch accepted** separately from destination CI **published successfully**. No unaudited website callback is allowed to claim that release publication succeeded.

## Credential and authority model

A normal `GITHUB_TOKEN` in `jan2xo/<PRODUCT>` does **not** carry cross-repository permissions, even though `jan2xo` has collaborator write access to `BKESITSolutions/Software-Catalogs`.

For each approved ProjectFreedom repository, the operator configures a dedicated publishing GitHub App installation:

1. Install an authorized GitHub App on `BKESITSolutions/Software-Catalogs`, with the minimum **Actions: write** and **Contents: read** repository permissions necessary to dispatch the destination workflow. Do not grant contents write to the product-side token.
2. Put its App ID in that product repository's Actions variable `BKESIT_CATALOG_PUBLISH_APP_ID`.
3. Put the private key in that product repository's Actions secret `BKESIT_CATALOG_PUBLISH_APP_PRIVATE_KEY`. Do not add a key to source control, PRs, logs, or this catalog. Secure the product repo's default-branch workflow changes and any configured publishing environment as an authorization boundary.
4. The product-side dispatcher generates a short-lived, **single-destination repository-scoped** installation token using `actions/create-github-app-token` only after its verification job passes, in a separate job with no source-repository checkout.
5. The receiving BKESIT workflow runs on its own trusted `main`, uses its **own repository-scoped `GITHUB_TOKEN`** for Release uploads, and never executes downloaded installer data as code. No PAT, S3, R2, or external upload service is needed for this software-distribution path.

The source publisher uses a fixed destination owner/repository/workflow, not an arbitrary URL or workflow ID. Only an authorized actor with workflow-dispatch privileges on the source repository should be able to initiate it. Approval of a source GitHub Release and operator-controlled publish flag are distinct from payment or entitlement authorization.

## Product onboarding contract

For each new ProjectFreedom software product, create a **fresh source PR from current product main** implementing a small `Publish <Product> to BKESIT` workflow. Add a **separate catalog PR** for its specific release validator and allowlist, after reviewing the actual product release contract. No generalized arbitrary-repository GitHub asset copier is permitted.

Per product, establish:
- Fixed source repository and immutable product ID; source manifests and binary file formats actually used.
- Stable release tag/version rules and expected full asset set: installer, updater payload/metadata, checksums, source provenance, product images, where applicable. Explicitly exclude prereleases, drafts, ambiguous names, unapproved archives or unsupported platforms.
- Exact source commit/tag and **successful product-specific certification provenance**. Verify the real release artifact bytes and SHA-256, not only manifest labels. For older existing releases, record what actual certification evidence exists and its limits.
- Destination name convention `<product-id>-v<version>`; avoid overwrites and require fail-closed handling of existing tags/assets. The destination shall reject duplicate/uncertain publication.
- Separate verify-only and publish paths, clear owner acknowledgement, and minimum necessary GitHub Actions permissions.
- No website pricing, payment, customer license assignment, Cloudflare runtime, third-party object storage, or production database mutation in the publication PR.
- Independent exact-head PR and CI evidence before merging each product's workflow; use `SELF_REVIEW_ACCEPT` or `REMEDIATE` per current BKE Skills, respecting any actual enforced GitHub branch rules.

The storefront consumes only **verified published** BKESIT assets and stores pricing, product visibility, customer purchases and entitlements in its own authoritative state. A public installer download never grants activation.

## First working product: Render Dock

- Source repository: `jan2xo/BKE_RENDER_DOCK`; canonical product ID `bke-render-dock`.
- Source validated release: `v1.0.3` at `7a7c82bf9c7c135b1c744e6ada550cda356e4da4`.
- Source read-only candidate workflow: `.github/workflows/bkesit-catalog.yml`.
- New explicit source handoff workflow: `.github/workflows/publish-to-bkesit.yml`.
- Destination workflow: `.github/workflows/render-dock-distribution.yml` in this repository.
- Target BKESIT release: `bke-render-dock-v1.0.3`.
- Existing verified real bytes: [BKESIT Actions #41984557827](https://github.com/BKESITSolutions/Software-Catalogs/actions/runs/41984557827), 10 contract tests pass; source binary/image SHA and size verification pass.
- Existing destination release state at this plan: **none**; no customer-facing publication authorized.

**Source workflow inputs:** `tag=v1.0.3`, `publish=false` for a verification-only destination dispatch. The workflow resolves the **exact source commit SHA** from the tag and forwards it automatically; the optional `source_sha` input can pin it explicitly and reject tag drift (for example, `7a7c82bf9c7c135b1c744e6ada550cda356e4da4`). For customer-facing publication, explicit `publish=true` plus exact `acknowledgement=PUBLISH_RENDER_DOCK_TO_BKESIT` is required. The receiving workflow repeats those gates.

**Known activation blocker:** the GitHub App installation ID/permission and secret configuration are not provisioned or verified by this source change. Until that is done, the source workflow cannot successfully dispatch and must fail closed. A successful source dispatch (HTTP 204) is not proof that the destination job has completed.

**No automatic customer storefront synchronization exists yet.** That is its own Digital Solutions app workstream after the Cloudflare hosting proof and must not be represented as already live.

## Future products

`BKE_AIR_STACK`, `BKE_RENDER_DOCK`, `bke-launcher`, licensing-agent, and other ProjectFreedom products must **not** be treated as automatically onboarded simply because their repositories exist. Each project needs its own product ID, actual release file/CI contract, authorized distribution policy, and scoped onboarding PR. Software catalog remains clean until the corresponding publishing gate is explicitly executed.
