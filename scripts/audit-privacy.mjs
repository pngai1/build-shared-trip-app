#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
import { isSensitiveKey } from "./validate-trip.mjs";

// Keep this checker generic: never add a real person's identity or project ID here.
const rules = [
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/i },
  { label: "service-account email", pattern: /@[a-z0-9.-]+\.iam\.gserviceaccount\.com\b/i },
  { label: "Google Drive share URL", pattern: /https:\/\/(?:drive|docs)\.google\.com\//i },
  { label: "local personal email", pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.(?:local|localhost|lan|internal)\b/i },
  { label: "GitHub access token", pattern: /\b(?:gh[pousr]_[a-z0-9]{30,}|github_pat_[a-z0-9_]{40,})\b/i },
  { label: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ }
];
const objectField = /(?:^|[{,\n])\s*(?:(["'])([a-z][a-z0-9_$ -]*)\1|([a-z_$][a-z0-9_$-]*))\s*:/gim;
const configField = /["']?(projectId|project_id|authDomain|storageBucket|databaseURL)["']?\s*:\s*["']([^"'\r\n]+)["']/g;
const projectHost = /\b([a-z0-9][a-z0-9_-]*)\.(?:web\.app|firebaseapp\.com|firebasestorage\.app|(?:[a-z0-9-]+\.)?firebasedatabase\.app)\b/gi;

export function auditPrivacy(target, { mode = "framework", denylist = [] } = {}) {
  if (!["framework", "app"].includes(mode)) throw new Error("Mode must be framework or app.");
  const findings = [];
  for (const file of walk(target)) {
    const relative = path.relative(target, file) || path.basename(file);
    const record = (label) => findings.push({ file: relative, label });
    const name = path.basename(file);
    if (fs.lstatSync(file).isSymbolicLink()) {
      record("symbolic link requires manual privacy review");
      continue;
    }
    if (/^(?:\.env(?:\..+)?|id_(?:rsa|dsa|ecdsa|ed25519))$/i.test(name) && !/\.(?:example|sample|template)$/i.test(name)) record("private environment or key file");
    if (/\.(?:pem|key|p12|pfx)$/i.test(name) || /(?:service[-_]?account|firebase[-_]?admin|application_default_credentials).*\.json$/i.test(name)) record("credential file");
    const bytes = fs.readFileSync(file);
    if (bytes.includes(0)) continue; // Binary assets, including the approved showcase images.
    const content = bytes.toString("utf8");
    for (const { label, pattern } of rules) if (pattern.test(content)) record(label);
    for (const [, , quotedKey, bareKey] of content.matchAll(objectField)) {
      if (isSensitiveKey(quotedKey || bareKey)) { record("booking or identity secret field"); break; }
    }
    if (mode === "framework") {
      for (const [, , value] of content.matchAll(configField)) {
        if (!isPlaceholder(value)) { record("non-placeholder Firebase project configuration"); break; }
      }
      for (const [, project] of content.matchAll(projectHost)) {
        if (!isPlaceholder(project)) { record("non-placeholder Firebase project host"); break; }
      }
      if (name === ".firebaserc") record("environment-specific Firebase project selection");
    }
    const folded = content.toLocaleLowerCase("en-US");
    if (denylist.some((literal) => folded.includes(literal.toLocaleLowerCase("en-US")))) record("external private denylist match");
  }
  return findings;
}

function isPlaceholder(value) {
  return /^(?:REPLACE_|YOUR_|__|\$\{|<)/i.test(value)
    || /^(?:other-)?(?:example|sample|demo|test)(?:[-_.]|$)/i.test(value);
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", ".firebase"].includes(entry.name)) continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(child));
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(child);
  }
  return files;
}

function main(args) {
  let targetArg = ".";
  let mode = "framework";
  let denylistPath;
  let hasTarget = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--help") {
      console.log("Usage: node scripts/audit-privacy.mjs [directory] [--mode framework|app] [--denylist /outside/tree/denylist.txt]\n\nFramework mode (default) also rejects non-placeholder Firebase project metadata.\nApp mode permits public Firebase web configuration but still checks secrets.\nAn optional external denylist contains one private literal per line; blank lines and # comments are ignored.\nOnly filenames and finding categories are reported, never matching values.\nThis heuristic scans working-tree text, not Git history or pixels in images. Review those separately.");
      return;
    }
    if (["--mode", "--denylist"].includes(args[i])) {
      const option = args[i];
      if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`${option} requires a value.`);
      const value = args[++i];
      if (option === "--mode") mode = value;
      else denylistPath = value;
    } else if (!args[i].startsWith("--") && !hasTarget) { targetArg = args[i]; hasTarget = true; }
    else throw new Error("Unknown argument. Use --help for supported options.");
  }
  const target = fs.realpathSync(path.resolve(targetArg));
  let denylist = [];
  if (denylistPath) {
    const resolved = fs.realpathSync(path.resolve(denylistPath));
    const relative = path.relative(target, resolved);
    if (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new Error("Keep the private denylist outside the scanned directory.");
    denylist = fs.readFileSync(resolved, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
    if (denylist.some((line) => line.length < 3)) throw new Error("Private denylist entries must contain at least three characters.");
  }
  const findings = auditPrivacy(target, { mode, denylist });
  if (findings.length) {
    for (const { file, label } of findings) console.error(`ERROR ${file}: ${label}`);
    process.exitCode = 1;
  } else console.log(`Privacy audit passed (${mode} mode). Working-tree text only; review history and images separately.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Privacy audit could not complete: ${error.message}`); process.exitCode = 2; }
}
