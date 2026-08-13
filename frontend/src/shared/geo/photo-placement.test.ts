import { describe, expect, it } from 'vitest'
import { placePhotos, type PlaceableStop } from './photo-placement'

const leh = { lng: 77.5771, lat: 34.1526 }
const nubra = { lng: 77.5619, lat: 34.6906 }

const stops: PlaceableStop[] = [
  { id: 'leh', point: leh, arrivalDate: '2026-05-01', departureDate: '2026-05-04' },
  { id: 'nubra', point: nubra, arrivalDate: '2026-05-04', departureDate: '2026-05-07' },
  // Recorded by name only — no pin, so it can never receive a photo.
  { id: 'pangong', point: null, arrivalDate: '2026-05-08', departureDate: '2026-05-09' },
]

describe('placePhotos', () => {
  it('uses the camera GPS when there is any', () => {
    const shot = { lng: 77.6, lat: 34.2 }
    expect(placePhotos([{ id: 'p1', point: shot, at: '2026-05-02T09:00:00Z' }], stops)).toEqual([
      { photoId: 'p1', point: shot, source: 'exif' },
    ])
  })

  it('prefers the camera GPS over the stop it was taken during', () => {
    // The stop is a guess about where the photographer was; the EXIF is a
    // measurement of where the camera was.
    const shot = { lng: 78.9, lat: 33.7 }
    const [placement] = placePhotos([{ id: 'p1', point: shot, at: '2026-05-02' }], stops)
    expect(placement).toEqual({ photoId: 'p1', point: shot, source: 'exif' })
  })

  it('falls back to the pinned stop whose dates contain the photo', () => {
    expect(placePhotos([{ id: 'p1', point: null, at: '2026-05-06T14:30:00Z' }], stops)).toEqual([
      { photoId: 'p1', point: nubra, source: 'stop', stopId: 'nubra' },
    ])
  })

  it('includes both ends of a stop', () => {
    const at = (iso: string) => placePhotos([{ id: 'p', point: null, at: iso }], stops)[0]
    expect(at('2026-05-01')).toMatchObject({ stopId: 'leh' })
    expect(at('2026-05-07')).toMatchObject({ stopId: 'nubra' })
  })

  it('gives a changeover day to the stop being left', () => {
    // 4 May is Leh's departure and Nubra's arrival. Either answer is defensible;
    // the point is that it is stable and that the map labels it as inferred.
    expect(placePhotos([{ id: 'p', point: null, at: '2026-05-04' }], stops)[0]).toMatchObject({
      stopId: 'leh',
    })
  })

  it('treats a single-day stop as its own range', () => {
    const oneDay: PlaceableStop[] = [
      { id: 'agra', point: leh, arrivalDate: '2026-05-01', departureDate: null },
    ]
    expect(placePhotos([{ id: 'p', point: null, at: '2026-05-01' }], oneDay)[0]).toMatchObject({
      stopId: 'agra',
    })
  })

  it('never places a photo on an unpinned stop', () => {
    // Pangong's dates match, but it has no coordinates — the photo must be
    // listed rather than drawn at a made-up point.
    expect(placePhotos([{ id: 'p', point: null, at: '2026-05-08' }], stops)).toEqual([
      { photoId: 'p', point: null, source: 'none', reason: 'no-place-for-date' },
    ])
  })

  it('states the reason when the date falls outside every stop', () => {
    expect(placePhotos([{ id: 'p', point: null, at: '2026-06-20' }], stops)).toEqual([
      { photoId: 'p', point: null, source: 'none', reason: 'no-place-for-date' },
    ])
  })

  it('states a different reason when there is no date to match on', () => {
    expect(placePhotos([{ id: 'p', point: null, at: null }], stops)).toEqual([
      { photoId: 'p', point: null, source: 'none', reason: 'no-gps-no-date' },
    ])
  })

  it('places nothing when the trip has no pinned stops at all', () => {
    const unpinned: PlaceableStop[] = [
      { id: 'x', point: null, arrivalDate: '2026-05-01', departureDate: '2026-05-09' },
    ]
    expect(placePhotos([{ id: 'p', point: null, at: '2026-05-03' }], unpinned)[0]).toMatchObject({
      source: 'none',
    })
  })

  it('keeps the caller order, so the map and the list agree', () => {
    const result = placePhotos(
      [
        { id: 'a', point: null, at: '2026-05-02' },
        { id: 'b', point: null, at: null },
        { id: 'c', point: leh, at: '2026-05-02' },
      ],
      stops
    )
    expect(result.map((r) => r.photoId)).toEqual(['a', 'b', 'c'])
  })
})
