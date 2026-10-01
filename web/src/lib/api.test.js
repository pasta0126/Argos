import { describe, expect, test, vi } from 'vitest'
import { curlFor, explainError, locate, request, requestWithRetry } from './api'

const KEY = 'secret-key-123'

function reply(status, data, headers = {}) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers })
}

function fetchSeq(...responses) {
  const fn = vi.fn()
  responses.forEach((r) => fn.mockImplementationOnce(async () => (typeof r === 'function' ? r() : r)))
  return fn
}

const noWait = async () => {}

describe('request', () => {
  test('sends bearer key and JSON body', async () => {
    const fetchImpl = fetchSeq(reply(200, { ok: 1 }))
    const res = await request({ method: 'POST', path: '/v1/decide', body: { text: 'x' }, key: KEY, fetchImpl })
    expect(res).toMatchObject({ ok: true, status: 200, data: { ok: 1 } })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/v1/decide')
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`)
    expect(JSON.parse(init.body)).toEqual({ text: 'x' })
  })

  test('network failure is status 0', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await request({ path: '/health', fetchImpl })).toMatchObject({ ok: false, status: 0 })
  })

  test('abort propagates', async () => {
    const ctrl = new AbortController()
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    ctrl.abort()
    await expect(request({ path: '/health', fetchImpl, signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('requestWithRetry', () => {
  test('503 busy then 200', async () => {
    const fetchImpl = fetchSeq(reply(503, { status: 'busy' }, { 'Retry-After': '3' }), reply(200, { answers: {} }))
    const onWait = vi.fn()
    const onAttempt = vi.fn()
    const wait = vi.fn(noWait)
    const res = await requestWithRetry({ path: '/v1/decide', fetchImpl }, { onAttempt, onWait, wait })
    expect(res).toMatchObject({ status: 200, attempts: 2 })
    expect(onAttempt.mock.calls).toEqual([[1], [2]])
    expect(onWait).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, reason: 'busy', seconds: 3 }))
    expect(wait).toHaveBeenCalledWith(3000, undefined)
  })

  test('loading reason and default 5 s without Retry-After', async () => {
    const fetchImpl = fetchSeq(reply(503, { status: 'loading' }), reply(200, {}))
    const onWait = vi.fn()
    await requestWithRetry({ path: '/v1/decide', fetchImpl }, { onWait, wait: noWait })
    expect(onWait.mock.calls[0][0]).toMatchObject({ reason: 'loading', seconds: 5 })
  })

  test('retries exhausted returns the last 503', async () => {
    const fetchImpl = vi.fn(async () => reply(503, { status: 'busy' }, { 'Retry-After': '5' }))
    const res = await requestWithRetry({ path: '/v1/decide', fetchImpl }, { wait: noWait, maxAttempts: 6 })
    expect(res).toMatchObject({ status: 503, attempts: 6 })
    expect(fetchImpl).toHaveBeenCalledTimes(6)
    expect(explainError(res).action).toBe('retry')
  })

  test('abort during the wait rejects', async () => {
    const ctrl = new AbortController()
    const fetchImpl = fetchSeq(reply(503, { status: 'busy' }, { 'Retry-After': '5' }))
    const p = requestWithRetry({ path: '/v1/decide', fetchImpl, signal: ctrl.signal }, { onWait: () => ctrl.abort() })
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('explainError', () => {
  test('401 offers changing the key', () => {
    expect(explainError({ status: 401, data: { detail: 'missing or invalid API key' } })).toMatchObject({ action: 'key' })
  })

  test('404 preset', () => {
    expect(explainError({ status: 404, data: { detail: "unknown preset 'x'" } }).detail).toBe("unknown preset 'x'")
  })

  test('413 shows the limit', () => {
    expect(explainError({ status: 413, data: { detail: 'text exceeds 8000 characters' } }).detail).toMatch(/8000/)
  })

  test('422 names the question', () => {
    const e = explainError({
      status: 422,
      data: { detail: [{ loc: ['body', 'questions', 'refund', 'yesno', 'criteria'], msg: 'Value error, bad', type: 'value_error' }] },
    })
    expect(e).toMatchObject({ action: 'question', question: 'refund' })
    expect(e.detail).toBe('Pregunta «refund» → criteria: Value error, bad.')
  })

  test('422 on a preset subset index', () => {
    const e = explainError({ status: 422, data: { detail: [{ loc: ['body', 'questions', 0], msg: 'Input should be x' }] } })
    expect(e).toMatchObject({ action: null })
    expect(e.detail).toMatch(/^questions\.0/)
  })

  test('network', () => {
    expect(explainError({ status: 0, data: null }).title).toMatch(/conectar/)
  })
})

test('locate strips body and type tags', () => {
  expect(locate(['body', 'questions', 'department', 'choice', 'criteria'])).toEqual({ question: 'department', field: 'criteria' })
  expect(locate(['body', 'text'])).toEqual({ question: null, field: 'text' })
})

describe('curlFor', () => {
  const req = { method: 'POST', path: '/v1/decide', body: { text: "it's" } }

  test('uses the public URL and a key placeholder', () => {
    const c = curlFor(req)
    expect(c).toMatch(/^curl -s -X POST https:\/\/argos-api\.northernarchive\.com\/v1\/decide/)
    expect(c).toContain('Bearer $ARGOS_KEY')
    expect(c).not.toContain(KEY)
  })

  test('escapes single quotes for the shell', () => {
    expect(curlFor(req)).toContain(`"it'\\''s"`)
  })
})
