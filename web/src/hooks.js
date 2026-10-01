import { useEffect, useState } from 'react'
import { request } from './lib/api'

const HEALTH_EVERY_S = { loading: 5, ready: 60, down: 10, checking: 5 }

/** Service state from GET /health, re-checked on a cadence that depends on the state. */
export function useHealth() {
  const [health, setHealth] = useState({ status: 'checking', model: null })

  useEffect(() => {
    let timer
    let alive = true
    const check = async () => {
      const res = await request({ path: '/health' }).catch(() => ({ status: 0 }))
      if (!alive) return
      let next
      if (res.status === 200) next = { status: 'ready', model: res.data?.model ?? null }
      else if (res.status === 503) next = { status: 'loading', model: null }
      else next = { status: 'down', model: null }
      setHealth(next)
      timer = setTimeout(check, HEALTH_EVERY_S[next.status] * 1000)
    }
    check()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  return health
}

/** Date.now(), refreshed every `ms` while `active` (and right after it becomes active). */
export function useNow(active, ms = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const first = setTimeout(() => setNow(Date.now()), 0)
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [active, ms])
  return now
}
