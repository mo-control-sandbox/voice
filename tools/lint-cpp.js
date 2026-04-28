#!/usr/bin/env node
// Collects C++ source files under src/native (excluding gen/) and runs clang-tidy on them.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const NATIVE_DIR = join(ROOT, "src", "native");
const SOURCE_EXTENSIONS = new Set([".cc", ".cpp", ".h", ".mm"]);

function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "gen") results.push(...collectFiles(full));
    } else if (SOURCE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      results.push(full);
    }
  }
  return results;
}

const files = collectFiles(NATIVE_DIR);
if (files.length === 0) {
  console.log("lint:cpp — no source files found, skipping.");
  process.exit(0);
}

console.log(`lint:cpp — checking ${files.length} file(s) with clang-tidy`);
execFileSync("clang-tidy", ["-p", "build", ...files], { stdio: "inherit" });
