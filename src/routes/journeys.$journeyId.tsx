import { createFileRoute, notFound } from '@tanstack/react-router'
import { content } from '../lib/content'
import type { JourneyRecord, EventRecord } from '../lib/schema'
import { JourneyPage } from '../components/Pages'
export const Route = createFileRoute('/journeys/$journeyId')({
  loader: async ({ params }) => {
    if (!/^jrn_\d{6}$/.test(params.journeyId)) throw notFound()
    const journey = await content.record<JourneyRecord>(params.journeyId)
    return {
      journey,
      events: await Promise.all(journey.steps.map((s) => content.record<EventRecord>(s.eventId))),
    }
  },
  component: () => <JourneyPage {...Route.useLoaderData()} />,
})
