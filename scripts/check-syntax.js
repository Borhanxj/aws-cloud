const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const targets = ["server.js", "src", "scripts", "public"];

function collectJavaScriptFiles(entry) {
  const fullPath = path.join(root, entry);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const stat = fs.statSync(fullPath);

  if (stat.isFile()) {
    return fullPath.endsWith(".js") ? [fullPath] : [];
  }

  return fs
    .readdirSync(fullPath)
    .flatMap((name) => collectJavaScriptFiles(path.join(entry, name)));
}

const files = targets.flatMap(collectJavaScriptFiles);
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
