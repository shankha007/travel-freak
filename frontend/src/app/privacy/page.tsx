import { getLegalDoc } from '@/shared/content/legal'
import { LegalDocumentPage, legalMetadata } from '@/client/components/marketing/legal-document'

/**
 * Privacy policy — screen 11.
 *
 * Statically rendered: the document is a constant, so a request has no reason
 * to reach the database. Outside `PROTECTED` in `proxy.ts` — a policy that
 * needs an account to read is not a policy anybody can agree to before signing
 * up.
 */
export const dynamic = 'force-static'

const doc = getLegalDoc('privacy')

export const metadata = legalMetadata(doc)

export default function PrivacyPage() {
  return <LegalDocumentPage doc={doc} />
}
