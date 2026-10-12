import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { LAYA_VERSION, PUBLIC_API_URL } from './config'

test('public API URL comes from VITE_API_URL', () => {
  expect(PUBLIC_API_URL).toBe('https://argos-api.example.test')
})

test('Laya version matches the server pin', () => {
  const reqs = readFileSync(new URL('../../../server/requirements.txt', import.meta.url), 'utf8')
  expect(reqs).toMatch(new RegExp(`^laya==${LAYA_VERSION.replaceAll('.', '\\.')}$`, 'm'))
})
