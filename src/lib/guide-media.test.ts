import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatGuideMessageContent,
  normaliseGuideAttachments,
  parseGuideMessageContent,
  toGuideModelMessageContent,
} from './guide-media'

test('normaliseGuideAttachments keeps only safe Guide attachments', () => {
  const attachments = normaliseGuideAttachments([
    { type: 'image', url: '/api/media/guide/user-1/photo.png', name: '  symptoms photo.png  ', mimeType: 'image/png' },
    { type: 'video', url: 'javascript:alert(1)', name: 'bad.mp4' },
    { type: 'unknown', url: '/api/media/guide/user-1/bad.bin', name: 'bad.bin' },
    { type: 'file', url: 'https://www.kinspace.co.za/api/media/guide/user-1/notes.pdf', name: 'visit notes.pdf' },
  ])

  assert.equal(attachments.length, 2)
  assert.equal(attachments[0]?.type, 'image')
  assert.equal(attachments[0]?.name, 'symptoms photo.png')
  assert.equal(attachments[1]?.type, 'file')
})

test('normaliseGuideAttachments keeps external media as links', () => {
  const attachments = normaliseGuideAttachments([
    { type: 'image', url: 'https://example.com/tracker.png', name: 'Outside image' },
    { type: 'video', url: 'https://example.com/video.mp4', name: 'Outside video' },
    { type: 'audio', url: 'https://example.com/audio.mp3', name: 'Outside audio' },
    { type: 'image', url: 'https://www.kinspace.co.za/api/media/guide/user-1/photo.png', name: 'KinSpace image' },
  ])

  assert.equal(attachments.length, 4)
  assert.deepEqual(
    attachments.map((attachment) => attachment.type),
    ['link', 'link', 'link', 'image'],
  )
})

test('Guide message content stores media out of the visible text', () => {
  const content = formatGuideMessageContent('Here is what I mean.', [
    { type: 'image', url: '/api/media/guide/user-1/photo.png', name: 'photo.png' },
  ])
  const parsed = parseGuideMessageContent(content)

  assert.equal(parsed.text, 'Here is what I mean.')
  assert.equal(parsed.attachments.length, 1)
  assert.equal(parsed.attachments[0]?.url, '/api/media/guide/user-1/photo.png')
})

test('model text describes attachments without exposing internal markers', () => {
  const content = formatGuideMessageContent('Can you look at this?', [
    { type: 'image', url: '/api/media/guide/user-1/photo.png', name: 'photo.png' },
    { type: 'link', url: 'https://www.kinspace.co.za/resources/rest', name: 'rest article' },
  ])
  const modelContent = toGuideModelMessageContent(content)

  assert.match(modelContent, /Attached image: photo\.png/)
  assert.match(modelContent, /Attached link: rest article/)
  assert.doesNotMatch(modelContent, /\[\[kinspace-guide-attachments\]\]/)
})
