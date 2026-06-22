import { getCloudflareContext } from '@opennextjs/cloudflare'

/** Typed access to Cloudflare bindings + vars for the current request. */
export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env
}

export async function getEnvAsync(): Promise<CloudflareEnv> {
  return (await getCloudflareContext({ async: true })).env
}

/** Convenience accessors for individual bindings. */
export const bindings = {
  kv: () => getEnv().KV,
  media: () => getEnv().MEDIA,
  jobsQueue: () => getEnv().JOBS_QUEUE,
}
