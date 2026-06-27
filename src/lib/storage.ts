'use client'

import { guideAttachmentTypeForMime, type GuideAttachment, type GuideAttachmentType } from '@/lib/guide-media'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav']
const ALLOWED_POST_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES]
const ALLOWED_GUIDE_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ALLOWED_GUIDE_ATTACHMENT_TYPES = [...ALLOWED_POST_MEDIA_TYPES, ...ALLOWED_GUIDE_FILE_TYPES]

export type MediaType = 'image' | 'video' | 'audio'
export type GuideUploadResult = GuideAttachment & { type: GuideAttachmentType }

export function detectMediaType(mimeType: string): MediaType | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image'
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video'
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio'
  return null
}

async function uploadTo(kind: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('kind', kind)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null
  if (!res.ok || !data?.ok || !data.url) throw new Error(data?.error || 'Upload failed')
  return data.url
}

/** Uploads to Cloudflare R2 via /api/upload (replaces Firebase Storage). */
export class StorageService {
  static validateFile(file: File, maxSizeMB = 5): { valid: boolean; error?: string } {
    if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }
    }
    return { valid: true }
  }

  static validatePostMedia(file: File, maxSizeMB = 25): { valid: boolean; error?: string } {
    if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
    if (!ALLOWED_POST_MEDIA_TYPES.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Allowed: images, video (MP4/WebM), audio (MP3/WAV/OGG)' }
    }
    return { valid: true }
  }

  static validateGuideAttachment(file: File, maxSizeMB = 25): { valid: boolean; error?: string } {
    if (file.size > maxSizeMB * 1024 * 1024) return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
    if (!ALLOWED_GUIDE_ATTACHMENT_TYPES.includes(file.type)) {
      return { valid: false, error: 'Allowed: images, video, audio, PDF, text, Markdown, Word docs' }
    }
    return { valid: true }
  }

  static async uploadProfileAvatar(_userId: string, file: File): Promise<string> {
    const v = this.validateFile(file)
    if (!v.valid) throw new Error(v.error)
    return uploadTo('avatars', file)
  }

  static async uploadProfileCover(_userId: string, file: File): Promise<string> {
    const v = this.validateFile(file, 8)
    if (!v.valid) throw new Error(v.error)
    return uploadTo('covers', file)
  }

  static async uploadPostImage(_userId: string, file: File): Promise<string> {
    const v = this.validateFile(file)
    if (!v.valid) throw new Error(v.error)
    return uploadTo('posts', file)
  }

  static async uploadPostMedia(_userId: string, file: File): Promise<{ url: string; mediaType: MediaType }> {
    const v = this.validatePostMedia(file)
    if (!v.valid) throw new Error(v.error)
    const mediaType = detectMediaType(file.type)
    if (!mediaType) throw new Error('Unsupported media type')
    const url = await uploadTo('posts', file)
    return { url, mediaType }
  }

  static async uploadGuideAttachment(_userId: string, file: File): Promise<GuideUploadResult> {
    const v = this.validateGuideAttachment(file)
    if (!v.valid) throw new Error(v.error)
    const type = guideAttachmentTypeForMime(file.type)
    if (!type) throw new Error('Unsupported attachment type')
    const url = await uploadTo('guide', file)
    return { url, type, name: file.name, mimeType: file.type }
  }

  static async uploadGroupCover(_groupId: string, file: File): Promise<string> {
    const v = this.validateFile(file)
    if (!v.valid) throw new Error(v.error)
    return uploadTo('groups', file)
  }

  static async deleteFile(url: string): Promise<void> {
    await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => undefined)
  }
}
