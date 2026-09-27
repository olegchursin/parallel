import { createFileRoute, notFound } from '@tanstack/react-router'
import { content } from '../lib/content'
import type { SourceRecord } from '../lib/schema'
import { SourceDetail } from '../components/Details'
export const Route = createFileRoute('/sources/$sourceId')({
  loader: async ({ params }) => {
    if (!/^src_\d{6}$/.test(params.sourceId)) throw notFound()
    return content.record<SourceRecord>(params.sourceId)
  },
  component: () => <SourceDetail source={Route.useLoaderData()} />,
})
