// Alerta de fallos de crons: log siempre, y aviso a Discord si hay webhook
// configurado (DISCORD_ALERTS_WEBHOOK_URL). Los crons fallaban en silencio y
// así se incubó el incidente de suscripciones de 2026-07.

// Cooldown por cron para no inundar Discord si un cron frecuente (ej. rifas,
// cada 5s) entra en bucle de fallo. El console.error sale siempre.
const ALERT_COOLDOWN_MS = 30 * 60 * 1000
const lastAlertAt = new Map<string, number>()

export async function reportCronError(cronName: string, error: unknown) {
  const message =
    error instanceof Error
      ? `${error.message}\n${error.stack?.slice(0, 800) ?? ''}`
      : String(error)
  console.error(`[cron:${cronName}] FALLO`, message)

  const webhook = Bun.env.DISCORD_ALERTS_WEBHOOK_URL
  if (!webhook) return
  const now = Date.now()
  const last = lastAlertAt.get(cronName) ?? 0
  if (now - last < ALERT_COOLDOWN_MS) return
  lastAlertAt.set(cronName, now)
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🔴 Cron **${cronName}** falló:\n\`\`\`\n${message.slice(0, 1500)}\n\`\`\``
      })
    })
  } catch {}
}

// Envuelve el run de un cron para que cualquier throw se reporte en vez de
// perderse en silencio.
export function wrapCron(
  cronName: string,
  fn: () => Promise<unknown> | unknown
) {
  return async () => {
    try {
      await fn()
    } catch (error) {
      await reportCronError(cronName, error)
    }
  }
}
