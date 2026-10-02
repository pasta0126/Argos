// Mirrors server/argos_api/schemas.py (MAX_TEXT_CHARS, MAX_QUESTIONS, MAX_OPTIONS, MAX_QUESTION_CHARS).
// The API stays authoritative: if these drift, its 413/422 are shown to the user.
export const MAX_TEXT_CHARS = 8000
export const MAX_QUESTIONS = 10
export const MAX_OPTIONS = 20
export const MAX_QUESTION_CHARS = 500 // oracle questions
export const MIN_OPTIONS = 2

// Python's len() counts code points, not UTF-16 units.
export const textLength = (text) => [...text].length
