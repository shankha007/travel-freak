'use client'

import Link from 'next/link'
import { LogOut, User } from 'lucide-react'
import { signOut } from '@/server/actions/auth'
import { Avatar, AvatarFallback } from '@/client/components/ui/avatar'
import { Button } from '@/client/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu'

interface UserMenuProps {
  displayName: string
  email: string
  planCode: string
}

const PLAN_LABEL: Record<string, string> = {
  explorer: 'Explorer',
  voyager: 'Voyager',
  nomad: 'Nomad',
}

export function UserMenu({ displayName, email, planCode }: UserMenuProps) {
  const initials =
    displayName
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'T'

  return (
    <DropdownMenu>
      {/* Base UI composes via `render`, not Radix's `asChild`. */}
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" />}
        aria-label="Account menu"
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* A plain div, not DropdownMenuLabel: that maps to Base UI's
            Menu.GroupLabel, which throws "MenuGroupContext is missing" unless
            it is inside a Menu.Group. This is a header for the whole menu, not
            a label for a group of items. */}
        <div className="px-1.5 py-1">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {PLAN_LABEL[planCode] ?? planCode} plan
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem nativeButton={false} render={<Link href="/settings" />}>
          <User className="size-4" aria-hidden />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* A form, not an onClick: sign-out must clear the httpOnly auth
            cookies, which only a server round-trip can do. */}
        <form action={signOut}>
          {/* nativeButton, because the render prop really is a <button>: left
              at the default Base UI adds non-native attributes on top of one. */}
          <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
