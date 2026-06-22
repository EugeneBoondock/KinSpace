import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// OpenNext adapter config for Cloudflare Workers.
// Caching can be tuned here later (R2 incremental cache, KV tag cache, etc.):
//   https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig()
