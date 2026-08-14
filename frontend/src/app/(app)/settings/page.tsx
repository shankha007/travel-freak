import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Download, Undo2, UserRound } from 'lucide-react'
import { getSettings } from '@/server/queries/settings'
import { BRAND } from '@/shared/brand'
import { ProfileForm } from '@/client/components/settings/profile-form'
import { PrivacyForm } from '@/client/components/settings/privacy-form'
import { DeleteAccount } from '@/client/components/settings/delete-account'
import { ChangeEmailForm, ChangePasswordForm } from '@/client/components/settings/security-forms'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'

/**
 * Settings — screens 39, 40 and 41 on one route.
 *
 * One page with anchored sections rather than tabs: there are three of them,
 * they are short, and a tab is a place for a setting to hide. The contents list
 * down the side is the same pattern the legal pages use, for the same reason —
 * people arrive here with one specific thing they want to change.
 *
 * What is deliberately not here is stated at the bottom rather than omitted:
 * export and account deletion are screen 44 and are done by hand today, which
 * is exactly what the privacy policy already promises. A settings screen that
 * quietly lacks a delete button reads as a product that does not want you to
 * find one.
 */

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your profile, your privacy and your account.',
}

export const dynamic = 'force-dynamic'

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'account', label: 'Account & security' },
  { id: 'your-data', label: 'Your data' },
]

export default async function SettingsPage() {
  const settings = await getSettings()

  const memberSince = new Date(settings.memberSince).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Who you are here, who else can see it, and how you sign in.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="order-2 max-w-2xl space-y-6 lg:order-1">
          <Section id="profile" title="Profile" description="What your public profile says.">
            <ProfileForm settings={settings} />
          </Section>

          <Section
            id="privacy"
            title="Privacy"
            description="What leaves this account, and what a new trip starts as."
          >
            <PrivacyForm settings={settings} />
          </Section>

          <Section
            id="account"
            title="Account & security"
            description="How you sign in."
            aside={
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="size-4" aria-hidden />
                <span>Member since {memberSince}</span>
                <Badge variant="outline">{settings.planName}</Badge>
              </div>
            }
          >
            <div className="space-y-8">
              <ChangeEmailForm email={settings.email} pendingEmail={settings.pendingEmail} />
              <div className="border-t pt-8">
                <ChangePasswordForm />
              </div>
            </div>
          </Section>

          <Section
            id="your-data"
            title="Your data"
            description="Everything you have written is yours, and leaving is not a punishment."
          >
            <div className="space-y-6 text-sm text-muted-foreground">
              <div className="space-y-2">
                <p className="font-medium text-foreground">Export everything</p>
                <p>
                  A complete copy of your trips, places, photo details, notes, posts, wishlist and
                  globe, as JSON. On every plan including the free one — a right to your own data is
                  not something this product sells you back. The photographs themselves are files
                  rather than rows, so the export lists them and says where each one lives without
                  carrying the bytes; the file says so too.
                </p>
                <Button variant="outline" nativeButton={false} render={<a href="/api/export" />}>
                  <Download className="size-4" aria-hidden />
                  Download my data
                </Button>
              </div>

              <div className="flex gap-3 border-t pt-5">
                <Undo2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  <span className="font-medium text-foreground">Deleted something by mistake?</span>{' '}
                  Trips and posts sit in the{' '}
                  <Link
                    href="/trash"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    trash
                  </Link>{' '}
                  for 30 days and come back with everything still attached. That is a different
                  thing from what is below.
                </p>
              </div>

              <div className="space-y-2 border-t pt-5">
                <p className="font-medium text-foreground">Delete your account</p>
                <p>
                  Removes your rows and the files behind them, and stops every public page you have
                  resolving. It cannot be undone and there is no 30-day window on it. Take the
                  export first if you want one — deleting does not keep a copy for you.
                </p>
                <DeleteAccount username={settings.username} />
              </div>

              <p className="border-t pt-5">
                Both of these are rights rather than favours, and the{' '}
                <Link
                  href="/privacy#your-rights"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  privacy policy
                </Link>{' '}
                says so in the same words. Anything you would rather ask a person about goes to{' '}
                <a
                  href={`mailto:${BRAND.support.privacyEmail}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {BRAND.support.privacyEmail}
                </a>
                .
              </p>
            </div>
          </Section>
        </div>

        {/* Same contents pattern as the legal pages: short list, plain anchors,
            works before any JavaScript has loaded. */}
        <nav aria-label="On this page" className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-6">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              On this page
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm lg:block lg:space-y-2">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-6 hidden lg:block">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/u/${settings.username}`} />}
              >
                View your profile
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string
  title: string
  description: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          {aside}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
