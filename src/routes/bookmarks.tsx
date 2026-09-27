import { createFileRoute } from '@tanstack/react-router'
import { BookmarksPage } from '../components/Pages'
export const Route = createFileRoute('/bookmarks')({ component: BookmarksPage })
