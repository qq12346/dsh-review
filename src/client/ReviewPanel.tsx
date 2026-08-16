import { useEffect, useState } from 'react'

interface State {
  lessons: { id: string; text: string }[]
  index: { reports: { sessionId: string }[] }
}

export function ReviewPanel(): JSX.Element {
  const [data, setData] = useState<State>({ lessons: [], index: { reports: [] } })
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/dsh-review/state', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => { if (alive) setData(json) })
      .catch(() => { if (alive) setError('读取失败') })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ padding: 16, font: '14px/1.5 system-ui, sans-serif' }}>
      <h2>复盘中心</h2>
      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      <button onClick={() => fetch('/dsh-review/run', { method: 'POST', cache: 'no-store' })}>复盘当前会话</button>
      <section>
        <h3>报告（{data.index.reports.length}）</h3>
        <ul>{data.index.reports.map(item => <li key={item.sessionId}>{item.sessionId}</li>)}</ul>
      </section>
      <section>
        <h3>经验（{data.lessons.length}）</h3>
        <ul>{data.lessons.map(item => <li key={item.id}>{item.text}</li>)}</ul>
      </section>
    </div>
  )
}
