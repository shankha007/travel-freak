import { BRAND } from '@/shared/brand'
import { OG_COLORS, OG_SIZE, truncate, OG_TITLE_MAX, OG_SUBTITLE_MAX } from '@/shared/og'
import type { WorldPaths } from '@/server/og/world'

/**
 * The one layout every share card uses — screen 38.
 *
 * Not a React component in the usual sense: this is rendered by Satori, inside
 * `ImageResponse`, which supports flexbox and a subset of CSS and no cascade at
 * all. Hence every style inline, every container an explicit `display: flex`,
 * and no class names anywhere. Satori also throws on a `div` with more than one
 * child and no display set, which is why that property appears on things that
 * would not need it in a browser.
 *
 * Four cards share it — the site, a trip, a post and a profile — because a
 * share card's job is to be recognised in a feed at thumbnail size, and four
 * different layouts would be four things to recognise.
 */

export interface CardProps {
  /** Small word above the headline: "Trip", "Travel resume". */
  eyebrow: string
  title: string
  /** One line of facts under the title. Omitted entirely when empty. */
  subtitle?: string
  /** The map, when the card has one. */
  world?: WorldPaths
  /** Shown bottom-right, e.g. the public URL this card belongs to. */
  footnote?: string
}

/** The map sits behind everything, cropped to the top three-quarters of the card. */
const MAP = { width: OG_SIZE.width, height: 560 }

export function Card({ eyebrow, title, subtitle, world, footnote }: CardProps) {
  const hasMap = Boolean(world && (world.base || world.highlighted))

  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        background: OG_COLORS.background,
        color: OG_COLORS.ink,
        fontFamily: 'sans-serif',
      }}
    >
      {hasMap && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            display: 'flex',
            // Low enough that the headline stays the thing you read first. The
            // map is there to say "travel" at a glance, not to be studied.
            opacity: 0.55,
          }}
        >
          <svg width={MAP.width} height={MAP.height} viewBox={`0 0 ${MAP.width} ${MAP.height}`}>
            <path d={world?.base} fill={OG_COLORS.land} />
            <path d={world?.highlighted} fill={OG_COLORS.accent} />
          </svg>
        </div>
      )}

      {/* Everything below the map sits on a gradient, so the text has something
          to be legible against wherever the continents happen to fall. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background: `linear-gradient(160deg, ${OG_COLORS.background}f2 0%, ${OG_COLORS.background}99 45%, ${OG_COLORS.background}fa 100%)`,
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '48px 64px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 14,
              background: OG_COLORS.accent,
              marginRight: 14,
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>{BRAND.name}</div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 22,
            color: OG_COLORS.accent,
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {eyebrow}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          padding: '0 64px 56px',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          {truncate(title, OG_TITLE_MAX)}
        </div>

        {subtitle ? (
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              fontSize: 28,
              color: OG_COLORS.muted,
              maxWidth: 940,
            }}
          >
            {truncate(subtitle, OG_SUBTITLE_MAX)}
          </div>
        ) : null}

        {footnote ? (
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 22,
              color: OG_COLORS.muted,
            }}
          >
            {footnote}
          </div>
        ) : null}
      </div>
    </div>
  )
}
