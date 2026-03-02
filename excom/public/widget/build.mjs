import { build } from "esbuild";

build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "ExcomChat",
  outfile: "excom-chat.js",
  jsx: "automatic",
  jsxImportSource: "preact",
  target: ["es2020"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
}).then(() => {
  console.log("Widget built -> excom-chat.js");
}).catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
