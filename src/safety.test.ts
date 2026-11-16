import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { assertAllowedHost, confineToDownloads } from "./config.js";
import { MoodleClient } from "./ws.js";

const client = new MoodleClient({
  key: "moodle.example.fi",
  url: "https://moodle.example.fi",
  token: "SECRET",
  userid: 1,
  strategy: "manual",
  connectedAt: "test",
});

test("fileUrl signs a file on the Moodle site", () => {
  const url = client.fileUrl("https://moodle.example.fi/pluginfile.php/1/mod_resource/content/0/a.pdf");
  assert.equal(new URL(url).searchParams.get("token"), "SECRET");
});

test("fileUrl never attaches the token to another origin", () => {
  for (const url of [
    "https://evil.example/pluginfile.php/1/a.pdf",
    "https://moodle.example.fi.evil.example/a.pdf", // look-alike host
    "http://moodle.example.fi/a.pdf", // scheme downgrade
    "https://moodle.example.fi:8443/a.pdf", // other port
  ]) {
    assert.throws(() => client.fileUrl(url), /Blocked/, url);
  }
});

test("confineToDownloads allows folders inside the root", () => {
  const root = resolve("downloads-root");
  assert.equal(confineToDownloads("course1", root), join(root, "course1"));
  assert.equal(confineToDownloads(join(root, "a", "b"), root), join(root, "a", "b"));
  assert.equal(confineToDownloads("", root), root);
});

test("confineToDownloads refuses anything outside the root", () => {
  const root = resolve("downloads-root");
  for (const dest of [
    "..",
    join("..", "outside"),
    join("a", "..", "..", "outside"),
    resolve(root, "..", "outside"),
    `${root}-evil`, // shares the root's name as a prefix
  ]) {
    assert.throws(() => confineToDownloads(dest, root), /must be inside/, dest);
  }
});

test("assertAllowedHost accepts only the listed hosts", () => {
  const list = " Moodle.Example.fi , other.example.fi:8443 ";
  assertAllowedHost("moodle.example.fi", list);
  assertAllowedHost("https://MOODLE.example.fi/login/index.php", list);
  assertAllowedHost("https://other.example.fi:8443", list);
  for (const url of [
    "evil.example",
    "moodle.example.fi.evil.example", // look-alike host
    "moodle.example.fi:8443", // listed name, different port
    "other.example.fi", // listed with a port only
  ]) {
    assert.throws(() => assertAllowedHost(url, list), /not in MOODLE_MCP_ALLOWED_HOSTS/, url);
  }
});

test("assertAllowedHost refuses everything when the list is unset or empty", () => {
  for (const list of ["", " , "]) {
    assert.throws(() => assertAllowedHost("moodle.example.fi", list), /moodle_connect is disabled/, list);
  }
});

// Tool guard: these read the source, so merging unreviewed upstream code (write tools) fails `npm test`.
const SRC = new URL("../src/", import.meta.url); // tests run from dist/

test("only the vetted read-only tools are registered", () => {
  const server = readFileSync(new URL("server.ts", SRC), "utf8");
  const names = [...server.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(names, [
    "moodle_activity",
    "moodle_connect",
    "moodle_courses",
    "moodle_deadlines",
    "moodle_disconnect",
    "moodle_download",
    "moodle_forum",
    "moodle_grades",
    "moodle_notifications",
    "moodle_outline",
    "moodle_search",
    "moodle_status",
    "moodle_whatsnew",
  ]);
});

test("every Moodle function the code names is a read (_get_) function", () => {
  // shortcut: sees string literals only; names built from variables (getModInstances in api.ts) are not checked, upgrade if more are added.
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
  assert.ok(files.length > 5, "source files not found");
  for (const f of files) {
    const text = readFileSync(new URL(f.replaceAll("\\", "/"), SRC), "utf8");
    for (const m of text.matchAll(/"((?:core|mod|tool|gradereport|report|block|enrol|auth|message|local)_[a-z0-9_]+)"/g)) {
      assert.match(m[1]!, /_get_/, `${f} names a non-read Moodle function: ${m[1]}`);
    }
  }
});
