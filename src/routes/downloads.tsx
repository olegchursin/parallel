import { createFileRoute } from '@tanstack/react-router'
import { DownloadsPage } from '../components/Pages'
export const Route = createFileRoute('/downloads')({ component: DownloadsPage })
