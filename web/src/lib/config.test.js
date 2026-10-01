import { expect, test } from 'vitest'
import { PUBLIC_API_URL } from './config'

test('public API URL comes from VITE_API_URL', () => {
  expect(PUBLIC_API_URL).toBe('https://argos-api.example.test')
})
