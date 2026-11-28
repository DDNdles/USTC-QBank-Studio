import { useEffect, useState } from 'react'

/**
 * Optical Liquid Glass Refraction Engine
 *
 * Implements physically-based 2D displacement maps following Snell's Law
 * (n1 = 1.00 air -> n2 = 1.50 borosilicate glass) over a C-continuous
 * Convex Squircle bezel profile f(x) = (1 - (1 - x)^4)^(1/4):
 *   - Flat optical center plateau (zero distortion for crisp text legibility)
 *   - Smoothly curved outer bezel bending background rays inward via SDF normals
 *   - Cauchy chromatic dispersion (n_R < n_G < n_B) split cleanly across RGB
 *     channels and alpha-locked to SourceGraphic via feComposite(in)
 *   - Strict sRGB filter color space to avoid linearRGB neutral-gray ghosting
 */

interface RefractionMaps {
  header: string
  pill: string
  orb: string
  sheet: string
}

const IOR_AIR = 1.0
const IOR_GLASS = 1.5

/**
 * Convex Squircle surface height profile:
 *   f(x) = (1 - (1 - x)^4)^(1/4), x in [0, 1]
 *   x = 0 at outer glass rim, x = 1 at flat interior plateau.
 */
function convexSquircleHeight(x: number): number {
  const t = Math.max(0, Math.min(1, x))
  const inv = 1 - t
  return Math.pow(Math.max(0, 1 - inv * inv * inv * inv), 0.25)
}

/**
 * Computes lateral ray deflection Delta(x) by Snell's Law for an orthogonal
 * viewing ray entering a curved glass slab of base thickness T + bezel height.
 */
function buildSnellLookup(samples: number, slabThickness: number): Float32Array {
  const table = new Float32Array(samples)
  const eps = 1e-4

  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1)
    if (x >= 0.995) {
      table[i] = 0
      continue
    }
    const x0 = Math.max(0.002, x)
    const x1 = Math.min(1, x0 + eps)
    const h = convexSquircleHeight(x0)
    const slope = (convexSquircleHeight(x1) - h) / Math.max(eps, x1 - x0)

    // Angle of incidence relative to local surface normal
    const theta1 = Math.atan(slope)
    const sinTheta2 = Math.min(0.999, (IOR_AIR / IOR_GLASS) * Math.sin(theta1))
    const theta2 = Math.asin(sinTheta2)

    // Lateral ray shift through optical thickness (T + h)
    // Softly damp extreme grazing singularity near x -> 0 for clean rasterization
    const edgeSoft = Math.min(1, x0 / 0.06)
    const deflection = (slabThickness + h) * Math.tan(Math.max(0, theta1 - theta2)) * edgeSoft
    table[i] = deflection
  }

  // Normalize to [0, 1] so SVG feDisplacementMap `scale` controls pixel shift directly
  let maxVal = 0
  for (let i = 0; i < samples; i++) {
    if (table[i] > maxVal) maxVal = table[i]
  }
  if (maxVal > 1e-6) {
    for (let i = 0; i < samples; i++) {
      table[i] /= maxVal
    }
  }
  return table
}

function sampleLookup(table: Float32Array, x: number): number {
  if (x <= 0) return table[0]
  if (x >= 1) return 0
  const idx = x * (table.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(table.length - 1, lo + 1)
  const frac = idx - lo
  return table[lo] * (1 - frac) + table[hi] * frac
}

/**
 * 2D Rounded-Rectangle Signed Distance Field centered at origin.
 * Negative inside the shape, zero on perimeter.
 */
function roundedBoxSdf(px: number, py: number, halfW: number, halfH: number, radius: number): number {
  const bx = Math.max(0, halfW - radius)
  const by = Math.max(0, halfH - radius)
  const qx = Math.abs(px) - bx
  const qy = Math.abs(py) - by
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside - radius
}

function generateRoundedRectMap(
  width: number,
  height: number,
  radius: number,
  bezelWidth: number,
  slabThickness: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const img = ctx.createImageData(width, height)
  const data = img.data
  const lut = buildSnellLookup(256, slabThickness)
  const halfW = width / 2
  const halfH = height / 2
  const eps = 0.75

  for (let y = 0; y < height; y++) {
    const py = y + 0.5 - halfH
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - halfW
      const sdf = roundedBoxSdf(px, py, halfW, halfH, radius)
      const distInward = -sdf

      let vx = 0
      let vy = 0

      if (distInward > 0 && distInward < bezelWidth) {
        const u = distInward / bezelWidth
        const mag = sampleLookup(lut, u)

        // Central-difference outward unit normal of SDF
        const gx =
          roundedBoxSdf(px + eps, py, halfW, halfH, radius) -
          roundedBoxSdf(px - eps, py, halfW, halfH, radius)
        const gy =
          roundedBoxSdf(px, py + eps, halfW, halfH, radius) -
          roundedBoxSdf(px, py - eps, halfW, halfH, radius)
        const glen = Math.hypot(gx, gy)

        if (glen > 1e-5) {
          // Refracted ray bends inward (-normal) into denser glass medium
          vx = -(gx / glen) * mag
          vy = -(gy / glen) * mag
        }
      }

      const off = (y * width + x) * 4
      data[off] = Math.max(0, Math.min(255, Math.round(128 + vx * 127)))
      data[off + 1] = Math.max(0, Math.min(255, Math.round(128 + vy * 127)))
      data[off + 2] = 128
      data[off + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Generates a vertical optical bezel displacement map for the sticky top header:
 *   - Upper reading strip remains flat (zero warp on nav text)
 *   - Lower optical bevel curves downward so scrolled headlines & artwork refract
 *     gently as they glide beneath the bottom lip of the frosted bar
 */
function generateHeaderBevelMap(width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const img = ctx.createImageData(width, height)
  const data = img.data
  const lut = buildSnellLookup(256, 1.35)

  for (let y = 0; y < height; y++) {
    const ny = (y + 0.5) / height // 0 = top, 1 = bottom edge
    let vy = 0

    // Bottom optical bevel occupies the lower 36% of the header height
    if (ny > 0.64) {
      const distFromBottom = (1 - ny) / 0.36 // 0 at bottom rim, 1 at interior plateau
      const mag = sampleLookup(lut, distFromBottom)
      // Outward normal at bottom edge points +y -> inward refraction bends -y
      vy = -mag
    } else if (ny < 0.14) {
      // Subtle top edge rim catch
      const distFromTop = ny / 0.14
      vy = sampleLookup(lut, distFromTop) * 0.25
    }

    const gVal = Math.max(0, Math.min(255, Math.round(128 + vy * 127)))
    for (let x = 0; x < width; x++) {
      // Faint horizontal meniscus taper near viewport edges
      const nx = (x + 0.5) / width
      let vx = 0
      if (nx < 0.04) {
        vx = sampleLookup(lut, nx / 0.04) * 0.22
      } else if (nx > 0.96) {
        vx = -sampleLookup(lut, (1 - nx) / 0.04) * 0.22
      }
      const rVal = Math.max(0, Math.min(255, Math.round(128 + vx * 127)))
      const off = (y * width + x) * 4
      data[off] = rVal
      data[off + 1] = gVal
      data[off + 2] = 128
      data[off + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function supportsBackdropSvgRefraction(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) return false
  const ua = navigator.userAgent
  // Blink/Chromium desktop & Android natively support backdrop-filter: url(#svg-filter).
  // WebKit (Safari & iOS CriOS/FxiOS) and Gecko (Firefox) reject the entire backdrop-filter
  // value if url(#...) is present, so they stay on the rich multi-layer CSS fallback.
  const isBlink = /Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua) && !/Firefox\/|FxiOS\/|CriOS\//.test(ua)
  return isBlink
}

export function OpticalGlassDefs() {
  const [maps, setMaps] = useState<RefractionMaps | null>(null)

  useEffect(() => {
    const enabled = supportsBackdropSvgRefraction()
    if (!enabled) return

    const generated: RefractionMaps = {
      header: generateHeaderBevelMap(128, 72),
      pill: generateRoundedRectMap(192, 64, 32, 16, 1.4),
      orb: generateRoundedRectMap(96, 96, 48, 22, 1.6),
      sheet: generateRoundedRectMap(180, 140, 22, 14, 1.15),
    }
    setMaps(generated)
    document.documentElement.classList.add('optical-refraction')

    return () => {
      document.documentElement.classList.remove('optical-refraction')
    }
  }, [])

  if (!maps) return null

  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* 1. Sticky Header Optical Lip Refraction + Subtle Cauchy Dispersion */}
        <filter
          id="optical-glass-header"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={maps.header}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="dispMap"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="15"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispR"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanR"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="17.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispG"
          />
          <feColorMatrix
            in="dispG"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanG"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="20.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispB"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanR" in2="chanG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chanB" mode="screen" result="rgb" />
          <feComposite in="rgb" in2="SourceGraphic" operator="in" />
        </filter>

        {/* 2. Capsule / Dock / Pill Convex Squircle Refraction + Cauchy Dispersion */}
        <filter
          id="optical-glass-pill"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={maps.pill}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="dispMap"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="21"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispR"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanR"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="24.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispG"
          />
          <feColorMatrix
            in="dispG"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanG"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="28.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispB"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanR" in2="chanG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chanB" mode="screen" result="rgb" />
          <feComposite in="rgb" in2="SourceGraphic" operator="in" />
        </filter>

        {/* 3. Spherical Convex Dome Lens for Circular Optical Buttons */}
        <filter
          id="optical-glass-orb"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={maps.orb}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="dispMap"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="14"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispR"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanR"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="16.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispG"
          />
          <feColorMatrix
            in="dispG"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanG"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="19"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispB"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanR" in2="chanG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chanB" mode="screen" result="rgb" />
          <feComposite in="rgb" in2="SourceGraphic" operator="in" />
        </filter>

        {/* 4. Wide Architectural Glass Slab (Modals, Command Palette, Drawers) */}
        <filter
          id="optical-glass-sheet"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            href={maps.sheet}
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="dispMap"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="13.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispR"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanR"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="16"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispG"
          />
          <feColorMatrix
            in="dispG"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="chanG"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMap"
            scale="18.8"
            xChannelSelector="R"
            yChannelSelector="G"
            result="dispB"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="chanB"
          />
          <feBlend in="chanR" in2="chanG" mode="screen" result="rg" />
          <feBlend in="rg" in2="chanB" mode="screen" result="rgb" />
          <feComposite in="rgb" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}
