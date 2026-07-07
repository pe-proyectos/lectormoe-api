import { cron } from '@elysiajs/cron'
import { Elysia } from 'elysia'
import { updateUsersAlsoRead } from '../../commands/update-users-also-read'
import { wrapCron } from '../../util/cron-alert'

async function runUpdateUsersAlsoRead() {
  console.log('🕐 Cron job: Starting update of usersAlsoReadMangaCustomIds...')
  await updateUsersAlsoRead()
  console.log('🕐 Cron job: Finished update of usersAlsoReadMangaCustomIds')
}

export const router = () =>
  new Elysia().use(
    cron({
      name: 'update-users-also-read',
      // Run every Friday at 12:00 (0 minutes, 12 hours, any day, any month, Friday=5)
      pattern: '0 12 * * 5',
      run: wrapCron('update-users-also-read', runUpdateUsersAlsoRead)
    })
  )
