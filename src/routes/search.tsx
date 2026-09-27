import { createFileRoute } from '@tanstack/react-router'
import { content } from '../lib/content'
import { SearchPage } from '../components/Pages'
export const Route = createFileRoute('/search')({
  loader: () => content.artifact<{ id: string; text: string }[]>('search.json'),
  component: () => <SearchPage index={Route.useLoaderData()} />,
})
