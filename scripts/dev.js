const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");

const root = path.resolve(__dirname, "..");
const logDir = path.join(root, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const children = [];
let cleaning = false;

function cleanup() {
  if (cleaning) return;
  cleaning = true;
  children.forEach(({ child, out }) => {
    try {
      if (isWin) {
        require("child_process").execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
      } else {
        child.kill();
      }
    } catch (_) {}
    try {
      out.end();
    } catch (_) {}
  });
  setTimeout(() => process.exit(0), 300);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const run = (name, cmd, args, cwd, logFile, opts = {}) => {
  const out = fs.createWriteStream(logFile, { flags: "a" });
  const child = spawn(cmd, args, {
    cwd,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  children.push({ child, out });
  child.on("error", (err) => {
    console.error(`[${name}] gagal dijalankan:`, err.message);
    cleanup();
  });
  child.on("exit", (code) => {
    console.log(`[${name}] berhenti (kode ${code})`);
    cleanup();
  });
  return child;
};

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      if (Date.now() - start > timeout) {
        return reject(new Error(`Port ${port} tidak ready dalam ${timeout}ms`));
      }
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("timeout", () => { socket.destroy(); setTimeout(attempt, 500); });
      socket.once("error", () => { socket.destroy(); setTimeout(attempt, 500); });
      socket.connect(port, "127.0.0.1");
    };
    attempt();
  });
}

console.log("Menjalankan SISNERLING...");
console.log("  - Server API : http://localhost:3000");
console.log("  - Client     : http://localhost:5173");

run("server", process.execPath, ["server.js"], path.join(root, "server"), path.join(logDir, "server.log"));

waitForPort(3000).then(() => {
  run("client", npmCmd, ["run", "dev"], path.join(root, "client"), path.join(logDir, "client.log"), {
    shell: isWin,
  });
}).catch((err) => {
  console.error("[startup] Server tidak ready:", err.message);
  cleanup();
});
