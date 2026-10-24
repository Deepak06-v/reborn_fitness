import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  History,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react'
import { adminApi } from '../api'
import { formatDate } from '../format'
import { useToast } from '../components/useToast'
import {
  AdminModal,
  EmptyState,
  PageHeader,
  Panel,
  Spinner,
  StatCard,
} from '../components/ui'
import { cn } from '../../lib/utils'
import type {
  Plan,
  WhatsAppCampaignItem,
  WhatsAppDeliveryStatus,
  WhatsAppHistoryItem,
  WhatsAppOverdueItem,
  WhatsAppStatusResponse,
  WhatsAppUpcomingItem,
} from '../types'

type ActiveTab = 'upcoming' | 'overdue' | 'custom' | 'history'

export function WhatsAppDeliveryBadge({
  status,
  error,
}: {
  status: WhatsAppDeliveryStatus
  error?: string | null
}) {
  const configs: Record<
    WhatsAppDeliveryStatus,
    { label: string; className: string }
  > = {
    delivered: {
      label: 'Delivered',
      className: 'border-lime/40 bg-lime/10 text-lime',
    },
    read: {
      label: 'Read',
      className: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    },
    sent: {
      label: 'Sent',
      className: 'border-accent/40 bg-accent/10 text-accent',
    },
    queued: {
      label: 'Queued',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    },
    failed: {
      label: 'Failed',
      className: 'border-red-500/40 bg-red-500/10 text-red-300',
    },
    not_sent: {
      label: 'Not Sent',
      className: 'border-hairline bg-white/5 text-muted',
    },
  }

  const { label, className } = configs[status] || configs.not_sent

  return (
    <span
      title={error || undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em]',
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'delivered'
            ? 'bg-lime'
            : status === 'read'
              ? 'bg-cyan-400'
              : status === 'sent'
                ? 'bg-accent'
                : status === 'failed'
                  ? 'bg-red-400'
                  : 'bg-dim',
        )}
      />
      {label}
    </span>
  )
}

export function WhatsAppNotificationsPage() {
  const { notify: showToast } = useToast()
  const [activeTab, setActiveTab] = useState<ActiveTab>('upcoming')

  // Status & meta state
  const [status, setStatus] = useState<WhatsAppStatusResponse | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Lists
  const [upcoming, setUpcoming] = useState<WhatsAppUpcomingItem[]>([])
  const [overdue, setOverdue] = useState<WhatsAppOverdueItem[]>([])
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignItem[]>([])
  const [campaignPage, setCampaignPage] = useState(1)
  const [campaignTotal, setCampaignTotal] = useState(0)
  const [campaignHasMore, setCampaignHasMore] = useState(false)
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)

  const [history, setHistory] = useState<WhatsAppHistoryItem[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Custom Campaign state
  const [campaignName, setCampaignName] = useState('')
  const [campaignMessage, setCampaignMessage] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [campaignPlanId, setCampaignPlanId] = useState('')
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string | null>(null)
  const [previewRecipients, setPreviewRecipients] = useState<number>(0)
  const [estimatingRecipients, setEstimatingRecipients] = useState(false)
  const [sendingCampaign, setSendingCampaign] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  // Running reminders manually
  const [runningReminders, setRunningReminders] = useState(false)

  // Fast initial load: Fetch lightweight status, upcoming reminders, and overdue lists
  const loadInitialData = useCallback(async (isRefresh = false) => {
    try {
      const [statusRes, upcomingRes, overdueRes, plansRes] = await Promise.allSettled([
        adminApi.whatsapp.getStatus(isRefresh),
        adminApi.whatsapp.getUpcomingDue(),
        adminApi.whatsapp.getOverdue(),
        adminApi.plans.list(),
      ])

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
      if (upcomingRes.status === 'fulfilled') setUpcoming(upcomingRes.value.items)
      if (overdueRes.status === 'fulfilled') setOverdue(overdueRes.value.items)
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value)

      // If all failed, show error toast
      if (
        statusRes.status === 'rejected' &&
        upcomingRes.status === 'rejected' &&
        overdueRes.status === 'rejected'
      ) {
        showToast('Failed to connect to WhatsApp notification service', 'error')
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to load WhatsApp data',
        'error',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // On-demand fetch for Campaign and Message History tab
  const loadHistoryData = useCallback(async (cPage = 1, hPage = 1) => {
    setLoadingCampaigns(true)
    setLoadingHistory(true)
    try {
      const [campaignsRes, historyRes] = await Promise.allSettled([
        adminApi.whatsapp.getCampaigns({ page: cPage, limit: 10 }),
        adminApi.whatsapp.getHistory({ page: hPage, limit: 25 }),
      ])

      if (campaignsRes.status === 'fulfilled') {
        setCampaigns(campaignsRes.value.items)
        setCampaignPage(campaignsRes.value.page)
        setCampaignTotal(campaignsRes.value.total)
        setCampaignHasMore(campaignsRes.value.hasMore)
      }

      if (historyRes.status === 'fulfilled') {
        setHistory(historyRes.value.items)
        setHistoryPage(historyRes.value.page)
        setHistoryTotal(historyRes.value.total)
        setHistoryHasMore(historyRes.value.hasMore)
      }
    } catch {
      showToast('Failed to load message history', 'error')
    } finally {
      setLoadingCampaigns(false)
      setLoadingHistory(false)
    }
  }, [showToast])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistoryData(campaignPage, historyPage)
    }
  }, [activeTab, campaignPage, historyPage, loadHistoryData])

  // Recipient estimation for custom message
  useEffect(() => {
    let cancelled = false
    const fetchRecipientCount = async () => {
      setEstimatingRecipients(true)
      try {
        const preview = await adminApi.whatsapp.previewCampaign({
          recipientFilter: campaignFilter,
          planId: campaignFilter === 'plan' ? campaignPlanId : undefined,
        })
        if (!cancelled) {
          setPreviewRecipients(preview.recipientCount)
        }
      } catch {
        if (!cancelled) setPreviewRecipients(0)
      } finally {
        if (!cancelled) setEstimatingRecipients(false)
      }
    }

    fetchRecipientCount()
    return () => {
      cancelled = true
    }
  }, [campaignFilter, campaignPlanId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadInitialData(true)
    if (activeTab === 'history') {
      await loadHistoryData(campaignPage, historyPage)
    }
    showToast('WhatsApp data refreshed', 'success')
  }

  const handleRunReminders = async () => {
    setRunningReminders(true)
    try {
      const result = await adminApi.whatsapp.runReminders()
      showToast(
        `Automated reminders executed (Upcoming: ${result.summary.upcomingProcessed}, Overdue: ${result.summary.overdueProcessed})`,
        'success',
      )
      await loadInitialData(true)
      if (activeTab === 'history') {
        await loadHistoryData(1, 1)
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to run reminders',
        'error',
      )
    } finally {
      setRunningReminders(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be under 5MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAttachedImage(reader.result as string)
      setImageMime(file.type)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setAttachedImage(null)
    setImageMime(null)
  }

  const handleOpenConfirm = () => {
    if (!campaignName.trim()) {
      showToast('Please provide a campaign title / subject', 'error')
      return
    }
    if (!campaignMessage.trim() && !attachedImage) {
      showToast('Please write a message or attach an image', 'error')
      return
    }
    if (previewRecipients === 0) {
      showToast('No recipients match the selected filter', 'error')
      return
    }
    setConfirmModalOpen(true)
  }

  const handleConfirmSend = async () => {
    setConfirmModalOpen(false)
    setSendingCampaign(true)

    try {
      let uploadedMediaUrl: string | null = null
      if (attachedImage && imageMime) {
        const uploadRes = await adminApi.whatsapp.uploadImage({
          data: attachedImage,
          mimeType: imageMime,
        })
        uploadedMediaUrl = uploadRes.mediaUrl
      }

      const res = await adminApi.whatsapp.sendCampaign({
        name: campaignName.trim(),
        message: campaignMessage.trim(),
        mediaUrl: uploadedMediaUrl,
        recipientFilter: campaignFilter,
        planId: campaignFilter === 'plan' ? campaignPlanId : undefined,
      })

      showToast(
        `Campaign dispatched to ${res.campaign.recipientCount} members!`,
        'success',
      )

      // Reset form
      setCampaignName('')
      setCampaignMessage('')
      setAttachedImage(null)
      setImageMime(null)

      // Switch to history tab and refresh
      setActiveTab('history')
      await loadHistoryData(1, 1)
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to send campaign',
        'error',
      )
    } finally {
      setSendingCampaign(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const tabs: Array<{ id: ActiveTab; label: string; count?: number }> = [
    { id: 'upcoming', label: 'Upcoming Fee Reminders', count: upcoming.length },
    { id: 'overdue', label: 'Overdue Members', count: overdue.length },
    { id: 'custom', label: 'Send Custom Message' },
    { id: 'history', label: 'Campaign & Message History', count: campaigns.length },
  ]

  const providerName =
    status?.provider === 'cloud_api'
      ? 'Meta Cloud API'
      : 'WhatsApp'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automation & Messaging"
        title="WhatsApp Notifications"
        description="Automated fee reminders, daily overdue tracking, and member broadcasts via Meta's official WhatsApp Business Cloud API."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:border-accent/40"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', refreshing && 'animate-spin text-accent')}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleRunReminders}
              disabled={runningReminders}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-canvas transition-colors hover:bg-accent/90"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              {runningReminders ? 'Running...' : 'Run Auto Reminders Now'}
            </button>
          </div>
        }
      />

      {/* Integration Status Banner */}
      {!status?.isConfigured ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-xs">
            <p className="font-semibold uppercase tracking-wider text-amber-300">
              WhatsApp Integration Offline / Mock Mode Active
            </p>
            <p className="mt-1 font-body text-amber-200/80">
              Live WhatsApp credentials are not configured in the environment.
              All notification workflows, deduplication, and queues run safely in simulation mode.
              To enable live WhatsApp delivery, set <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white">WHATSAPP_ENABLED=true</code>, <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white">WHATSAPP_PROVIDER=cloud_api</code>, <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white">WHATSAPP_ACCESS_TOKEN</code>, <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white">WHATSAPP_PHONE_NUMBER_ID</code>, and <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white">WHATSAPP_APP_SECRET</code> in your backend environment.
            </p>
          </div>
        </div>
      ) : status.connectionState === 'disconnected' ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-xs">
            <p className="font-semibold uppercase tracking-wider text-amber-300">
              {providerName} Configured / Phone Disconnected
            </p>
            <p className="mt-1 font-body text-amber-200/80">
              Meta Cloud API credentials are set, but the phone number ID ({status.phoneNumberId || 'unverified'}) is not active in your Meta Business account. Verify the number status in Meta WhatsApp Manager.
            </p>
          </div>
        </div>
      ) : status.connectionState === 'unreachable' ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="text-xs">
            <p className="font-semibold uppercase tracking-wider text-red-300">
              {providerName} Authentication Failed / Unreachable
            </p>
            <p className="mt-1 font-body text-red-200/80">
              The backend could not reach or authenticate with Meta Graph API. Ensure your system user access token and phone number ID are valid.
            </p>
          </div>
        </div>
      ) : null}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming Due (2 Days)"
          value={upcoming.length}
          hint="Automated reminder triggers today"
          icon={<Clock className="h-4 w-4" />}
          tone={upcoming.length > 0 ? 'accent' : 'default'}
        />
        <StatCard
          label="Overdue Members"
          value={overdue.length}
          hint="Daily follow-up reminders active"
          icon={<AlertCircle className="h-4 w-4" />}
          tone={overdue.length > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Broadcast Campaigns"
          value={campaigns.length}
          hint="Total broadcasts sent"
          icon={<MessageSquare className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Provider Status"
          value={
            status?.connectionState === 'connected'
              ? 'Connected'
              : status?.connectionState === 'disconnected'
                ? 'Disconnected'
                : status?.connectionState === 'unreachable'
                  ? 'Unreachable'
                  : status?.isConfigured
                    ? 'Meta Cloud API'
                    : 'Safe Mock'
          }
          hint={
            status?.connectionState === 'connected'
              ? `Phone: ${status.phoneNumberId || 'Configured'} • API: ${status.graphApiVersion || 'v26.0'}`
              : status?.isConfigured
                ? `${providerName} credentials set`
                : 'Credentials pending'
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={
            status?.connectionState === 'connected'
              ? 'lime'
              : status?.connectionState === 'disconnected' || status?.connectionState === 'unreachable'
                ? 'danger'
                : 'default'
          }
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
              activeTab === tab.id
                ? 'bg-accent text-canvas'
                : 'text-muted hover:bg-white/5 hover:text-white',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-mono text-[0.625rem]',
                  activeTab === tab.id
                    ? 'bg-black/20 text-canvas'
                    : 'bg-white/10 text-muted',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: UPCOMING FEE REMINDERS */}
      {activeTab === 'upcoming' && (
        <Panel className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <h2 className="font-display text-base font-bold uppercase tracking-tight text-white">
              Fee Reminders Due In Exactly 2 Days
            </h2>
            <p className="mt-1 font-body text-xs text-muted">
              Every day, the system automatically detects members whose billing cycle completes in exactly 2 days and issues a WhatsApp template notification. Deduplication guarantees members receive at most one reminder per billing period.
            </p>
          </div>

          {upcoming.length === 0 ? (
            <EmptyState
              title="No Upcoming Fee Reminders Today"
              description="There are currently no active members whose membership fees are due in exactly 2 days."
              icon={<CalendarCheck className="h-8 w-8 text-dim" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-body text-xs">
                <thead className="border-b border-hairline bg-surface/50 font-display uppercase tracking-[0.12em] text-dim">
                  <tr>
                    <th className="px-6 py-3">Member</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Amount Due</th>
                    <th className="px-6 py-3">Notification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {upcoming.map((item) => (
                    <tr key={item.paymentId} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{item.memberName}</p>
                        <p className="font-mono text-[0.625rem] text-dim">{item.memberId}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted">{item.phone}</td>
                      <td className="px-6 py-4 text-white">{item.planName}</td>
                      <td className="px-6 py-4 font-mono text-muted">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-white">
                        ₹{item.dueAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <WhatsAppDeliveryBadge
                          status={item.notification.status}
                          error={item.notification.error}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* TAB 2: OVERDUE MEMBERS */}
      {activeTab === 'overdue' && (
        <Panel className="p-0">
          <div className="border-b border-hairline px-6 py-4">
            <h2 className="font-display text-base font-bold uppercase tracking-tight text-white">
              Overdue Members (Daily Reminders)
            </h2>
            <p className="mt-1 font-body text-xs text-muted">
              Identifies members whose fees are past due. The scheduler sends an automatic reminder each day while payment remains unpaid. As soon as a payment is recorded, future overdue reminders stop immediately.
            </p>
          </div>

          {overdue.length === 0 ? (
            <EmptyState
              title="No Overdue Members"
              description="Great news! All active gym members are up to date on their payments."
              icon={<CheckCircle2 className="h-8 w-8 text-lime" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-body text-xs">
                <thead className="border-b border-hairline bg-surface/50 font-display uppercase tracking-[0.12em] text-dim">
                  <tr>
                    <th className="px-6 py-3">Member</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Days Overdue</th>
                    <th className="px-6 py-3">Amount Due</th>
                    <th className="px-6 py-3">WhatsApp Status (Today)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {overdue.map((item) => (
                    <tr key={item.paymentId} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">{item.memberName}</p>
                        <p className="font-mono text-[0.625rem] text-dim">{item.memberId}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted">{item.phone}</td>
                      <td className="px-6 py-4 text-white">{item.planName}</td>
                      <td className="px-6 py-4 font-mono text-muted">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 font-mono text-[0.625rem] font-semibold text-red-300">
                          {item.daysOverdue} {item.daysOverdue === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-red-300">
                        ₹{item.dueAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <WhatsAppDeliveryBadge
                          status={item.notification.status}
                          error={item.notification.error}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* TAB 3: CUSTOM BROADCAST COMPOSER */}
      {activeTab === 'custom' && (
        <Panel className="p-6">
          <div className="border-b border-hairline pb-4">
            <h2 className="font-display text-base font-bold uppercase tracking-tight text-white">
              Send Custom Announcement / Broadcast
            </h2>
            <p className="mt-1 font-body text-xs text-muted">
              Compose custom broadcasts for gym closure notices, festive wishes, personal training offers, or timetable updates.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Configuration & Message */}
            <div className="space-y-4 lg:col-span-2">
              <div>
                <label className="block font-display text-xs font-semibold uppercase tracking-[0.12em] text-white">
                  Campaign Title / Internal Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Holiday Announcement 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="mt-2 w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-display text-xs font-semibold uppercase tracking-[0.12em] text-white">
                  Message Body
                </label>
                <textarea
                  rows={6}
                  placeholder="Type your message here... (e.g. Dear members, the gym will remain closed tomorrow on account of Diwali. Regular timings resume Friday.)"
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  className="mt-2 w-full rounded-md border border-hairline bg-canvas p-3 font-body text-sm text-white placeholder-muted focus:border-accent focus:outline-none"
                />
                <div className="mt-1 flex justify-between font-mono text-[0.6875rem] text-dim">
                  <span>Formatting: WhatsApp supports *bold*, _italic_, and line breaks.</span>
                  <span>{campaignMessage.length} chars</span>
                </div>
              </div>

              {/* Image Attachment */}
              <div>
                <label className="block font-display text-xs font-semibold uppercase tracking-[0.12em] text-white">
                  Optional Media Attachment (Photo / Poster)
                </label>
                {!attachedImage ? (
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface/50 p-6 transition-colors hover:border-accent/60">
                    <ImageIcon className="h-5 w-5 text-accent" />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      Attach Image (PNG, JPG, WebP &lt; 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-hairline bg-canvas p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={attachedImage}
                        alt="Attachment preview"
                        className="h-16 w-16 rounded object-cover border border-hairline"
                      />
                      <div>
                        <p className="font-body text-xs font-medium text-white">
                          Image attached and ready
                        </p>
                        <p className="font-mono text-[0.625rem] text-dim">
                          Will be sent with caption to all recipients
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-red-400 hover:border-red-500/40 hover:bg-red-500/10"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Target Audience Filtering & Pre-send Confirmation trigger */}
            <div className="space-y-4 rounded-lg border border-hairline bg-surface/40 p-5">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-white">
                Target Audience
              </h3>

              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All Registered Members' },
                  { id: 'active', label: 'Active Members Only' },
                  { id: 'overdue', label: 'Overdue Members Only' },
                  { id: 'plan', label: 'Specific Membership Plan' },
                ].map((option) => (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 font-body text-xs transition-colors',
                      campaignFilter === option.id
                        ? 'border-accent/40 bg-accent/10 text-white font-medium'
                        : 'border-hairline bg-canvas text-muted hover:border-hairline/80 hover:text-white',
                    )}
                  >
                    <input
                      type="radio"
                      name="filter"
                      value={option.id}
                      checked={campaignFilter === option.id}
                      onChange={() => setCampaignFilter(option.id)}
                      className="text-accent focus:ring-0"
                    />
                    {option.label}
                  </label>
                ))}
              </div>

              {campaignFilter === 'plan' && (
                <div className="mt-3">
                  <label className="block font-mono text-[0.6875rem] text-dim">
                    Select Plan:
                  </label>
                  <select
                    value={campaignPlanId}
                    onChange={(e) => setCampaignPlanId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-body text-xs text-white focus:border-accent focus:outline-none"
                  >
                    <option value="">Select a plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient Counter Box */}
              <div className="rounded-md border border-hairline bg-canvas p-4 text-center">
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
                  Estimated Recipients
                </p>
                <p className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
                  {estimatingRecipients ? (
                    <Spinner className="inline-block h-5 w-5" />
                  ) : (
                    previewRecipients
                  )}
                </p>
                <p className="mt-1 font-body text-[0.6875rem] text-muted">
                  Members with valid contact numbers
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenConfirm}
                disabled={sendingCampaign || previewRecipients === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-canvas transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sendingCampaign ? 'Sending Broadcast...' : 'Review & Send Broadcast'}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* TAB 4: MESSAGE HISTORY & CAMPAIGNS */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Custom Broadcast Campaigns */}
          <Panel className="p-0">
            <div className="flex flex-col gap-2 border-b border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-tight text-white">
                  Broadcast Campaigns
                </h2>
                <p className="mt-1 font-body text-xs text-muted">
                  Recent broadcast announcements with real-time delivery tracking.
                </p>
              </div>
              {loadingCampaigns && <Spinner className="h-4 w-4" />}
            </div>

            {campaigns.length === 0 ? (
              <EmptyState
                title="No Broadcast Campaigns"
                description="Custom broadcasts sent to members will appear here."
                icon={<History className="h-8 w-8 text-dim" />}
              />
            ) : (
              <div>
                <div className="divide-y divide-hairline">
                  {campaigns.map((c) => (
                    <div key={c.id} className="p-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-white">
                              {c.name}
                            </h3>
                            <span
                              className={cn(
                                'inline-flex items-center rounded px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase',
                                c.status === 'completed'
                                  ? 'bg-lime/20 text-lime border border-lime/40'
                                  : c.status === 'processing'
                                    ? 'bg-accent/20 text-accent border border-accent/40 animate-pulse'
                                    : c.status === 'paused'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/40',
                              )}
                            >
                              {c.status}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[0.625rem] text-dim">
                            Dispatched: {formatDate(c.createdAt)} • Target: {c.recipientFilter}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-hairline bg-white/5 px-3 py-1 font-mono text-[0.625rem] uppercase text-muted">
                          {c.recipientCount} Total Recipients
                        </span>
                      </div>

                      <p className="mt-3 rounded bg-canvas p-3 font-body text-xs text-muted">
                        {c.message}
                      </p>

                      {c.error && (
                        <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 font-mono text-[0.6875rem] text-amber-200">
                          {c.error}
                        </p>
                      )}

                      {/* Full Campaign Progress Accounting */}
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Processed</span>
                          <p className="font-display text-sm font-bold text-white">
                            {c.stats.processed ?? ((c.stats.sent || 0) + (c.stats.failed || 0))}
                          </p>
                        </div>
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Sent</span>
                          <p className="font-display text-sm font-bold text-accent">
                            {c.stats.sent}
                          </p>
                        </div>
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Delivered</span>
                          <p className="font-display text-sm font-bold text-lime">
                            {c.stats.delivered}
                          </p>
                        </div>
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Read</span>
                          <p className="font-display text-sm font-bold text-cyan-300">
                            {c.stats.read}
                          </p>
                        </div>
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Failed</span>
                          <p className="font-display text-sm font-bold text-red-400">
                            {c.stats.failed}
                          </p>
                        </div>
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Paused</span>
                          <p className="font-display text-sm font-bold text-amber-300">
                            {c.stats.paused ?? 0}
                          </p>
                        </div>
                        <div className="rounded border border-hairline bg-surface/50 p-2 text-center">
                          <span className="font-mono text-[0.625rem] text-dim">Remaining</span>
                          <p className="font-display text-sm font-bold text-dim">
                            {c.stats.remaining ?? Math.max(0, c.recipientCount - ((c.stats.sent || 0) + (c.stats.failed || 0)))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campaigns Pagination Controls */}
                <div className="flex items-center justify-between border-t border-hairline px-6 py-3 font-mono text-xs text-muted">
                  <span>
                    Showing {campaigns.length} of {campaignTotal} campaigns
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={campaignPage <= 1 || loadingCampaigns}
                      onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-hairline px-2.5 py-1 text-xs hover:border-accent disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span>Page {campaignPage}</span>
                    <button
                      type="button"
                      disabled={!campaignHasMore || loadingCampaigns}
                      onClick={() => setCampaignPage((p) => p + 1)}
                      className="rounded border border-hairline px-2.5 py-1 text-xs hover:border-accent disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          {/* Individual Notification Logs */}
          <Panel className="p-0">
            <div className="flex flex-col gap-2 border-b border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-tight text-white">
                  Individual Message Dispatch Logs
                </h2>
                <p className="mt-1 font-body text-xs text-muted">
                  Audit log of all individual WhatsApp messages sent by the automated scheduler and broadcast engine.
                </p>
              </div>
              {loadingHistory && <Spinner className="h-4 w-4" />}
            </div>

            {history.length === 0 ? (
              <EmptyState
                title="No Notification Logs Yet"
                description="Message logs will show individual delivery statuses as reminders are sent."
                icon={<Clock className="h-8 w-8 text-dim" />}
              />
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-body text-xs">
                    <thead className="border-b border-hairline bg-surface/50 font-display uppercase tracking-[0.12em] text-dim">
                      <tr>
                        <th className="px-6 py-3">Member</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {history.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.02]">
                          <td className="px-6 py-3">
                            <p className="font-semibold text-white">{log.memberName}</p>
                            <p className="font-mono text-[0.625rem] text-dim">{log.memberId}</p>
                          </td>
                          <td className="px-6 py-3 font-mono text-muted">{log.phoneNumber}</td>
                          <td className="px-6 py-3 font-mono text-[0.625rem] uppercase text-dim">
                            <div>{log.type}</div>
                            {log.provider && (
                              <div className="text-[0.5625rem] text-muted/60 lowercase">
                                via {log.provider}
                              </div>
                            )}
                            {log.attempts !== undefined && log.attempts > 0 && (
                              <div className="text-[0.5625rem] text-dim">
                                attempts: {log.attempts}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <WhatsAppDeliveryBadge
                              status={log.status}
                              error={log.error}
                            />
                          </td>
                          <td className="px-6 py-3 font-mono text-dim">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-6 py-3 font-body text-muted max-w-xs truncate">
                            {log.error ? (
                              <span className="text-red-400">{log.error}</span>
                            ) : (
                              log.message || '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* History Pagination Controls */}
                <div className="flex items-center justify-between border-t border-hairline px-6 py-3 font-mono text-xs text-muted">
                  <span>
                    Showing {history.length} of {historyTotal} messages
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={historyPage <= 1 || loadingHistory}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-hairline px-2.5 py-1 text-xs hover:border-accent disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span>Page {historyPage}</span>
                    <button
                      type="button"
                      disabled={!historyHasMore || loadingHistory}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="rounded border border-hairline px-2.5 py-1 text-xs hover:border-accent disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Confirmation Modal before Sending Broadcast */}
      <AdminModal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm WhatsApp Broadcast"
        description="Please review your message and recipient count before broadcasting."
      >
        <div className="space-y-4 font-body text-xs">
          <div className="rounded-md border border-accent/30 bg-accent/10 p-4">
            <p className="font-display text-sm font-bold uppercase tracking-tight text-white">
              You are about to send this message to {previewRecipients} {previewRecipients === 1 ? 'member' : 'members'}.
            </p>
            <p className="mt-1 text-muted">
              Target filter: <strong className="text-white">{campaignFilter}</strong>
            </p>
          </div>

          <div>
            <label className="font-mono text-[0.6875rem] uppercase tracking-wider text-dim">
              Campaign Title:
            </label>
            <p className="font-display font-bold text-white">{campaignName}</p>
          </div>

          <div>
            <label className="font-mono text-[0.6875rem] uppercase tracking-wider text-dim">
              Message Preview:
            </label>
            <div className="mt-1 rounded bg-canvas p-3 font-body text-muted whitespace-pre-wrap border border-hairline">
              {campaignMessage || '(No text body)'}
            </div>
          </div>

          {attachedImage && (
            <div>
              <label className="font-mono text-[0.6875rem] uppercase tracking-wider text-dim">
                Attached Poster:
              </label>
              <img
                src={attachedImage}
                alt="Broadcast attachment"
                className="mt-1 h-32 rounded border border-hairline object-cover"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="rounded-md border border-hairline px-4 py-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={sendingCampaign}
              className="flex items-center gap-2 rounded-md bg-accent px-5 py-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-canvas hover:bg-accent/90"
            >
              <Send className="h-3.5 w-3.5" />
              {sendingCampaign ? 'Sending...' : 'Confirm & Send Broadcast'}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* WhatsApp Provider Attribution & Compliance Notice */}
      <div className="flex flex-col gap-2 border-t border-hairline/60 pt-4 text-[0.6875rem] text-muted">
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <span>REBORN FITNESS Controlled WhatsApp Notification System</span>
          <span className="font-mono text-[0.625rem] text-dim">
            WhatsApp messaging powered by <span className="text-muted">{status?.provider === 'cloud_api' ? 'Meta WhatsApp Cloud API' : 'Safe Mock Provider'}</span>
          </span>
        </div>
        <p className="font-mono text-[0.625rem] text-dim">
          Notice: Business-initiated notifications outside customer service windows must use approved Meta templates. Messages must comply with Meta WhatsApp Business messaging policies.
        </p>
      </div>
    </div>
  )
}
