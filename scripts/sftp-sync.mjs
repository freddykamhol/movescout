import fs from "node:fs/promises";
import path from "node:path";

import SftpClient from "ssh2-sftp-client";

function getEnv(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function getNumberEnv(name, fallback) {
  const raw = getEnv(name, "");
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

async function listLocalFilesRecursively(rootDir) {
  const out = [];
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (entry.isFile()) {
        out.push(absolute);
      }
    }
  }
  await walk(rootDir);
  return out;
}

async function main() {
  const localRoot = getEnv("MOVESCOUT_DOCUMENTS_ROOT", path.join(process.cwd(), "data", "documents"));
  const remoteRoot = getEnv("MOVESCOUT_SFTP_REMOTE_ROOT", "/movescout/documents");

  const host = getEnv("MOVESCOUT_SFTP_HOST");
  const port = getNumberEnv("MOVESCOUT_SFTP_PORT", 22);
  const username = getEnv("MOVESCOUT_SFTP_USER");
  const password = getEnv("MOVESCOUT_SFTP_PASS");
  const privateKeyPath = getEnv("MOVESCOUT_SFTP_PRIVATE_KEY_PATH");

  if (!host || !username || (!password && !privateKeyPath)) {
    console.error(
      "Missing SFTP env vars. Required: MOVESCOUT_SFTP_HOST, MOVESCOUT_SFTP_USER and (MOVESCOUT_SFTP_PASS or MOVESCOUT_SFTP_PRIVATE_KEY_PATH).",
    );
    process.exitCode = 2;
    return;
  }

  try {
    await fs.access(localRoot);
  } catch {
    console.error(`Local documents root does not exist: ${localRoot}`);
    process.exitCode = 2;
    return;
  }

  const sftp = new SftpClient();
  const connectionConfig = {
    host,
    port,
    username,
    password: password || undefined,
    privateKey: privateKeyPath ? await fs.readFile(privateKeyPath, "utf8") : undefined,
  };

  console.log(`Connecting SFTP ${username}@${host}:${port} ...`);
  await sftp.connect(connectionConfig);
  console.log(`Syncing ${localRoot} -> ${remoteRoot}`);

  const files = await listLocalFilesRecursively(localRoot);
  for (const absolutePath of files) {
    const relative = path.relative(localRoot, absolutePath).split(path.sep).join("/");
    const remotePath = `${remoteRoot.replace(/\/+$/, "")}/${relative}`;
    const remoteDir = remotePath.split("/").slice(0, -1).join("/");

    await sftp.mkdir(remoteDir, true);
    await sftp.fastPut(absolutePath, remotePath);
  }

  await sftp.end();
  console.log(`Done. Uploaded ${files.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
