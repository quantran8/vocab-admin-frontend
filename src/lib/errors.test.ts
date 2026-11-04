import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { describeError, parseFieldErrors } from './errors'

describe('errors', () => {
  it('splits a validation message into fields', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', 'lemma: Too small; types.0.partOfSpeech: Invalid option')
    expect(parseFieldErrors(error)).toEqual({ lemma: 'Too small', 'types.0.partOfSpeech': 'Invalid option' })
  })

  it('ignores messages from other error codes', () => {
    expect(parseFieldErrors(new ApiError(409, 'CONTENT_LOCKED', 'a: b'))).toEqual({})
    expect(parseFieldErrors(new Error('a: b'))).toEqual({})
  })

  it('translates publish rules and shows the request id on server errors', () => {
    expect(describeError(new ApiError(422, 'PUBLICATION_INVALID', 'IPA missing')).detail).toContain('IPA')
    expect(describeError(new ApiError(500, 'INTERNAL_ERROR', 'Internal error', true, 'r-9')).detail).toContain('r-9')
    expect(describeError(new TypeError('fetch failed')).title).toContain('kết nối')
  })
})
