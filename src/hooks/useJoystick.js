import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * Direction mapping (FIXED — DO NOT CHANGE):
 * 0 = centered
 * 1 = up, 2 = up-right, 3 = right, 4 = down-right,
 * 5 = down, 6 = down-left, 7 = left, 8 = up-left
 */
export function dirFromAngle(dx, dy) {
  // angle clockwise from up: atan2(dx, -dy)
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI
  ang = ((ang % 360) + 360) % 360
  const idx = Math.round(ang / 45) % 8
  return idx + 1
}

/**
 * Joystick hook using Pointer Events + pointer capture.
 * Returns refs and handlers to attach to the joystick element.
 */
export function useJoystick(onChange, deadzonePercent = 12) {
  const elRef = useRef(null)
  const pointerIdRef = useRef(null)
  const centerRef = useRef({ cx: 0, cy: 0, radius: 0 })
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 })
  const [dir, setDir] = useState(0)
  const [str, setStr] = useState(0)
  const [active, setActive] = useState(false)

  const onChangeRef = useRef(onChange)
  const deadzoneRef = useRef(deadzonePercent)
  deadzoneRef.current = deadzonePercent
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => () => {
    if (pointerIdRef.current !== null) {
      pointerIdRef.current = null
      onChangeRef.current?.(0, 0, false)
    }
  }, [])

  const computeCenter = useCallback(() => {
    if (!elRef.current) return
    const r = elRef.current.getBoundingClientRect()
    centerRef.current = {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      radius: r.width / 2,
    }
  }, [])

  const reset = useCallback(() => {
    pointerIdRef.current = null
    setKnobPos({ x: 0, y: 0 })
    setDir(0)
    setStr(0)
    setActive(false)
    if (onChangeRef.current) onChangeRef.current(0, 0, false)
  }, [])

  const update = useCallback((px, py) => {
    const { cx, cy, radius } = centerRef.current
    if (radius <= 0) return

    let dx = px - cx
    let dy = py - cy
    let dist = Math.sqrt(dx * dx + dy * dy)

    // Clamp to circle
    if (dist > radius) {
      const scale = radius / dist
      dx *= scale
      dy *= scale
      dist = radius
    }

    const deadzone = radius * Math.max(0, Math.min(30, deadzoneRef.current)) / 100

    if (dist <= deadzone) {
      setKnobPos({ x: 0, y: 0 })
      setDir(0)
      setStr(0)
      setActive(false)
      if (onChangeRef.current) onChangeRef.current(0, 0, true)
      return
    }

    // Send raw strength; the firmware rescales the configured deadzone exactly once.
    let strFrac = dist / radius
    if (strFrac > 1) strFrac = 1
    if (strFrac < 0) strFrac = 0
    const s = Math.max(1, Math.round(strFrac * 100))

    const d = dirFromAngle(dx, dy)

    setKnobPos({ x: dx, y: dy })
    setDir(d)
    setStr(s)
    setActive(true)
    if (onChangeRef.current) onChangeRef.current(d, s, true)
  }, [])

  // Pointer event handlers
  const onPointerDown = useCallback((e) => {
    if (pointerIdRef.current !== null) return
    e.preventDefault()
    pointerIdRef.current = e.pointerId
    elRef.current.setPointerCapture(e.pointerId)
    computeCenter()
    update(e.clientX, e.clientY)
  }, [computeCenter, update])

  const onPointerMove = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return
    e.preventDefault()
    update(e.clientX, e.clientY)
  }, [update])

  const onPointerUp = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return
    e.preventDefault()
    reset()
  }, [reset])

  const onPointerCancel = useCallback((e) => {
    if (e.pointerId !== pointerIdRef.current) return false
    reset()
    return true
  }, [reset])

  const onLostPointerCapture = useCallback((e) => {
    if (e.pointerId === pointerIdRef.current) {
      reset()
      return true
    }
    return false
  }, [reset])

  // Recompute center on resize / orientation change
  useEffect(() => {
    const handler = () => {
      if (pointerIdRef.current !== null) computeCenter()
    }
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [computeCenter])

  return {
    elRef,
    knobPos, dir, str, active,
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture,
    reset,
  }
}
