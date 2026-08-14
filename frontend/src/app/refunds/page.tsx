import { getLegalDoc } from '@/shared/content/legal'
import { LegalDocumentPage, legalMetadata } from '@/client/components/marketing/legal-document'

/** Refund policy — screen 11. Published before anything is on sale, deliberately. */
export const dynamic = 'force-static'

const doc = getLegalDoc('refunds')

export const metadata = legalMetadata(doc)

export default function RefundsPage() {
  return <LegalDocumentPage doc={doc} />
}
