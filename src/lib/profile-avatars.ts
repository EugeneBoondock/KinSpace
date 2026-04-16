export type PlatformAvatarOption = {
  id: string
  label: string
  src: string
}

export type AvatarSeedInput = {
  avatar_url?: string | null
  email?: string | null
  full_name?: string | null
  id?: string | null
  userId?: string | null
  username?: string | null
}

export const platformAvatarOptions: PlatformAvatarOption[] = [
  { id: 'bloom', label: 'Bloom', src: '/images/profile-icons/kinspace-bloom.svg' },
  { id: 'harbor', label: 'Harbor', src: '/images/profile-icons/kinspace-harbor.svg' },
  { id: 'lantern', label: 'Lantern', src: '/images/profile-icons/kinspace-lantern.svg' },
  { id: 'leaf', label: 'Leaf', src: '/images/profile-icons/kinspace-leaf.svg' },
  { id: 'orbit', label: 'Orbit', src: '/images/profile-icons/kinspace-orbit.svg' },
  { id: 'compass', label: 'Compass', src: '/images/profile-icons/kinspace-compass.svg' },
]

function hashSeed(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }

  return hash
}

export function isPlatformAvatarUrl(value?: string | null) {
  return Boolean(
    value && platformAvatarOptions.some((option) => option.src === value),
  )
}

export function getPlatformAvatarForSeed(seed?: string | null) {
  const normalized = seed?.trim().toLowerCase()

  if (!normalized) {
    return platformAvatarOptions[0]
  }

  return platformAvatarOptions[hashSeed(normalized) % platformAvatarOptions.length]
}

export function resolveAvatarUrl(profile?: AvatarSeedInput | null) {
  const customAvatar = profile?.avatar_url?.trim()

  if (customAvatar) {
    return customAvatar
  }

  const seed =
    profile?.userId ||
    profile?.id ||
    profile?.username ||
    profile?.full_name ||
    profile?.email ||
    null

  return getPlatformAvatarForSeed(seed).src
}
