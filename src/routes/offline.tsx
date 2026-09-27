import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/offline')({
  component: () => (
    <main id="main">
      <p>Opening the atlas…</p>
    </main>
  ),
})
