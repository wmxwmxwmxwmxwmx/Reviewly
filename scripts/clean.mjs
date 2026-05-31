import { rmSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..")

const paths = [
  join(root, "apps", "web", ".next"),
  join(root, "apps", "web", "out"),
  join(root, "out"),
  join(root, "dist"),
  join(root, "packages", "shared", "dist"),
]

for (const path of paths) {
  rmSync(path, { recursive: true, force: true })
}

console.log("Cleaned build artifacts:", paths.map((p) => p.replace(root + "\\", "").replace(root + "/", "")).join(", "))
