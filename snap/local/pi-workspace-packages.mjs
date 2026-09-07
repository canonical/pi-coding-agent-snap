#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Canonical Ltd.
//
// Derive the set of @earendil-works workspace packages pi needs at runtime.
//
// The snap payload ships node_modules/ (npm workspace symlinks) plus the
// dist/, package.json and README.md of each workspace package under
// packages/. Historically that copy list was hardcoded, so an upstream pi
// release that adds a new workspace package (e.g. @earendil-works/chord in
// 0.85.1) shipped a dangling node_modules symlink and crashed at runtime
// with ERR_MODULE_NOT_FOUND. npm never catches this: npm resolves the
// symlink inside the build tree, where the target package always exists.
//
// Instead of hand-maintaining that list, derive it from the actual imports
// in the built dist/: seed the search with the CLI entry package and follow
// every @earendil-works/* import (including subpaths such as
// @earendil-works/pi-ai/compat) across each shipped package's dist until a
// fixpoint is reached. This is the ground truth of what the runtime loads.
//
// package.json `dependencies` fields are NOT reliable for this: in 0.85.1
// pi-client/pi-protocol are devDependencies of coding-agent yet the runtime
// never imports them, while pi-server/pi-evals are workspace packages that
// nothing at runtime loads either. Only the compiled imports tell the truth.
//
// Usage (from the pi repo root, after `npm run build:offline`):
//   node pi-workspace-packages.mjs
// Prints the workspace package directory names (e.g. "agent", "chord"),
// one per line.
//
// Options:
//   --scan-root <dir>   repo root containing node_modules/ and packages/
//                       (default: process.cwd())
//   --entry <pkg-dir>   package dir to seed the search (default: coding-agent)
//   --exclude <dirs>    comma-separated package dirs to refuse even if
//                       referenced (guard only; normally not needed)

import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const ROOT = resolve(arg("scan-root") || ".");
const ENTRY = arg("entry") || "coding-agent";
const EXCLUDE = new Set((arg("exclude") || "").split(",").filter(Boolean));

// Map npm package name -> packages/<dir>, discovered via the npm workspace
// symlinks under node_modules/@earendil-works/* (each points at
// ../../packages/<dir>). This is more robust than a name->dir convention
// (pi-agent-core -> agent, pi-session-backend-sqlite-node -> ...).
const nameToDir = new Map();
const scopedRoot = join(ROOT, "node_modules", "@earendil-works");
for (const link of readdirSync(scopedRoot)) {
  const linkPath = join(scopedRoot, link);
  if (!lstatSync(linkPath).isSymbolicLink()) continue;
  const pkgDir = resolve(dirname(linkPath), readlinkSync(linkPath));
  const packagesRoot = join(ROOT, "packages") + "/";
  if (!pkgDir.startsWith(packagesRoot)) continue;
  const rel = pkgDir.slice(packagesRoot.length);
  if (rel.includes("/")) continue; // nested packages are covered via parents
  const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  nameToDir.set(manifest.name, rel);
}

// Any @earendil-works/<name> specifier. Stops at '/', so subpath imports
// like @earendil-works/pi-ai/compat still resolve to the base package.
const wsRe = /@earendil-works\/[a-z0-9-]+/g;

// Every JS entry in a package's dist/, skipping the coding-agent `dist/bundle`
// duplicate (the snap strips it and pi.wrapper execs dist/cli.js directly).
const distFiles = (pkgDir) => {
  const out = [];
  const base = join(ROOT, "packages", pkgDir, "dist");
  if (!existsSync(base)) return out;
  const stack = [base];
  while (stack.length) {
    const d = stack.pop();
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (entry === "bundle" && p === join(base, "bundle")) continue;
        stack.push(p);
      } else if (/\.(js|mjs|cjs)$/.test(entry)) {
        out.push(p);
      }
    }
  }
  return out;
};

// BFS over the workspace dependency graph, following real compiled imports.
const needed = new Set([ENTRY]);
const queue = [ENTRY];
while (queue.length) {
  const dir = queue.shift();
  if (EXCLUDE.has(dir)) continue;
  for (const file of distFiles(dir)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(wsRe)) {
      const depDir = nameToDir.get(m[0]);
      if (depDir && !needed.has(depDir) && !EXCLUDE.has(depDir)) {
        needed.add(depDir);
        queue.push(depDir);
      }
    }
  }
}

process.stdout.write([...needed].sort().join("\n") + "\n");