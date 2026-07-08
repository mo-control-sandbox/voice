import { builtinModules } from "node:module"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type UserConfig } from "vite"
import mobrowserConfig from "./mobrowser.conf.json" with { type: "json" }

const mainProcessExternals = [
  "mobrowser",
  "import-in-the-middle",
  "module-details-from-path",
  "require-in-the-middle",
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]

const appVersion = mobrowserConfig.app.version
const appRelease = [
  appVersion.major,
  appVersion.minor,
  appVersion.patch,
].join(".")

const buildTimeDefines = {
  __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? ""),
  __SENTRY_RELEASE__: JSON.stringify(`${mobrowserConfig.app.name}@${appRelease}`),
}

export default defineConfig(({ mode }) => {
  if (mode === "main") {
    return defineMainConfig()
  }
  if (mode === "renderer") {
    return defineRendererConfig()
  }
  throw new Error(`Unsupported Vite config mode: ${mode}`)
})

function defineMainConfig(): UserConfig {
  return {
    root: path.resolve(__dirname, "./src/main"),
    define: buildTimeDefines,
    build: {
      target: "esnext",
      outDir: path.resolve(__dirname, "./out/main"),
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: path.resolve(__dirname, "./src/main/index.ts"),
        formats: ["es"],
        fileName: () => "index.js",
      },
      rollupOptions: {
        external: mainProcessExternals,
      },
    },
    resolve: {
      conditions: ["node"],
      alias: {
        "@": path.resolve(__dirname, "./src/main"),
      },
    },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error', 'log'],
      },
    },
  }
}


function defineRendererConfig(): UserConfig {
  return {
    root: path.resolve(__dirname, "./src/renderer"),
    define: buildTimeDefines,
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, "./out/renderer"),
      emptyOutDir: true,
      sourcemap: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src/renderer"),
      },
    },
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error', 'log'],
      },
    },
  }
}
