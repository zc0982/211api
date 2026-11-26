interface HeroLabel {
  anchor: number
  width: number
  fadeDistance: number
}

/** Fit visible labels in route order, using the closest positions to their actor centres. */
export function fitHeroLabels(
  labels: readonly HeroLabel[], gap: number,
  viewport: { left: number; right: number }, inset: number, releaseDistance: number
): (number | undefined)[] {
  let left = viewport.left + inset
  let right = viewport.right - inset
  const visible = labels.flatMap((label, index) => {
    const outside = Math.max(viewport.left - label.anchor, label.anchor - viewport.right)
    if (outside < label.fadeDistance) return [{ ...label, index }]

    // A fading label needs its full slot. Once transparent, it no longer pulls
    // the group. Ease just its edge clearance to zero over the next half cell.
    const t = Math.min(1, (outside - label.fadeDistance) / releaseDistance)
    const clearance = (label.width + gap) * (1 - t * t * (3 - 2 * t))
    if (label.anchor < viewport.left) left += clearance
    else right -= clearance
    return []
  })

  // Subtract each label's offset in a tightly packed row. The remaining
  // positions only need to be nondecreasing to keep the labels apart.
  const offsets: number[] = []
  const groups: { start: number; end: number; sum: number; min: number; max: number; position: number }[] = []
  let offset = 0
  for (const [i, { anchor, width }] of visible.entries()) {
    const min = left - offset
    const max = right - offset - width
    const sum = anchor - width / 2 - offset
    let group = { start: i, end: i, sum, min, max, position: Math.min(max, Math.max(min, sum)) }
    offsets.push(offset)
    offset += width + gap

    // When neighbouring groups would overlap, move them as one block to
    // their mean target, restricted by the viewport bounds of every member.
    while (groups.length && groups[groups.length - 1].position > group.position) {
      const previous = groups.pop()!
      const start = previous.start
      const total = previous.sum + group.sum
      const lower = Math.max(previous.min, group.min)
      const upper = Math.min(previous.max, group.max)
      const mean = total / (i - start + 1)
      group = { start, end: i, sum: total, min: lower, max: upper, position: Math.min(upper, Math.max(lower, mean)) }
    }
    groups.push(group)
  }

  const positions = Array<number | undefined>(labels.length)
  for (const group of groups) {
    for (let i = group.start; i <= group.end; i++) positions[visible[i].index] = group.position + offsets[i]
  }
  return positions
}
