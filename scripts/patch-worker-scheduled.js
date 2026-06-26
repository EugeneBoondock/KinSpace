// Post-build patch: OpenNext's generated .open-next/worker.js only exports a
// `fetch` handler, so Cloudflare cron triggers have nothing to call. This injects
// a `scheduled()` method that pings our own (secret-guarded) cron endpoint, which
// runs inside the full Next/OpenNext request context. `fetch` is left untouched,
// so this cannot change request handling. A bad patch only fails the build.
const fs = require('node:fs')
const path = require('node:path')

const file = path.resolve(__dirname, '..', '.open-next', 'worker.js')
let src = fs.readFileSync(file, 'utf8')

if (src.includes('async scheduled(')) {
  console.log('worker.js scheduled() already present, skipping')
  process.exit(0)
}

const marker = 'export default {'
if (!src.includes(marker)) {
  throw new Error('patch-worker-scheduled: could not find "export default {" in worker.js')
}

const injection = `export default {
    async scheduled(event, env, ctx) {
        try {
            const base = (env && env.NEXT_PUBLIC_APP_URL) || "https://www.kinspace.co.za";
            const secret = (env && env.CRON_SECRET) || "";
            ctx.waitUntil(
                Promise.all([
                    fetch(base + "/api/cron/med-reminders", {
                        method: "POST",
                        headers: { Authorization: "Bearer " + secret },
                    }).catch(() => {}),
                    fetch(base + "/api/cron/guide-sessions", {
                        method: "POST",
                        headers: { Authorization: "Bearer " + secret },
                    }).catch(() => {}),
                ])
            );
        } catch (e) {
            // scheduled work is best-effort
        }
    },`

src = src.replace(marker, injection)
fs.writeFileSync(file, src)
console.log('Injected scheduled() cron handlers into worker.js')
