import { createFileRoute, notFound } from '@tanstack/react-router'
import { content } from '../lib/content'
import type { EntityRecord } from '../lib/schema'
import { EntityDetail } from '../components/Details'
export const Route = createFileRoute('/entities/$entityId')({
  loader: async ({ params }) => {
    if (!/^ent_\d{6}$/.test(params.entityId)) throw notFound()
    return content.record<EntityRecord>(params.entityId)
  },
  component: () => <EntityDetail entity={Route.useLoaderData()} />,
})
