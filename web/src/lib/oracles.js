// The two oracles: fixed questions on the server (server/argos_api/oracle.py), only the
// question is sent. Instructions and phrases here are for display only; the API is authoritative.

export const ORACLES = {
  yesno: {
    title: 'Oráculo sí/no',
    description: 'Haz una pregunta y el oráculo te responde sí o no, con su probabilidad.',
    instructions: '¿La respuesta a esta pregunta es sí?',
    // Measured on the Pi (~1–1.5 s per call).
    seconds: 2,
  },
  '8ball': {
    title: 'Bola 8 mágica',
    description: 'La bola responde con una de sus 20 frases clásicas y te enseña el porcentaje de cada una.',
    instructions: '¿Cómo de probable es que la respuesta a esta pregunta sea afirmativa?',
    // Measured on the Pi (~3.6–4.2 s per call: 20 levels).
    seconds: 5,
  },
}

export const ORACLE_NAMES = Object.keys(ORACLES)

// Most negative first, as the server scale (server/argos_api/oracle.py PHRASES).
export const PHRASES = [
  ['No cuentes con ello', 'negative'],
  ['Mi respuesta es no', 'negative'],
  ['Mis fuentes dicen que no', 'negative'],
  ['Las perspectivas no son muy buenas', 'negative'],
  ['Muy dudoso', 'negative'],
  ['Respuesta confusa, vuelve a intentarlo', 'non_committal'],
  ['Vuelve a preguntar más tarde', 'non_committal'],
  ['Mejor no decírtelo ahora', 'non_committal'],
  ['No se puede predecir ahora', 'non_committal'],
  ['Concéntrate y vuelve a preguntar', 'non_committal'],
  ['Las señales apuntan a que sí', 'affirmative'],
  ['Buenas perspectivas', 'affirmative'],
  ['Lo más probable', 'affirmative'],
  ['Tal y como yo lo veo, sí', 'affirmative'],
  ['Sí', 'affirmative'],
  ['Puedes confiar en ello', 'affirmative'],
  ['Sí, definitivamente', 'affirmative'],
  ['Es decididamente así', 'affirmative'],
  ['Sin lugar a dudas', 'affirmative'],
  ['Es cierto', 'affirmative'],
]

export const KIND_LABELS = { affirmative: 'Afirmativas', non_committal: 'Neutras', negative: 'Negativas' }

/** The oracle name from a request path like /v1/oracle/8ball, or null. */
export function oracleFromPath(path) {
  const m = /^\/v1\/oracle\/([^/]+)$/.exec(path ?? '')
  return m && m[1] in ORACLES ? m[1] : null
}
