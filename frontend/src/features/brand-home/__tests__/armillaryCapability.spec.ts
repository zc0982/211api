import { describe, expect, it } from 'vitest'
import { isSlowFrames, staticReasonBeforeLoad, type DeviceProbe } from '../armillary/capability'
import { ARMILLARY_WEBGL } from '../config'

const capable: DeviceProbe = { reducedMotion: false, webgl: true, cores: 8, memoryGB: 8, viewportWidth: 1440 }

describe('armillary capability gates', () => {
  it('loads WebGL on a capable desktop', () => {
    expect(staticReasonBeforeLoad(capable)).toBeNull()
  })

  it('stays static for reduced motion before anything else', () => {
    expect(staticReasonBeforeLoad({ ...capable, reducedMotion: true, webgl: false })).toBe('reduced-motion')
  })

  it('stays static without WebGL', () => {
    expect(staticReasonBeforeLoad({ ...capable, webgl: false })).toBe('no-webgl')
  })

  it('treats ≤ 4 cores or ≤ 4 GB as low-end', () => {
    expect(ARMILLARY_WEBGL.maxLowEndCores).toBe(4)
    expect(ARMILLARY_WEBGL.maxLowEndMemoryGB).toBe(4)
    expect(staticReasonBeforeLoad({ ...capable, cores: 4 })).toBe('low-cores')
    expect(staticReasonBeforeLoad({ ...capable, cores: 6 })).toBeNull()
    expect(staticReasonBeforeLoad({ ...capable, memoryGB: 4 })).toBe('low-memory')
    expect(staticReasonBeforeLoad({ ...capable, memoryGB: 2 })).toBe('low-memory')
    expect(staticReasonBeforeLoad({ ...capable, memoryGB: 8 })).toBeNull()
  })

  it('ignores signals the browser does not expose', () => {
    expect(staticReasonBeforeLoad({ ...capable, cores: undefined, memoryGB: undefined })).toBeNull()
    expect(staticReasonBeforeLoad({ ...capable, cores: 0 })).toBeNull()
  })

  it('applies the narrow-screen gate only when it is switched off', () => {
    const narrow = { ...capable, viewportWidth: 390 }
    expect(staticReasonBeforeLoad(narrow, { ...ARMILLARY_WEBGL, enableOnNarrow: true })).toBeNull()
    expect(staticReasonBeforeLoad(narrow, { ...ARMILLARY_WEBGL, enableOnNarrow: false })).toBe('narrow')
    expect(staticReasonBeforeLoad({ ...capable, viewportWidth: 860 }, { ...ARMILLARY_WEBGL, enableOnNarrow: false })).toBeNull()
  })

  it('flags an average frame time above 32ms over the probe', () => {
    expect(ARMILLARY_WEBGL.maxAvgFrameMs).toBe(32)
    expect(ARMILLARY_WEBGL.probeFrames).toBe(60)
    expect(isSlowFrames(new Array(60).fill(16.7))).toBe(false)
    expect(isSlowFrames(new Array(60).fill(32))).toBe(false)
    expect(isSlowFrames(new Array(60).fill(33.4))).toBe(true)
    expect(isSlowFrames([...new Array(30).fill(16), ...new Array(30).fill(60)])).toBe(true)
    expect(isSlowFrames([])).toBe(false)
  })
})
