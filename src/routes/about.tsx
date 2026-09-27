import { createFileRoute } from '@tanstack/react-router'
import { AboutPage } from '../components/Pages'
export const Route = createFileRoute('/about')({ component: AboutPage })
