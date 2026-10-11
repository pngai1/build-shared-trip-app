#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditPrivacy } from "./audit-privacy.mjs";

const script = fileURLToPath(new URL("./audit-privacy.mjs", import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "trip-privacy-audit-"));
const target = path.join(temporary, "fixture");
fs.mkdirSync(target);

function inspect(content, name = "input.json", options = {}) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, name), content);
  return auditPrivacy(target, options).map(({ label }) => label);
}

try {
  // Assemble deliberately unsafe fixtures at runtime so the test source itself is clean.
  const inventedProject = ["invented", "trip", "fixture"].join("-");
  const publicConfig = JSON.stringify({ projectId: inventedProject, authDomain: `${inventedProject}.${["firebaseapp", "com"].join(".")}` });
  assert.ok(inspect(publicConfig).includes("non-placeholder Firebase project configuration"));
  assert.ok(inspect(publicConfig).includes("non-placeholder Firebase project host"));
  assert.deepEqual(inspect(publicConfig, "config.json", { mode: "app" }), []);
  assert.deepEqual(inspect(JSON.stringify({ projectId: "YOUR_PROJECT_ID", authDomain: "REPLACE_FIREBASE_AUTH_DOMAIN" })), []);
  assert.deepEqual(inspect('const docs = "example-project.web.app";'), []);

  const localEmail = ["imaginary-person", ["workstation", "local"].join(".")].join("@");
  assert.ok(inspect(localEmail).includes("local personal email"));
  const privateKey = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  assert.ok(inspect(privateKey, "README.md").includes("private key"));
  assert.ok(inspect("", "private.pem").includes("credential file"));
  assert.ok(inspect("", ".env").includes("private environment or key file"));
  assert.deepEqual(inspect("PUBLIC_VALUE=example", ".env.example"), []);
  assert.ok(inspect("{}", "service-account-demo.json").includes("credential file"));
  const serviceEmail = ["demo", ["fixture", "iam", "gserviceaccount", "com"].join(".")].join("@");
  assert.ok(inspect(serviceEmail, "settings.txt", { mode: "app" }).includes("service-account email"));
  const driveUrl = ["https:/", "/docs.", "google.com/document/d/invented"].join("");
  assert.ok(inspect(driveUrl, "notes").includes("Google Drive share URL"));
  const token = ["ghp", "a".repeat(36)].join("_");
  assert.ok(inspect(token).includes("GitHub access token"));
  const secretField = JSON.stringify({ [["refresh", "token"].join("_")]: "invented" });
  assert.ok(inspect(secretField).includes("booking or identity secret field"));
  for (const parts of [["client", "secret"], ["refresh", "token"], ["access", "token"]]) {
    const variants = [parts.join("_"), parts.join("-"), parts.map((part, i) => i ? part[0].toUpperCase() + part.slice(1) : part).join("")];
    for (const key of variants) {
      assert.ok(inspect(JSON.stringify({ [key]: "invented" })).includes("booking or identity secret field"), `quoted ${key} must be forbidden`);
      if (!key.includes("-")) assert.ok(inspect(`const settings = { ${key}: "invented" };`, "settings.mjs").includes("booking or identity secret field"), `unquoted ${key} must be forbidden`);
    }
  }
  assert.deepEqual(inspect("Never publish credentials. Public Firebase apiKey is metadata.", "README.md"), []);
  assert.deepEqual(inspect(JSON.stringify({ auth: true, apiKey: "PUBLIC_WEB_CONFIG_TEST_VALUE" })), []);

  inspect(localEmail);
  const denylist = path.join(temporary, "private-denylist.txt");
  fs.writeFileSync(denylist, `# Private entries stay outside the repository\n${inventedProject}\n`);
  fs.writeFileSync(path.join(target, "project.txt"), inventedProject);
  const blocked = spawnSync(process.execPath, [script, target, "--denylist", denylist], { encoding: "utf8" });
  assert.equal(blocked.status, 1);
  assert.ok(blocked.stderr.includes("external private denylist match"));
  assert.ok(!blocked.stderr.includes(localEmail), "output must not echo matching identities");
  assert.ok(!blocked.stderr.includes(inventedProject), "output must not echo denylist values");
  assert.ok(!blocked.stdout.includes(inventedProject));

  const internalDenylist = path.join(target, "denylist.txt");
  fs.copyFileSync(denylist, internalDenylist);
  const rejected = spawnSync(process.execPath, [script, target, "--denylist", internalDenylist], { encoding: "utf8" });
  assert.equal(rejected.status, 2);
  assert.ok(rejected.stderr.includes("outside the scanned directory"));
  const badMode = spawnSync(process.execPath, [script, target, "--mode", "invalid"], { encoding: "utf8" });
  assert.equal(badMode.status, 2);

  inspect(fs.readFileSync(script, "utf8"), "audit-privacy.mjs");
  assert.deepEqual(auditPrivacy(target), [], "the checker must scan its own source without exemptions");
  for (const ignored of [".git", "node_modules", ".firebase"]) {
    fs.mkdirSync(path.join(target, ignored));
    fs.writeFileSync(path.join(target, ignored, "private.txt"), localEmail);
  }
  assert.deepEqual(auditPrivacy(target), [], "tool-managed directories are not working-tree source");
  fs.writeFileSync(path.join(target, "showcase.jpg"), Buffer.from([255, 216, 0, 0, 255, 217]));
  assert.deepEqual(auditPrivacy(target), [], "approved binary images are not text-scanned");
  const skillRoot = path.dirname(path.dirname(script));
  const generated = path.join(temporary, "generated");
  const build = spawnSync(process.execPath, [path.join(skillRoot, "scripts/init-trip.mjs"), path.join(skillRoot, "assets/trip.example.json"), generated, "--allow-example"], { encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const ignores = fs.readFileSync(path.join(generated, ".gitignore"), "utf8");
  for (const entry of ["node_modules/", ".firebase/", ".firebaserc", ".env", "*.pem", "trip-input.json", "private/", "sources/"]) {
    assert.ok(ignores.split("\n").includes(entry), `generated project must ignore ${entry}`);
  }
  assert.deepEqual(auditPrivacy(generated, { mode: "app" }), []);
  console.log("Privacy audit tests passed (strict framework / public-config app modes, external denylist, no secret echo, and self-scan).");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
