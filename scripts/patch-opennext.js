const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function write(relativePath, contents) {
  fs.writeFileSync(path.join(root, relativePath), contents)
}

function replace(relativePath, pattern, replacement, label, alreadyNeedle) {
  const contents = read(relativePath)
  if (!pattern.test(contents)) {
    if (alreadyNeedle && contents.includes(alreadyNeedle)) {
      return false
    }
    throw new Error(`OpenNext patch failed for ${label} in ${relativePath}`)
  }
  write(relativePath, contents.replace(pattern, replacement))
  return true
}

const requireHooksPath = "node_modules/@opennextjs/aws/dist/core/require-hooks.js"
const patchAsyncStoragePath = "node_modules/@opennextjs/aws/dist/core/patchAsyncStorage.js"
const requestHandlerPath = "node_modules/@opennextjs/aws/dist/core/requestHandler.js"

replace(
  requireHooksPath,
  /export function overrideHooks\(config\) \{\r?\n[\s\S]*?\r?\n\}/,
  `export function overrideHooks(config) {
    void config;
    return;
}`,
  "overrideHooks",
  "void config;",
)

replace(
  requireHooksPath,
  /export function applyOverride\(\) \{\r?\n[\s\S]*?\r?\n\}/,
  `export function applyOverride() {
    return;
}`,
  "applyOverride",
  "export function applyOverride() {\r\n    return;",
)

write(
  patchAsyncStoragePath,
  `export function patchAsyncStorage() {
    return;
}
`,
)

replace(
  requestHandlerPath,
  /\/\/#override withRouting\r?\n[\s\S]*?\/\/#endOverride/,
  `//#override withRouting
        if (globalThis.openNextConfig.middleware?.external !== true) {
            routingResult = await routingHandler(internalEvent, {
                assetResolver: globalThis.assetResolver,
            });
        }
        //#endOverride`,
  "withRouting",
  "globalThis.openNextConfig.middleware?.external !== true",
)

console.log("OpenNext Cloudflare worker patches applied")
