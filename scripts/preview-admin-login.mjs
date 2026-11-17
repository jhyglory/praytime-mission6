import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = process.argv[2] || "3110";
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Use a local port between 1024 and 65535.");
const env = { ...process.env };
for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "PRAYER_SUPABASE_URL", "PRAYER_SUPABASE_PUBLISHABLE_KEY", "PRAYER_SUPABASE_SECRET_KEY", "CMS_DEPLOYMENT_PROTECTION", "CMS_ADMIN_ACCESS_KEY", "CMS_ADMIN_USERNAME", "CMS_ADMIN_PASSWORD_SHA256", "VERCEL", "VERCEL_ENV", "VERCEL_AUTOMATION_BYPASS_SECRET"]) env[key] = "";
Object.assign(env, { BETA_SIGNUP_PERSISTENCE: "disabled", CMS_ADMIN_MODE: "local", CMS_DEMO_ENV: "true", SITE_URL: `http://127.0.0.1:${port}` });

console.log(`Login UI review: http://127.0.0.1:${port}/admin/login (backend connections disabled)`);
const child = spawn(process.execPath, [`${root}node_modules/next/dist/bin/next`, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", port], { cwd: root, env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Could not start the local login UI preview."); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1); });
