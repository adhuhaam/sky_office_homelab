import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.mjs",
  packages: "external",
  sourcemap: true,
  target: "node20",
});

console.log("API build complete");
