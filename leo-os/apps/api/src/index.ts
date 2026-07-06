import { createApp } from "./app.js";
import { bootstrap } from "./lib/bootstrap.js";

const port = Number(process.env["PORT"] ?? 8080);

async function main() {
  await bootstrap();
  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`LEO API listening on :${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
