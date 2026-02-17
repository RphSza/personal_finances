import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

const isWindows = process.platform === "win32";
const command = isWindows ? "powershell" : "bash";
const commandArgs = isWindows
  ? ["-ExecutionPolicy", "Bypass", "-File", "scripts/update-schema-snapshot.ps1", ...args]
  : ["scripts/update-schema-snapshot.sh", ...args];

const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: false });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
