import { BRAND } from '@/shared/brand'

/**
 * The legal pages — screen 11: `/privacy`, `/terms`, `/refunds`.
 *
 * Data rather than three hand-written JSX pages, for two reasons. One rendering
 * component means the three documents cannot drift into three different
 * typographic treatments, and a structured document can be given a contents
 * list, per-section anchors and a "last updated" date without any of that being
 * re-implemented per page.
 *
 * The copy states what the software actually does — 30 days in the trash,
 * metadata stripped on publication, exports on every plan — so each claim here
 * has something in the codebase to check it against. Where a thing is not built
 * yet, the document says so rather than describing an intention in the present
 * tense. `legal.test.ts` enforces the shape; only a reader can enforce the
 * honesty, which is why the sections are short.
 *
 * These are drafts written by the people who built the product, not by counsel.
 */

export type LegalBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  /** Set apart on the page: a limit or a caveat that a reader must not skim past. */
  | { kind: 'note'; text: string }

export interface LegalSection {
  /** Anchor and contents-list key. Unique within its document. */
  id: string
  heading: string
  blocks: LegalBlock[]
}

export type LegalDocId = 'privacy' | 'terms' | 'refunds'

export interface LegalDoc {
  id: LegalDocId
  /** Route, which is also how the footer and the cross-links address it. */
  path: string
  title: string
  /** Shorter form for the footer, where the column is narrow and "policy" adds nothing. */
  navLabel: string
  /** One sentence under the title, and the meta description. */
  summary: string
  /** ISO date this version took effect. Shown, so a silent rewrite is visible. */
  effective: string
  sections: LegalSection[]
}

const SUPPORT = BRAND.support.email
const PRIVACY = BRAND.support.privacyEmail

const privacy: LegalDoc = {
  id: 'privacy',
  path: '/privacy',
  title: 'Privacy policy',
  navLabel: 'Privacy',
  summary: `What ${BRAND.name} stores about you, why, where it lives, and how to get it back or delete it.`,
  effective: '2026-08-14',
  sections: [
    {
      id: 'short-version',
      heading: 'The short version',
      blocks: [
        {
          kind: 'p',
          text: `Everything you write here is private until you publish it, one item at a time. We do not sell your data, we do not run ads on any plan, and there are no third-party advertising or tracking scripts on this site. You can export everything you have written, on every plan including the free one, and you can delete your account and take it with you.`,
        },
        {
          kind: 'p',
          text: `The rest of this page is the detail behind those sentences. If anything below contradicts them, the detail is what we actually do and the summary is a bug — tell us at ${PRIVACY}.`,
        },
      ],
    },
    {
      id: 'what-we-collect',
      heading: 'What we collect',
      blocks: [
        { kind: 'p', text: 'Three kinds of thing, and nothing else:' },
        {
          kind: 'list',
          items: [
            'Account data — your email address, a password stored only as a hash, your username, and the display name, bio, home country and interests you choose to fill in.',
            'What you put in — trips, dates, places and their coordinates, photos and the metadata inside them, notes, blog posts, wishlist entries and the countries you mark as visited.',
            'Operational data — the timestamps on your rows, your plan and its usage counters, and the server logs our hosting produces, which include IP addresses and are kept for a short period for security and debugging.',
          ],
        },
        {
          kind: 'note',
          text: 'There is no analytics or advertising SDK on this site today. If that changes it will be announced on the changelog before it ships, and this section will name the provider.',
        },
      ],
    },
    {
      id: 'photos',
      heading: 'Photos and what is inside them',
      blocks: [
        {
          kind: 'p',
          text: 'A photo file carries more than the picture. Ours reads the capture date and, where the camera recorded it, the GPS coordinates — that is what lets the memory vault place a photo on the map of the trip. Both stay private with the photo.',
        },
        {
          kind: 'p',
          text: 'When you publish a trip or a blog post, the image a visitor downloads is a re-encoded copy with every metadata block removed — no GPS, no camera serial, no timestamp. The original is never served publicly. Publishing a photo therefore publishes the picture, not the place your camera thought you were standing.',
        },
        {
          kind: 'p',
          text: 'Your own copies stay untouched in private storage, reachable only through short-lived signed links issued to you.',
        },
      ],
    },
    {
      id: 'how-we-use-it',
      heading: 'What we use it for',
      blocks: [
        {
          kind: 'list',
          items: [
            'Running the product: showing your trips, painting your globe, counting your quota.',
            'Sending transactional email — confirming an address, resetting a password. We do not send marketing email; there is nothing to unsubscribe from.',
            'Keeping the service up and secure, which means reading logs when something breaks.',
            'Billing, once paid plans are on sale.',
          ],
        },
        {
          kind: 'p',
          text: 'We do not profile you, sell your data, share it with data brokers, or use what you write to train machine-learning models.',
        },
      ],
    },
    {
      id: 'publishing',
      heading: 'What becomes public, and only then',
      blocks: [
        {
          kind: 'p',
          text: 'Every trip, post and profile starts private. Making one public is a per-item decision, and it is reversible: a trip you pull back stops resolving, including through any share link that was created while it was open.',
        },
        {
          kind: 'p',
          text: 'An unlisted link is a secret URL, not a permission check — anyone holding it can open the item until you revoke it. Unlisted items are excluded from our sitemap and marked not to be indexed, but a link you paste somewhere public is public.',
        },
        {
          kind: 'note',
          text: 'An image attached to a blog post is stored privately and served through an address that checks the post it belongs to on every request, so it is readable by exactly the people the post is. Unpublishing a post takes its images with it, with one caveat: an address already handed out stays good for up to an hour.',
        },
      ],
    },
    {
      id: 'where-it-lives',
      heading: 'Where it lives, and who else touches it',
      blocks: [
        {
          kind: 'p',
          text: `Your rows and your files are stored with Supabase, in ${BRAND.legal.dataRegion}. Access inside the database is enforced by row-level security, which means the rules about who can read what are in the database itself rather than in application code that could forget them.`,
        },
        {
          kind: 'p',
          text: 'Our processors are: Supabase (database, authentication, file storage), our email provider for transactional messages, and our hosting provider. Each processes data only to provide that service to us. We add none for advertising.',
        },
        {
          kind: 'p',
          text: 'If you are in the EU or the UK, note that this means your data is transferred outside it, under the standard contractual clauses our processors publish.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies',
      blocks: [
        {
          kind: 'p',
          text: 'Two kinds, both first-party and both necessary: the session cookies that keep you signed in, and a small preference store for your theme. There are no advertising or analytics cookies, which is why this site has no cookie banner — there is nothing to ask you to consent to.',
        },
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      blocks: [
        {
          kind: 'list',
          items: [
            'While your account exists, what you have written stays until you delete it.',
            'A deleted trip or post goes to the trash and is restorable for 30 days. After that a daily job deletes it for good — the rows and the photographs both.',
            'Delete your account and we remove your rows and your files. Backups roll off on their own cycle, within 30 days.',
            'Server logs are kept briefly for security and debugging, then discarded.',
          ],
        },
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your rights over it',
      blocks: [
        {
          kind: 'p',
          text: 'You can see, correct, export and delete what we hold, whatever plan you are on and wherever you live — we do not think these should depend on your postcode. Under the GDPR and the UK GDPR these are your rights of access, rectification, erasure, restriction, portability and objection; under India’s DPDP Act they are your rights to access, correction, erasure and grievance redressal.',
        },
        {
          kind: 'p',
          text: `Export and deletion are buttons rather than requests: both live on your settings page and neither needs to go through us. The export is a JSON file containing every row this account owns; deleting removes those rows and the files behind them, and cannot be undone. For anything else — a correction you cannot make yourself, or a question about what we hold — write to ${PRIVACY} and we will answer within 30 days. You may also complain to your data protection authority, or in India to the Data Protection Board.`,
        },
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      blocks: [
        {
          kind: 'p',
          text: 'Passwords are hashed, never stored or logged in the clear. Traffic is encrypted in transit and data is encrypted at rest. Private files are served only through signed links that expire within the hour. Access between accounts is refused by the database rather than by the application, so a bug in a page cannot show you someone else’s trip.',
        },
        {
          kind: 'p',
          text: `No system is perfect. If you find a way to reach data that is not yours, please tell us at ${SUPPORT} before telling anyone else, and we will credit you in the changelog if you would like us to.`,
        },
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        {
          kind: 'p',
          text: `${BRAND.name} is not intended for children under 18, and we do not knowingly collect their data. If you believe a child has created an account, write to ${PRIVACY} and we will remove it.`,
        },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        {
          kind: 'p',
          text: 'The date at the top of this page is the version you are reading. A change that affects what we collect or who we share it with is announced on the changelog and, if it is material, by email before it takes effect.',
        },
      ],
    },
  ],
}

const terms: LegalDoc = {
  id: 'terms',
  path: '/terms',
  title: 'Terms of service',
  navLabel: 'Terms',
  summary: `The agreement between you and ${BRAND.name}: what we owe you, what you keep, and what happens when either of us stops.`,
  effective: '2026-08-14',
  sections: [
    {
      id: 'agreement',
      heading: 'Who this is between',
      blocks: [
        {
          kind: 'p',
          text: `These terms are between you and ${BRAND.legal.entity}, the operator of ${BRAND.name} ("we", "us"). Creating an account means you accept them. If you do not, do not create one.`,
        },
        {
          kind: 'note',
          text: `${BRAND.legal.entity} is a working name and is not yet an incorporated company. When it is, this section will name the registered entity and its address, and the change will appear on the changelog.`,
        },
      ],
    },
    {
      id: 'the-service',
      heading: 'What the service is',
      blocks: [
        {
          kind: 'p',
          text: `${BRAND.name} is a place to record trips you have taken and plan ones you have not: a globe and maps that fill in, a vault for photos and notes, a blog editor, and pages you can publish.`,
        },
        {
          kind: 'p',
          text: 'It is early software and says so on every page of its changelog. Features move, and screens listed as planned may change or not arrive. Nothing here is a commitment to ship a specific feature by a specific date.',
        },
      ],
    },
    {
      id: 'account',
      heading: 'Your account',
      blocks: [
        {
          kind: 'list',
          items: [
            'You must be 18 or older and give a real email address you control.',
            'You are responsible for your password and for what happens under your account. Tell us promptly if you think someone else has it.',
            'One person per account. You may not share credentials; collaboration on a trip, when it ships, will be its own feature.',
          ],
        },
      ],
    },
    {
      id: 'your-content',
      heading: 'What you write stays yours',
      blocks: [
        {
          kind: 'p',
          text: 'You own your trips, photos, posts and everything else you put in. We claim no ownership of it.',
        },
        {
          kind: 'p',
          text: 'You give us the narrow permission we need to run the service: to store your content, to process it (resize an image, strip its metadata, build a map from its coordinates), to back it up, and to display it to exactly the people you have published it to. That permission covers nothing else — not marketing, not training models, not showing your photos to anyone you have not shared them with — and it ends when you delete the content or your account.',
        },
        {
          kind: 'p',
          text: 'Publishing something publicly means visitors and search engines can read it for as long as it is published. Unpublishing stops us serving it; it cannot recall a copy somebody already made.',
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'What you may not do with it',
      blocks: [
        { kind: 'p', text: 'Do not use the service to:' },
        {
          kind: 'list',
          items: [
            'Upload content you have no right to publish, or that infringes someone else’s copyright.',
            'Publish anything unlawful, or material sexualising minors, which we report rather than merely remove.',
            'Harass, impersonate or expose another person, including by publishing their location or photographs without their agreement.',
            'Attack the service: automated scraping at scale, attempts to reach other accounts’ data, or anything designed to degrade it for others.',
            'Resell the service, or work around plan limits by spreading one person’s use across several accounts.',
          ],
        },
        {
          kind: 'p',
          text: 'Security research is welcome under the terms in the privacy policy — tell us what you found before you tell anyone else, and do not take other people’s data while you look.',
        },
      ],
    },
    {
      id: 'plans',
      heading: 'Plans, limits and payment',
      blocks: [
        {
          kind: 'p',
          text: 'The free plan is free, with no trial clock. Paid plans lift the limits published on the pricing page, which is generated from the same figures the software enforces — so what that page says is what your account will actually allow.',
        },
        {
          kind: 'p',
          text: 'When paid plans go on sale, subscriptions renew automatically for the period you chose until you cancel, and prices may change with at least 30 days’ notice before your next renewal. Refunds are covered by the refund policy, which forms part of these terms.',
        },
        {
          kind: 'note',
          text: 'Paid plans are not on sale yet, so nothing can be charged today. Every account is on the free plan.',
        },
        {
          kind: 'p',
          text: 'Dropping to a smaller plan returns you to that plan’s limits. It never deletes what you have already written; content above the new limit becomes read-only rather than being destroyed.',
        },
      ],
    },
    {
      id: 'availability',
      heading: 'Availability',
      blocks: [
        {
          kind: 'p',
          text: 'We aim to keep the service up and to keep your data safe, but we offer no uptime guarantee and the service is provided "as is", without warranties beyond those your local law gives you and we cannot exclude.',
        },
        {
          kind: 'p',
          text: 'Keep your own copies of anything you could not bear to lose. Export is on every plan for exactly that reason.',
        },
      ],
    },
    {
      id: 'ending',
      heading: 'Ending it',
      blocks: [
        {
          kind: 'p',
          text: 'You may stop at any time: delete your account and we delete your data on the schedule in the privacy policy.',
        },
        {
          kind: 'p',
          text: 'We may suspend or close an account that breaks the acceptable-use section, or that we are legally required to close. Except where the breach makes it impossible — illegal content, or a legal order — we will tell you why and give you a chance to export first.',
        },
        {
          kind: 'p',
          text: 'If we ever shut the service down, we will give at least 60 days’ notice and keep export working until the last day.',
        },
      ],
    },
    {
      id: 'liability',
      heading: 'Liability',
      blocks: [
        {
          kind: 'p',
          text: 'To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability in any 12-month period is limited to what you paid us in that period — which, on the free plan, is nothing.',
        },
        {
          kind: 'p',
          text: 'Nothing here limits liability that cannot be limited, including for death, personal injury or fraud.',
        },
      ],
    },
    {
      id: 'law',
      heading: 'Governing law',
      blocks: [
        {
          kind: 'p',
          text: `These terms are governed by the laws of ${BRAND.legal.jurisdiction}, and disputes go to ${BRAND.legal.courts}. If you are a consumer elsewhere, this does not take away the protection of your own country’s mandatory consumer law.`,
        },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes',
      blocks: [
        {
          kind: 'p',
          text: `We may update these terms. Material changes are announced on the changelog and, where they affect what you pay or what you may do, by email before they take effect. The date at the top is the version in force. Questions go to ${SUPPORT}.`,
        },
      ],
    },
  ],
}

const refunds: LegalDoc = {
  id: 'refunds',
  path: '/refunds',
  title: 'Refund policy',
  navLabel: 'Refunds',
  summary: 'When you get your money back, how to ask, and what happens to your trips afterwards.',
  effective: '2026-08-14',
  sections: [
    {
      id: 'not-yet-selling',
      heading: 'Nothing is on sale yet',
      blocks: [
        {
          kind: 'note',
          text: 'Paid plans are not purchasable today. This policy is published in advance so that the rules exist before the first payment does, rather than being written after the first dispute.',
        },
      ],
    },
    {
      id: 'free-first',
      heading: 'The free plan is the trial',
      blocks: [
        {
          kind: 'p',
          text: 'There is no trial clock, because there does not need to be one. The free plan keeps working forever: a globe that fills in at country level, state-level India, unlimited writing, and export. Log a trip or two on it and you will know whether the paid limits are worth anything to you before you pay for them.',
        },
      ],
    },
    {
      id: 'refund-window',
      heading: 'The refund window',
      blocks: [
        {
          kind: 'list',
          items: [
            'First payment on a plan: a full refund if you ask within 14 days, for any reason, whether or not you used it.',
            'A renewal you did not intend: a full refund if you ask within 7 days of the charge and have not used the account since it renewed.',
            'Beyond those windows we do not refund unused time — cancel instead, and the plan runs to the end of the period you already paid for.',
            'If the service is broken in a way that stops you using what you paid for, tell us. We will refund whether or not a window has passed.',
          ],
        },
      ],
    },
    {
      id: 'how-to-ask',
      heading: 'How to ask',
      blocks: [
        {
          kind: 'p',
          text: `Write to ${SUPPORT} from the address on the account. You do not have to give a reason, and we will not put you through a retention script. We reply within 3 working days, and an approved refund goes back to the original payment method — usually within 5 to 10 working days, depending on your bank rather than on us.`,
        },
      ],
    },
    {
      id: 'cancelling',
      heading: 'Cancelling, and what happens to your trips',
      blocks: [
        {
          kind: 'p',
          text: 'Cancelling stops the next renewal. Your plan keeps its limits until the period you paid for runs out, and then the account returns to the free plan.',
        },
        {
          kind: 'p',
          text: 'Returning to free never deletes anything. Content over the free limits becomes read-only — still there, still yours, still exportable — and starts working again the moment you are back over the line. A refund is a refund of money, not a deletion of your account.',
        },
      ],
    },
    {
      id: 'exceptions',
      heading: 'Exceptions',
      blocks: [
        {
          kind: 'p',
          text: 'We may refuse a refund where an account is being closed for breaking the acceptable-use section of the terms, or where the same account has repeatedly bought and refunded the same plan. Nothing in this policy takes away a statutory right to a refund that your local consumer law gives you.',
        },
      ],
    },
  ],
}

/** Every legal document, in the order the footer lists them. */
export const LEGAL_DOCS: LegalDoc[] = [privacy, terms, refunds]

export function getLegalDoc(id: LegalDocId): LegalDoc {
  const doc = LEGAL_DOCS.find((d) => d.id === id)
  // Unreachable through the typed id, but a thrown error beats a page that
  // renders an empty document if one is ever removed from the array.
  if (!doc) throw new Error(`Unknown legal document: ${id}`)
  return doc
}

/** The other two, for the "see also" row at the foot of each document. */
export function relatedLegalDocs(id: LegalDocId): LegalDoc[] {
  return LEGAL_DOCS.filter((d) => d.id !== id)
}
