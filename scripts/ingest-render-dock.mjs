#!/usr/bin/env node
// Trusted BKESIT-side, pull-only ingestion. Publication is a separate gated workflow step.
// No source-repository code is executed using BKESIT write authority.
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  normalizeRelease, versionFromTag, IMAGE_SOURCE_PATH, IMAGE_TARGET_NAME,
  SOURCE_REPOSITORY,
} from "./render-dock-contract.mjs";

const SOURCE_API = "https://api.github.com/repos/" + SOURCE_REPOSITORY + "/";
function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}
async function getSource(path) {
  const url = SOURCE_API + path;
  const response = await fetch(url, {
    headers: { accept: "application/vnd.github+json", "user-agent": "bkesit-catalog-ingestion", "x-github-api-version": "2022-11-28" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("GitHub source API failed " + response.status + " at " + path);
  return response.json();
}
async function resolveCommit(tag) {
  const ref = await getSource("git/ref/tags/" + encodeURIComponent(tag));
  let pointer = ref.object;
  for (let i = 0; i < 3 && pointer?.type === "tag"; i++) {
    const annotated = await getSource("git/tags/" + pointer.sha);
    pointer = annotated.object;
  }
  assert(pointer?.type === "commit" && /^[0-9a-f]{40}$/.test(pointer.sha), "Unresolvable GitHub source tag");
  return pointer;
}
async function getSourceJson(path, sha) {
  const obj = await getSource("contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + sha);
  assert(obj.encoding === "base64" && typeof obj.content === "string", "Missing source manifest");
  return JSON.parse(Buffer.from(obj.content.replace(/\s/g, ""), "base64").toString("utf8"));
}
export function githubBlobSha(bytes) {
  return createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
}
export async function downloadVerified(url, outputFile, expectedBytes, expectedSha256 = null, expectedBlobSha = null) {
  assert(url.startsWith("https://github.com/" + SOURCE_REPOSITORY + "/releases/download/") ||
         url.startsWith("https://raw.githubusercontent.com/" + SOURCE_REPOSITORY + "/"), "Download origin is not allowed");
  const response = await fetch(url, {
    headers: { "user-agent": "bkesit-catalog-ingestion" },
    signal: AbortSignal.timeout(180_000),
  });
  assert(response.ok && response.body, "Source download failed " + response.status);
  const finalHost = new URL(response.url).hostname;
  assert(finalHost === "github.com" || finalHost === "raw.githubusercontent.com" ||
    finalHost.endsWith(".githubusercontent.com"), "Unexpected download redirect host");
  const digest = createHash("sha256");
  const blob = expectedBlobSha ? createHash("sha1") : null;
  if (blob) blob.update("blob " + expectedBytes + "\0");
  let total = 0;
  const verifyStream = new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      if (total > expectedBytes) return callback(new Error("Source download exceeded declared byte count"));
      digest.update(chunk);
      if (blob) blob.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), verifyStream, createWriteStream(outputFile, { flags: "wx" }));
  assert(total === expectedBytes, "Source download byte count mismatch");
  if (expectedSha256) assert(digest.digest("hex") === expectedSha256, "Source download SHA-256 mismatch");
  if (blob) assert(blob.digest("hex") === expectedBlobSha, "Source product-image Git blob SHA mismatch");
}
export async function ingestRenderDock(tag, requiredSha, outputDir = "dist/bkesit-release") {
  const version = versionFromTag(tag);
  assert(typeof requiredSha === "string" && /^[0-9a-f]{40}$/.test(requiredSha), "Explicit exact source_sha required");
  const reference = await resolveCommit(tag);
  assert(reference.sha === requiredSha, "Release tag no longer points to requested source SHA");
  const [release, productManifest, image] = await Promise.all([
    getSource("releases/tags/" + encodeURIComponent(tag)),
    getSourceJson("BKE_RENDER_DOCK/bke.manifest.json", reference.sha),
    getSource("contents/" + IMAGE_SOURCE_PATH.split("/").map(encodeURIComponent).join("/") + "?ref=" + reference.sha),
  ]);
  const entry = normalizeRelease({ release, reference, productManifest, image, tag });
  assert(entry.version === version, "Version mismatch");
  await mkdir(outputDir, { recursive: true });
  for (const asset of entry.distribution.assets) {
    console.log("VERIFY " + asset.name + " (" + asset.bytes + " bytes)");
    await downloadVerified(asset.sourceUrl, join(outputDir, asset.name), asset.bytes, asset.sha256);
  }
  const imageUrl = "https://raw.githubusercontent.com/" + SOURCE_REPOSITORY + "/" + requiredSha +
    "/" + IMAGE_SOURCE_PATH.split("/").map(encodeURIComponent).join("/");
  await downloadVerified(imageUrl, join(outputDir, IMAGE_TARGET_NAME), image.size, null, image.sha);
  // Keep catalog entry accurate even before publication. The destination is a
  // target, not an assertion that a release or customer entitlement exists.
  delete entry.distribution.publicationState;
  await writeFile(join(outputDir, "catalog-entry.json"), JSON.stringify(entry, null, 2) + "\n");
  console.log("VERIFIED: " + entry.productId + " " + tag + " @ " + requiredSha);
  console.log("TARGET: " + entry.distribution.releaseUrl);
  console.log("PUBLISHING: not performed by this script");
  return entry;
}
export async function main(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== "--tag" || args[2] !== "--source-sha") {
    throw new Error("Usage: node scripts/ingest-render-dock.mjs --tag vX.Y.Z --source-sha <40-character SHA>");
  }
  await ingestRenderDock(args[1], args[3]);
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch(error => { console.error("BKESIT_INGEST_FAILED: " + error.message); process.exitCode = 1; });
}
