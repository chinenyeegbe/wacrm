import { describe, expect, it } from 'vitest'
import { isUniqueViolation } from './db-errors'

describe('isUniqueViolation', () => {
  it('is true for the Postgres unique_violation code', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
  })

  it('is false for other Postgres error codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false) // foreign_key_violation
    expect(isUniqueViolation({ code: '42P01' })).toBe(false) // undefined_table
  })

  it('is false for null / undefined / codeless errors', () => {
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
    expect(isUniqueViolation({})).toBe(false)
    expect(isUniqueViolation({ code: null })).toBe(false)
  })
})
