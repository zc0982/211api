/**
 * Engraved dials for the three outer rings, drawn into a CanvasTexture at
 * runtime (no image assets). The texture is mapped with RingGeometry's planar
 * UVs, so the canvas is a square dial whose outer edge is the ring's outer
 * radius.
 *
 * Font: the system serif CJK stack below. The brand serif face is a subset
 * that may not contain these characters, so it is not listed first; glyphs
 * fall back per character like CSS. At hero size the marks are ~10px tall.
 */

export const DIAL_FONT = '"Songti SC", "Noto Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif'

/** 子午环：十天干 */
export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
/** 地平环：十二地支 */
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
/** 赤道环：二十八宿 */
export const LUNAR_MANSIONS = [
  '角', '亢', '氐', '房', '心', '尾', '箕',
  '斗', '牛', '女', '虚', '危', '室', '壁',
  '奎', '娄', '胃', '昴', '毕', '觜', '参',
  '井', '鬼', '柳', '星', '张', '翼', '轸'
] as const

export interface DialSpec {
  labels: readonly string[]
  /** Minor ticks around the full circle. */
  ticks: number
  /** innerRadius / outerRadius of the ring face. */
  innerFrac: number
  color: string
}

/**
 * Draws the dial onto a square canvas. Returns null when 2D canvas is not
 * available (the ring then renders without engraving).
 */
export function drawDial(spec: DialSpec, size = 1024): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const c = size / 2
  const outer = c
  const inner = c * spec.innerFrac
  const band = outer - inner
  ctx.translate(c, c)
  ctx.strokeStyle = spec.color
  ctx.fillStyle = spec.color

  // Two hairlines bounding the scale.
  ctx.globalAlpha = 0.55
  ctx.lineWidth = Math.max(1, size / 900)
  for (const r of [inner + band * 0.16, outer - band * 0.16]) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Minor ticks, every fifth one longer.
  ctx.globalAlpha = 0.7
  for (let i = 0; i < spec.ticks; i++) {
    const a = (i / spec.ticks) * Math.PI * 2
    const long = i % 5 === 0
    const r0 = outer - band * 0.16
    const r1 = r0 - band * (long ? 0.26 : 0.14)
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    ctx.stroke()
  }

  // Characters, upright towards the centre, between the ticks and inner line.
  ctx.globalAlpha = 0.95
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.round(band * 0.34)}px ${DIAL_FONT}`
  const rText = inner + band * 0.38
  spec.labels.forEach((label, i) => {
    const a = ((i + 0.5) / spec.labels.length) * Math.PI * 2
    ctx.save()
    ctx.rotate(a)
    ctx.translate(rText, 0)
    ctx.rotate(Math.PI / 2)
    ctx.fillText(label, 0, 0)
    ctx.restore()
  })
  return canvas
}
