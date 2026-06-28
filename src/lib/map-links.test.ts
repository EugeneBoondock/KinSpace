import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCareDirectionsHref, parseCareMapDestination } from './map-links'

test('care directions deep-link into the KinSpace map', () => {
  const href = buildCareDirectionsHref({
    title: 'Central Pharmacy',
    address: '12 Main Road',
    latitude: -26.2,
    longitude: 28.04,
    kind: 'pharmacy',
  })

  assert.ok(href.startsWith('/map?'))
  assert.equal(href.includes('google.com'), false)

  const params = new URLSearchParams(href.slice(href.indexOf('?') + 1))
  assert.equal(params.get('type'), 'pharmacy')
  assert.equal(params.get('destLat'), '-26.2')
  assert.equal(params.get('destLng'), '28.04')
  assert.equal(params.get('destName'), 'Central Pharmacy')
  assert.equal(params.get('destKind'), 'pharmacy')
  assert.equal(params.get('destAddress'), '12 Main Road')
})

test('care directions keep hospitals on the care map as doctor-tab destinations', () => {
  const href = buildCareDirectionsHref({
    title: 'City Hospital',
    latitude: -26.18,
    longitude: 28.01,
    kind: 'hospital',
  })
  const params = new URLSearchParams(href.slice(href.indexOf('?') + 1))
  const marker = parseCareMapDestination(params)

  assert.equal(params.get('type'), 'doctor')
  assert.deepEqual(marker, {
    id: 'care-destination--26.18000-28.01000',
    kind: 'hospital',
    title: 'City Hospital',
    subtitle: 'Care plan destination',
    description: 'Selected from your care plan',
    address: undefined,
    latitude: -26.18,
    longitude: 28.01,
    source: 'search',
    tags: ['hospital'],
  })
})

test('care map destination parsing rejects missing coordinates', () => {
  assert.equal(parseCareMapDestination(new URLSearchParams('destLat=-26.2&destName=Clinic')), null)
})
