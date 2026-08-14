'use client'

import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'
import { DURATION, EASE_OUT, REVEAL_DISTANCE, STAGGER_STEP } from '@/shared/motion'
import { cn } from '@/shared/utils'

/**
 * The one entrance animation the marketing pages use.
 *
 * A section rises a few pixels and fades as it comes into view, once. Not
 * decoration for its own sake: a long page of prose gives no clue where one
 * argument ends and the next begins, and arrival does that work better than
 * another horizontal rule.
 *
 * Three rules hold it together:
 *
 *  - **Once.** `viewport.once` means scrolling back up does not replay anything.
 *    An element that re-animates every time it passes the fold is a page that
 *    will not sit still.
 *  - **Reduced motion is obeyed**, by `MotionConfig reducedMotion="user"` in
 *    `providers.tsx` — the movement is dropped and the fade is kept, for
 *    everyone whose system asks for it. Nothing here needs to check.
 *  - **It never hides content permanently.** These render with `opacity: 0` in
 *    the server HTML, so the root layout carries a `<noscript>` rule that pins
 *    every `[data-reveal]` back to visible. A visitor without JavaScript reads
 *    the page; they just read it without the animation.
 */

const revealVariants: Variants = {
  hidden: { opacity: 0, y: REVEAL_DISTANCE },
  shown: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
}

/** How much of the element must be on screen before it plays. */
const VIEWPORT = { once: true, amount: 0.25 } as const

/**
 * `HTMLMotionProps` rather than `React.ComponentProps<'div'>` throughout: a
 * motion component redefines `onDrag` and friends, so the plain DOM props type
 * is not assignable to it.
 */
interface RevealProps extends HTMLMotionProps<'div'> {
  /** Seconds to wait before playing. Use `RevealGroup` instead of hand-tuning a list. */
  delay?: number
}

export function Reveal({ delay = 0, className, children, ...props }: RevealProps) {
  return (
    <motion.div
      data-reveal
      className={cn(className)}
      variants={revealVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      transition={{ duration: DURATION.base, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * Plays its `RevealItem` children one after another as the group comes into view.
 *
 * The stagger lives on the parent rather than as a delay on each child, so a
 * grid does not need to know its own indices and a card added in the middle
 * needs no renumbering.
 */
export function RevealGroup({
  as = 'div',
  step = STAGGER_STEP,
  className,
  children,
  ...props
}: HTMLMotionProps<'div'> & { as?: 'div' | 'ul'; step?: number }) {
  // A grid of cards is usually a `<ul>`, and wrapping one in a `<div>` to
  // animate it would put a non-`<li>` between the list and its items. The two
  // motion components differ only in the element they render, so the cast is
  // over an element type the caller has already chosen.
  const Tag = (as === 'ul' ? motion.ul : motion.div) as typeof motion.div

  return (
    <Tag
      data-reveal
      className={cn(className)}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: step } },
      }}
      {...props}
    >
      {children}
    </Tag>
  )
}

/**
 * One member of a `RevealGroup`.
 *
 * Renders a `<li>` when asked, because a group of cards is usually a list and
 * wrapping each `<li>` in a `<div>` would break that.
 */
export function RevealItem({
  as = 'div',
  className,
  children,
  ...props
}: HTMLMotionProps<'div'> & { as?: 'div' | 'li' }) {
  const Tag = (as === 'li' ? motion.li : motion.div) as typeof motion.div
  return (
    <Tag data-reveal className={cn(className)} variants={revealVariants} {...props}>
      {children}
    </Tag>
  )
}
