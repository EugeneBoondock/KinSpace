export const SIDEBAR_SCROLL_KEY = 'kinspace:sidebar-scroll-top'

type SidebarScrollStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readSidebarScrollTop(storage: SidebarScrollStorage | null | undefined): number {
  if (!storage) return 0
  const raw = storage.getItem(SIDEBAR_SCROLL_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

export function writeSidebarScrollTop(storage: SidebarScrollStorage | null | undefined, scrollTop: number): void {
  if (!storage) return
  const safe = Number.isFinite(scrollTop) && scrollTop > 0 ? Math.floor(scrollTop) : 0
  storage.setItem(SIDEBAR_SCROLL_KEY, String(safe))
}
