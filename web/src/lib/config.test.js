import { expect, test } from 'vitest'
import { PUBLIC_API_URL } from './config'

test('public API URL defaults to production', () => {
  expect(PUBLIC_API_URL).toBe('https://argos-api.northernarchive.com')
})
