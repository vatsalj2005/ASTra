import fs from "fs";
import path from "path";

let envLoaded = false;

/**
 * Programmatic environment variable loader for ASTra.
 * Reads .env and .env.local files, parsing key-value pairs and registering them.
 * This runs at the module import level to ensure variables are present before
 * subsequent module scope initialization.
 */
export function loadEnv(): void {
  if (envLoaded) return;

  const loadFile = (filename: string) => {
    const filePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), filename);
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();

          // Strip surrounding quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          // Set environment variable if not already defined or is placeholders
          if (!process.env[key] || process.env[key]?.startsWith("your_")) {
            process.env[key] = value;
          }
        }
      }
    } catch (err) {
      console.warn(`Warning: Failed to parse env file "${filename}":`, err);
    }
  };

  // Load .env first, then .env.local to override
  loadFile(".env");
  loadFile(".env.local");
  envLoaded = true;
}
