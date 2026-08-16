import { describe, expect, it } from 'vitest'
import {
  COLLABORATOR_ROLES,
  INVITABLE_ROLES,
  ROLE_CAPABILITIES,
  ROLE_LABEL,
  ROLE_SUMMARY,
  collaboratorName,
  inviteState,
  isInvitableRole,
  roleCanEdit,
  roleLabel,
} from '@/shared/collaborators'

describe('roles', () => {
  it('never offers owner as something to invite somebody as', () => {
    // The owner of a trip is trips.user_id, and a check constraint forbids the
    // row. A picker offering it would be offering something the database
    // refuses.
    expect(INVITABLE_ROLES).not.toContain('owner')
    expect(INVITABLE_ROLES).toEqual(['editor', 'viewer'])
  })

  it('can still name a role it would never write', () => {
    expect(roleLabel('owner')).toBe('Owner')
  })

  it('labels and summarises every role the enum can hold', () => {
    for (const role of COLLABORATOR_ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy()
      expect(ROLE_SUMMARY[role]).toBeTruthy()
    }
  })

  it('passes an unknown role through rather than blanking it', () => {
    expect(roleLabel('admiral')).toBe('admiral')
  })

  it('recognises only the two invitable roles', () => {
    expect(isInvitableRole('editor')).toBe(true)
    expect(isInvitableRole('viewer')).toBe(true)
    expect(isInvitableRole('owner')).toBe(false)
    expect(isInvitableRole('')).toBe(false)
  })
})

describe('roleCanEdit', () => {
  // Mirrors can_edit_trip(), which is what actually decides. If these two ever
  // disagree the interface is lying about access somebody has or has not got.
  it('matches what can_edit_trip() grants', () => {
    expect(roleCanEdit('owner')).toBe(true)
    expect(roleCanEdit('editor')).toBe(true)
    expect(roleCanEdit('viewer')).toBe(false)
  })
})

describe('ROLE_CAPABILITIES', () => {
  it('describes both halves for every invitable role', () => {
    for (const role of INVITABLE_ROLES) {
      expect(ROLE_CAPABILITIES[role].can.length).toBeGreaterThan(0)
      expect(ROLE_CAPABILITIES[role].cannot.length).toBeGreaterThan(0)
    }
  })

  // The two halves of "the budget" are not the same secret, and an earlier
  // draft of this table claimed both were. `trips.budget_planned` rides on the
  // trip row that RLS already shares; `expenses` has one policy keyed on
  // `user_id` and no collaborator clause at all.
  it('says every role can see what the trip is budgeted to cost', () => {
    for (const role of INVITABLE_ROLES) {
      expect(ROLE_CAPABILITIES[role].can.join(' ')).toMatch(/budgeted to cost/i)
    }
  })

  it('and that no role can see what it actually cost', () => {
    for (const role of INVITABLE_ROLES) {
      expect(ROLE_CAPABILITIES[role].cannot.join(' ')).toMatch(/actually cost/i)
    }
  })

  it('never claims the planned budget is hidden, because it is not', () => {
    for (const role of INVITABLE_ROLES) {
      expect(ROLE_CAPABILITIES[role].cannot.join(' ')).not.toMatch(/budgeted/i)
    }
  })

  it('never promises a viewer can change anything', () => {
    expect(ROLE_CAPABILITIES.viewer.can.join(' ')).not.toMatch(/edit|add|build/i)
  })
})

describe('inviteState', () => {
  it('is pending until it is answered', () => {
    expect(inviteState({ acceptedAt: null, declinedAt: null })).toBe('pending')
  })

  it('reads an acceptance and a refusal apart', () => {
    expect(inviteState({ acceptedAt: '2026-08-15T00:00:00Z', declinedAt: null })).toBe('accepted')
    expect(inviteState({ acceptedAt: null, declinedAt: '2026-08-15T00:00:00Z' })).toBe('declined')
  })
})

describe('collaboratorName', () => {
  it('prefers the display name', () => {
    expect(
      collaboratorName({ displayName: 'Ada Lovelace', username: 'ada', invitedEmail: 'a@b.com' })
    ).toBe('Ada Lovelace')
  })

  it('falls back to the username when the display name is blank', () => {
    expect(collaboratorName({ displayName: '   ', username: 'ada', invitedEmail: 'a@b.com' })).toBe(
      'ada'
    )
  })

  it('names somebody by the address they were invited at, before they sign up', () => {
    expect(
      collaboratorName({ displayName: null, username: null, invitedEmail: 'ada@example.com' })
    ).toBe('ada@example.com')
  })

  it('never renders an empty name', () => {
    expect(collaboratorName({ displayName: null, username: null, invitedEmail: null })).toBe(
      'Someone'
    )
  })
})
