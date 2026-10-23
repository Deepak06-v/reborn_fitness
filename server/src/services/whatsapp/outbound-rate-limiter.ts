import { env } from '../../config/env'

export interface RateLimiterOptions {
  maxPerWindow?: number
  windowMs?: number
  batchSize?: number
  batchCooldownMs?: number
  messageDelayMs?: number
}

export class OutboundRateLimiter {
  private maxPerWindow: number
  private windowMs: number
  private batchSize: number
  private batchCooldownMs: number
  private messageDelayMs: number

  private sentTimestamps: number[] = []
  private batchCounter: number = 0
  private lastSendTimestamp: number = 0

  private paused: boolean = false
  private pauseReason: string | null = null
  private pausedUntil: number | null = null

  constructor(options?: RateLimiterOptions) {
    this.maxPerWindow = options?.maxPerWindow ?? (env.isTest ? 100 : (env.WHATSAPP_RATE_LIMIT_MAX_PER_WINDOW ?? 15))
    this.windowMs = options?.windowMs ?? (env.isTest ? 1000 : (env.WHATSAPP_RATE_LIMIT_WINDOW_MS ?? 60000))
    this.batchSize = options?.batchSize ?? (env.isTest ? 10 : (env.WHATSAPP_QUEUE_BATCH_SIZE ?? 5))
    this.batchCooldownMs = options?.batchCooldownMs ?? (env.isTest ? 0 : (env.WHATSAPP_QUEUE_BATCH_COOLDOWN_MS ?? 5000))
    this.messageDelayMs = options?.messageDelayMs ?? (env.isTest ? 0 : (env.WHATSAPP_MESSAGE_DELAY_MS ?? 1500))
  }

  /**
   * Reconfigures settings (useful for tests or dynamic admin config)
   */
  configure(options: RateLimiterOptions): void {
    if (options.maxPerWindow !== undefined) this.maxPerWindow = options.maxPerWindow
    if (options.windowMs !== undefined) this.windowMs = options.windowMs
    if (options.batchSize !== undefined) this.batchSize = options.batchSize
    if (options.batchCooldownMs !== undefined) this.batchCooldownMs = options.batchCooldownMs
    if (options.messageDelayMs !== undefined) this.messageDelayMs = options.messageDelayMs
  }

  /**
   * Prunes sliding window timestamps older than (now - windowMs)
   */
  private pruneOldTimestamps(now: number): void {
    const cutoff = now - this.windowMs
    this.sentTimestamps = this.sentTimestamps.filter((ts) => ts > cutoff)
  }

  /**
   * Checks whether the limiter is currently paused.
   * Auto-resumes if pausedUntil has elapsed.
   */
  isPaused(): boolean {
    if (!this.paused) return false
    if (this.pausedUntil && Date.now() >= this.pausedUntil) {
      this.resume()
      return false
    }
    return true
  }

  getPauseReason(): string | null {
    return this.pauseReason
  }

  /**
   * Pauses dispatch due to provider quota, session ban, or admin command.
   */
  pause(reason: string, durationMs?: number): void {
    this.paused = true
    this.pauseReason = reason
    this.pausedUntil = durationMs ? Date.now() + durationMs : null
  }

  /**
   * Resumes dispatch.
   */
  resume(): void {
    this.paused = false
    this.pauseReason = null
    this.pausedUntil = null
  }

  /**
   * Blocks until a rate limit slot is available according to:
   * 1. Paused state (throws error or waits if paused)
   * 2. Rolling-window message cap (maxPerWindow in windowMs)
   * 3. Batch counter & batch cooldown
   * 4. Per-message pacing delay
   */
  async acquireSlot(): Promise<void> {
    if (this.isPaused()) {
      throw new Error(`Outbound messaging queue is paused: ${this.pauseReason || 'Provider session/quota limits'}`)
    }

    const now = Date.now()
    this.pruneOldTimestamps(now)

    // 1. Enforce rolling-window limiter below gateway configured maximum
    if (this.sentTimestamps.length >= this.maxPerWindow) {
      const oldestInWindow = this.sentTimestamps[0]
      const waitMs = oldestInWindow + this.windowMs - now + 50
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        return this.acquireSlot() // Re-evaluate after waiting
      }
    }

    // 2. Enforce batch boundary cooldown
    if (this.batchCounter >= this.batchSize) {
      this.batchCounter = 0
      if (this.batchCooldownMs > 0 && !env.isTest) {
        await new Promise((resolve) => setTimeout(resolve, this.batchCooldownMs))
      }
    }

    // 3. Enforce conservative per-message pacing
    const elapsedSinceLastSend = Date.now() - this.lastSendTimestamp
    if (this.lastSendTimestamp > 0 && elapsedSinceLastSend < this.messageDelayMs && !env.isTest) {
      const waitPacing = this.messageDelayMs - elapsedSinceLastSend
      await new Promise((resolve) => setTimeout(resolve, waitPacing))
    }
  }

  /**
   * Records a successful dispatch in the rolling window and advances batch counter.
   */
  recordDispatch(): void {
    const now = Date.now()
    this.sentTimestamps.push(now)
    this.lastSendTimestamp = now
    this.batchCounter += 1
  }

  /**
   * Returns telemetry snapshot for admin diagnostics.
   */
  getTelemetry() {
    this.pruneOldTimestamps(Date.now())
    return {
      sentInCurrentWindow: this.sentTimestamps.length,
      maxPerWindow: this.maxPerWindow,
      windowMs: this.windowMs,
      batchSize: this.batchSize,
      batchCooldownMs: this.batchCooldownMs,
      messageDelayMs: this.messageDelayMs,
      isPaused: this.isPaused(),
      pauseReason: this.pauseReason,
      pausedUntil: this.pausedUntil ? new Date(this.pausedUntil).toISOString() : null,
      batchCountProgress: this.batchCounter,
    }
  }

  /**
   * Resets internal tracking state (for unit testing).
   */
  reset(): void {
    this.sentTimestamps = []
    this.batchCounter = 0
    this.lastSendTimestamp = 0
    this.paused = false
    this.pauseReason = null
    this.pausedUntil = null
  }
}

export const outboundRateLimiter = new OutboundRateLimiter()
