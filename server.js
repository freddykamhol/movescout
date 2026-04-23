/* eslint-disable @typescript-eslint/no-require-imports */

const http = require("http");
const next = require("next");

const hostname = "0.0.0.0";
const port = 4000;
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, hostname, () => {
        console.log(`MoveScout listening on http://${hostname}:${port} (dev=${dev})`);
      });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
