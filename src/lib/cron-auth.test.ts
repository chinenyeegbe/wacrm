import { describe, expect, it } from 'vitest'
import { cronSecretMatches } from './cron-auth'

describe('cronSecretMatches', () => {
  it('is true when the secrets match exactly', () => {
    expect(cronSecretMatches('s3cr3t-value', 's3cr3t-value')).toBe(true)
  })

  it('is false when the secrets differ', () => {
    expect(cronSecretMatches('s3cr3t-value', 's3cr3t-VALUE')).toBe(false)
  })

  it('is false on a length mismatch (no throw)', () => {
    expect(cronSecretMatches('short', 'a-much-longer-secret')).toBe(false)
    expect(cronSecretMatches('', 'nonempty')).toBe(false)
  })

  it('is true for two empty strings', () => {
    expect(cronSecretMatches('', '')).toBe(true)
  })
})
