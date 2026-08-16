import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ReviewPanel } from './ReviewPanel.tsx'

export const inject = ['sessions']

export function apply(ctx: ClientContext): void {
  const host = document.createElement('div')
  host.dataset.dshReviewHost = ''
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<ReviewPanel />)
  ctx.effect(() => () => { root.unmount(); host.remove() })
}
