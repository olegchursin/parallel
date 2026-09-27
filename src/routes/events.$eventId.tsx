import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { content } from '../lib/content'
import type { EventRecord } from '../lib/schema'
import { EventDetail } from '../components/Details'
import s from '../styles/App.module.css'
export const Route = createFileRoute('/events/$eventId')({
  loader: async ({ params }) => {
    if (!/^evt_\d{6}$/.test(params.eventId)) throw notFound()
    const m = await content.manifest()
    if (m.withdrawals[params.eventId])
      return { event: null, withdrawal: m.withdrawals[params.eventId] }
    if (!m.recordToShard[params.eventId] && !m.redirects[params.eventId]) throw notFound()
    return { event: await content.record<EventRecord>(params.eventId), withdrawal: null }
  },
  component: Page,
})
function Page() {
  const data = Route.useLoaderData()
  return (
    <main id="main">
      {data.event ? (
        <EventDetail event={data.event} />
      ) : (
        <article className={s.detailArticle}>
          <p className={s.eyebrow}>EDITORIAL CORRECTION</p>
          <h1>This record has been withdrawn</h1>
          <p>{data.withdrawal}</p>
          <Link to="/timeline" className={s.primary}>
            Return to the atlas
          </Link>
        </article>
      )}
    </main>
  )
}
