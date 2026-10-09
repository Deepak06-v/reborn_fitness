import { createApp } from './app'
import { bootstrapAdmin } from './bootstrap/admin'
import { connectDatabase } from './config/db'
import { env } from './config/env'

async function start() {
  await connectDatabase()
  // Ensure the env-configured admin exists before accepting requests.
  await bootstrapAdmin()
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
