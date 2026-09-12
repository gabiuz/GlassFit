import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const serviceDirectory = resolve("fastapi-service");
const virtualEnvironment = process.env.VIRTUAL_ENV;
const executableName = process.platform === "win32" ? "python.exe" : "python";
const executableDirectory = process.platform === "win32" ? "Scripts" : "bin";
const candidates = [
  virtualEnvironment
    ? resolve(virtualEnvironment, executableDirectory, executableName)
    : null,
  resolve(serviceDirectory, "venv", executableDirectory, executableName),
  resolve(serviceDirectory, ".venv", executableDirectory, executableName),
].filter((candidate) => candidate !== null);

const localPython = candidates.find((candidate) => existsSync(candidate));
const python = localPython ?? (process.platform === "win32" ? "python" : "python3");
const pytestArguments = process.argv.slice(2);
const result = spawnSync(
  python,
  ["-m", "pytest", ...(pytestArguments.length > 0 ? pytestArguments : ["tests"])],
  {
    cwd: serviceDirectory,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Unable to start FastAPI tests: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
