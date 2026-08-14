import { getLegalDoc } from '@/shared/content/legal'
import { LegalDocumentPage, legalMetadata } from '@/client/components/marketing/legal-document'

/** Terms of service — screen 11. Static, and readable without an account. */
export const dynamic = 'force-static'

const doc = getLegalDoc('terms')

export const metadata = legalMetadata(doc)

export default function TermsPage() {
  return <LegalDocumentPage doc={doc} />
}
