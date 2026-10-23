import { createApp } from './app'
import { bootstrapAdmin } from './bootstrap/admin'
import { connectDatabase } from './config/db'
import { env } from './config/env'
import { ensureMonthlyPaymentIndexes } from './models/MonthlyPayment'
import { reconcileAllBilling, startBillingScheduler } from './services/billing'
import { startWhatsAppScheduler } from './services/whatsappScheduler'
import { outboundQueueService } from './services/whatsapp/outbound-queue.service'

async function start() {
  await connectDatabase()
  await ensureMonthlyPaymentIndexes()
  // Ensure the env-configured admin exists before accepting requests.
  await bootstrapAdmin()
  // Recover any billing periods missed while the service was down, then keep
  // them current on a schedule for as long as the process runs.
  await reconcileAllBilling(new Date(), { force: true }).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[billing] initial reconciliation failed:', error)
  })
  startBillingScheduler()
  startWhatsAppScheduler()
  outboundQueueService.startQueueWorker()
  const app = createApp()
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] REBORN FITNESS admin API listening on http://localhost:${env.PORT}`)
  })
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[api] Failed to start:', error)
  process.exit(1)
})
