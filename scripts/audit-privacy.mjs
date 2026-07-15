#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [, , targetArg = "."] = process.argv;
const target = path.resolve(targetArg);
const findings = [];
const textExtensions = new Set([".js", ".mjs", ".json", ".html", ".css", ".md", ".yaml", ".yml", ".rules", ".webmanifest", ".svg"]);
const forbidden = [
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { label: "service-account email", pattern: /@[^\s"']+\.iam\.gserviceaccount\.com/i },
  { label: "Google Drive share URL", pattern: /https:\/\/(?:drive|docs)\.google\.com\//i },
  { label: "current trip participant initials", pattern: /\b(?:PN\s*[·./]\s*HG\s*[·./]\s*KW|CW\s*[·./]\s*SC)\b/i },
  { label: "current trip app title", pattern: /这个夏天[，,]\s*想和妳一起走走/ },
  { label: "current Firebase project", pattern: /REPLACE_FIREBASE_PROJECT_ID/i },
  { label: "current route destinations", pattern: /\b(?:Takachiho|Kagoshima|Kumamoto|Miyazaki|Fukuoka|Narita)\b/i },
  { label: "booking or identity secret key", pattern: /["'](?:confirmation_number|booking_reference|private_key|service_account|passport_number|card_number|cvv)["']\s*:/i }
];

for (const file of walk(target)) {
  if (path.resolve(file) === path.resolve(process.argv[1])) continue;
  if (!textExtensions.has(path.extname(file))) continue;
  const relative = path.relative(target, file) || path.basename(file);
  const content = fs.readFileSync(file, "utf8");
  forbidden.forEach(({ label, pattern }) => {
    if (pattern.test(content)) findings.push(`${relative}: ${label}`);
  });
}

if (findings.length) {
  findings.forEach((finding) => console.error(`ERROR ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Privacy audit passed for ${target}.`);
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", ".firebase"].includes(entry.name)) continue;
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}
