import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadVerified, githubBlobSha } from "./ingest-render-dock.mjs";

const SOURCE_URL = "https://raw.githubusercontent.com/jan2xo/BKE_RENDER_DOCK/a/picture.jpeg";
test("Git blob hash matches canonical Git blob-header SHA1", () => {
  const bytes = Buffer.from("test");
  const expected = createHash("sha1").update("blob 4\0test").digest("hex");
  assert.equal(githubBlobSha(bytes), expected);
});
test("bounded download accepts exact SHA-256, bytes and pinned Git blob SHA", async () => {
  const bytes = Buffer.from("BKESIT");
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const response = new Response(bytes, {status: 200});
    Object.defineProperty(response, "url", {value: url});
    return response;
  };
  try {
    const folder = await mkdtemp(join(tmpdir(), "bkesit-"));
    const destination = join(folder, "picture.jpeg");
    await downloadVerified(SOURCE_URL, destination, bytes.length, createHash("sha256").update(bytes).digest("hex"), githubBlobSha(bytes));
    assert.deepEqual(await readFile(destination), bytes);
  } finally { globalThis.fetch = original; }
});
test("download rejects a tampered payload", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const response = new Response("tampered", {status: 200});
    Object.defineProperty(response, "url", {value: url});
    return response;
  };
  try {
    const folder = await mkdtemp(join(tmpdir(), "bkesit-bad-"));
    await assert.rejects(downloadVerified(SOURCE_URL, join(folder, "wrong.bin"), 8, "0".repeat(64)), /SHA-256 mismatch/);
  } finally { globalThis.fetch = original; }
});
test("download rejects untrusted origin before making network request", async () => {
  await assert.rejects(downloadVerified("https://evil.example/file", "/tmp/never-use-this-name", 1), /origin is not allowed/);
});
test("download enforces stated size and rejects oversized streams", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const response = new Response("too many bytes", {status: 200});
    Object.defineProperty(response, "url", {value: url});
    return response;
  };
  try {
    const folder = await mkdtemp(join(tmpdir(), "bkesit-large-"));
    await assert.rejects(downloadVerified(SOURCE_URL, join(folder, "large.bin"), 4), /exceeded declared byte count/);
  } finally { globalThis.fetch = original; }
});
