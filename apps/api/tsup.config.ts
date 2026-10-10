import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  // Workspace packages ship TypeScript source, so they are bundled; npm deps stay external.
  noExternal: [/^@sagarnu\//],
  clean: true,
  sourcemap: true,
});
