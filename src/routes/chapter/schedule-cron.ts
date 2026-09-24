import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'

import { publishDueChapters } from '../../services/chapter-schedule'
import { wrapCron } from '../../util/cron-alert'

// Publicacion programada de capitulos: cada minuto publica los que tienen
// publishAt <= ahora. Seguro con varias instancias (UPDATE condicional en
// publishScheduledChapter: solo quien gana dispara los efectos).
export const router = () =>
  new Elysia().use(
    cron({
      name: 'chapter-scheduled-publish',
      pattern: '* * * * *',
      run: wrapCron('chapter-scheduled-publish', publishDueChapters)
    })
  )
