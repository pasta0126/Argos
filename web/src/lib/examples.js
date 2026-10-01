// Bundled at build time from server/examples (only plain /v1/decide bodies; the preset-*
// files are covered by preset mode).
const files = import.meta.glob('../../../server/examples/*.json', { eager: true, import: 'default' })

const TITLES = {
  'ticket-full': 'Ticket completo',
  'ticket-department': 'Departamento de un ticket',
  'email-triage': 'Triaje de un correo',
  'comment-moderation': 'Moderación de un comentario',
  'review-opinion': 'Opinión de una reseña',
  'yesno-simple': 'Sí/no sencillo',
}

export const EXAMPLES = Object.entries(files)
  .map(([path, body]) => {
    const id = path.split('/').pop().replace(/\.json$/, '')
    return { id, title: TITLES[id] ?? id, body }
  })
  .filter((e) => e.body.questions && !Array.isArray(e.body.questions))
  .sort((a, b) => (a.id === 'ticket-full' ? -1 : b.id === 'ticket-full' ? 1 : a.title.localeCompare(b.title, 'es')))
