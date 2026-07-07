// Calcula el fin del período ya pagado de una suscripción (grace period).
// Prioridad:
//   1. next_billing_time de PayPal (fecha exacta del siguiente cobro que ya no ocurrirá)
//   2. último pago + intervalo del plan (PayPal borra next_billing_time al cancelar)
//   3. ahora (sin datos: no hay período pagado que preservar)
export function computePaidPeriodEnd(opts: {
  nextBillingTime?: string | Date | null
  lastPaymentTime?: string | Date | null
  interval?: string | null
}): Date {
  if (opts.nextBillingTime) {
    return new Date(opts.nextBillingTime)
  }
  if (opts.lastPaymentTime) {
    const end = new Date(opts.lastPaymentTime)
    switch ((opts.interval ?? 'MONTH').toUpperCase()) {
      case 'DAY':
        end.setDate(end.getDate() + 1)
        break
      case 'WEEK':
        end.setDate(end.getDate() + 7)
        break
      case 'YEAR':
        end.setFullYear(end.getFullYear() + 1)
        break
      default:
        end.setMonth(end.getMonth() + 1)
        break
    }
    return end
  }
  return new Date()
}
