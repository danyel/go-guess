import { spawn } from "node:child_process";
import http from "node:http";

const authorizationServer = http.createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.end(
    JSON.stringify({
      allowed: true,
      tenant_slug: "ypto",
      application_slug: "guess",
      api_key_name: "bdd",
    }),
  );
});

authorizationServer.listen(18081, "127.0.0.1", () => {
  const cucumber = spawn("cucumber-js", ["--config", "cucumber.mjs"], {
    stdio: "inherit",
  });
  cucumber.on("exit", (code, signal) => {
    authorizationServer.close(() => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 1);
      }
    });
  });
});
