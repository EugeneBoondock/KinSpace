'use server'

import { cookies } from 'next/headers'
import { requireUser } from '@/server/auth/current-user'
import { SESSION_COOKIE, invalidateAllSessions } from '@/server/auth/session'
import { exportUserData, deleteUserData } from '@/server/privacy/data'

export async function exportMyDataAction(): Promise<
  { ok: true; json: string } | { ok: false; error: string }
> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }
  try {
    const data = await exportUserData(user.userId)
    return { ok: true, json: JSON.stringify(data, null, 2) }
  } catch (error) {
    console.error('Data export failed:', error)
    return { ok: false, error: 'Could not export your data right now.' }
  }
}

/**
 * Permanently deletes the account. Requires the user to type their exact email
 * as confirmation to guard against accidental deletion.
 */
export async function deleteAccountAction(
  confirmation: string,
): Promise<{ ok: true; redirect: string } | { ok: false; error: string }> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }

  if (confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: 'Type your email exactly to confirm deletion.' }
  }

  try {
    await invalidateAllSessions(user.userId)
    await deleteUserData(user.userId)
    ;(await cookies()).delete(SESSION_COOKIE)
    return { ok: true, redirect: '/' }
  } catch (error) {
    console.error('Account deletion failed:', error)
    return { ok: false, error: 'Could not delete your account. Please contact support.' }
  }
}
