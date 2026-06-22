/* eslint-disable @typescript-eslint/no-explicit-any */
import { rpc } from './rpc-client'

// Client-facing data API. Preserves the original DatabaseService.<method>(...)
// surface, forwarding every call to the server-side D1 data layer via /api/rpc.
// The server authenticates the session and derives the actor — client-passed
// ids are never trusted for authorization.
type DataAPI = Record<string, (...args: any[]) => Promise<any>>

export const DatabaseService: DataAPI = new Proxy({} as DataAPI, {
  get(_target, prop: string) {
    if (prop === 'then') return undefined // guard against being awaited as a thenable
    return (...args: any[]) => rpc(prop, args)
  },
})
