const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const http = require("http");

let serverProcess = null;

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function tryConnect() {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error("El servidor no arrancó a tiempo"));
            return;
          }
          setTimeout(tryConnect, 300);
        });
    }

    tryConnect();
  });
}

function startServer() {
  const userDataPath = app.getPath("userData");

  serverProcess = fork(path.join(__dirname, "server.js"), [], {
    stdio: "inherit",
    env: {
      ...process.env,
      APP_STORAGE_PATH: userDataPath,
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL("http://localhost:3000");
}

app.whenReady().then(async () => {
  startServer();
  await waitForServer("http://localhost:3000");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});