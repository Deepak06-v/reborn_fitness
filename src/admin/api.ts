import type {
  AdminUser,
  DashboardResponse,
  Member,
  MemberDetailResponse,
  MemberListResponse,
  Payment,
  PaymentDetailResponse,
  PaymentListResponse,
  Plan,
  WhatsAppCampaignItem,
  WhatsAppHistoryItem,
  WhatsAppOverdueItem,
  WhatsAppStatusResponse,
  WhatsAppUpcomingItem,
} from './types'

export const CSRF_COOKIE = 'reborn.csrf'

export interface ApiFieldError {
  path: string
  message: string
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

let csrfToken: string | null = null

type QueryValue = string | number | boolean | undefined | null

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `/api/admin${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : null
  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error
    throw new ApiError(
      response.status,
      error?.message ?? `Request failed (${response.status})`,
      error?.code ?? 'error',
      error?.details,
    )
  }
  return data as T
}

export async function fetchCsrf(): Promise<string | null> {
  const response = await fetch('/api/admin/auth/csrf', { credentials: 'include' })
  if (!response.ok) return null
  const data = (await response.json()) as { csrfToken?: string | null }
  csrfToken = readCookie(CSRF_COOKIE) ?? data.csrfToken ?? null
  return csrfToken
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const mutating = method !== 'GET'
  const url = buildUrl(path, options.query)

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (mutating) {
      if (!csrfToken) await fetchCsrf()
      headers['x-csrf-token'] = csrfToken ?? readCookie(CSRF_COOKIE) ?? ''
    }
    return fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  }

  let response = await send()
  if (response.status === 403 && mutating) {
    // A stale/rotated CSRF token surfaces as 403; resync once and retry.
    csrfToken = null
    await fetchCsrf()
    response = await send()
  }
  return parse<T>(response)
}

export const adminApi = {
  csrf: fetchCsrf,

  async login(username: string, password: string): Promise<AdminUser> {
    const data = await request<{ admin: AdminUser }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    await fetchCsrf()
    return data.admin
  },

  async logout(): Promise<void> {
    await request<void>('/auth/logout', { method: 'POST' })
    csrfToken = null
  },

  async me(): Promise<AdminUser> {
    const data = await request<{ admin: AdminUser }>('/auth/me')
    return data.admin
  },

  dashboard(month?: string): Promise<DashboardResponse> {
    return request<DashboardResponse>('/dashboard', { query: { month } })
  },

  plans: {
    list(): Promise<Plan[]> {
      return request<{ plans: Plan[] }>('/plans').then((data) => data.plans)
    },
  },

  members: {
    list(query: {
      search?: string
      status?: string
      paymentStatus?: string
      month?: string
      sort?: string
      page?: number
      limit?: number
    }): Promise<MemberListResponse> {
      return request<MemberListResponse>('/members', { query })
    },
    get(id: string): Promise<MemberDetailResponse> {
      return request<MemberDetailResponse>(`/members/${id}`)
    },
    create(body: Record<string, unknown>): Promise<Member> {
      return request<{ member: Member }>('/members', { method: 'POST', body }).then(
        (data) => data.member,
      )
    },
    update(id: string, body: Record<string, unknown>): Promise<Member> {
      return request<{ member: Member }>(`/members/${id}`, {
        method: 'PATCH',
        body,
      }).then((data) => data.member)
    },
    setStatus(id: string, status: 'active' | 'inactive'): Promise<Member> {
      return request<{ member: Member }>(
        `/members/${id}/${status === 'active' ? 'activate' : 'deactivate'}`,
        { method: 'POST' },
      ).then((data) => data.member)
    },
  },

  payments: {
    list(query: {
      month?: string
      search?: string
      status?: string
      page?: number
      limit?: number
    }): Promise<PaymentListResponse> {
      return request<PaymentListResponse>('/payments', { query })
    },
    get(id: string): Promise<PaymentDetailResponse> {
      return request<PaymentDetailResponse>(`/payments/${id}`)
    },
    recordEntry(
      id: string,
      body: {
        amountPaise: number
        paymentDate: string
        method: string
        referenceNumber?: string | null
        notes?: string | null
      },
    ): Promise<Payment> {
      return request<{ payment: Payment }>(`/payments/${id}/entries`, {
        method: 'POST',
        body,
      }).then((data) => data.payment)
    },
    correct(
      id: string,
      body: {
        entryId: string
        reason: string
        replacement?: {
          amountPaise: number
          paymentDate: string
          method: string
          referenceNumber?: string | null
          notes?: string | null
        }
      },
    ): Promise<Payment> {
      return request<{ payment: Payment }>(`/payments/${id}/corrections`, {
        method: 'POST',
        body,
      }).then((data) => data.payment)
    },
    exportUrl(query: { month?: string; status?: string; search?: string }): string {
      return buildUrl('/payments/export', query)
    },
  },
  whatsapp: {
    getStatus(): Promise<WhatsAppStatusResponse> {
      return request<WhatsAppStatusResponse>('/whatsapp/status')
    },
    getUpcomingDue(): Promise<{ items: WhatsAppUpcomingItem[]; count: number }> {
      return request<{ items: WhatsAppUpcomingItem[]; count: number }>('/whatsapp/upcoming-due')
    },
    getOverdue(): Promise<{ items: WhatsAppOverdueItem[]; count: number }> {
      return request<{ items: WhatsAppOverdueItem[]; count: number }>('/whatsapp/overdue')
    },
    getCampaigns(): Promise<{ items: WhatsAppCampaignItem[] }> {
      return request<{ items: WhatsAppCampaignItem[] }>('/whatsapp/campaigns')
    },
    getHistory(limit = 50): Promise<{ items: WhatsAppHistoryItem[] }> {
      return request<{ items: WhatsAppHistoryItem[] }>('/whatsapp/history', { query: { limit } })
    },
    previewCampaign(body: {
      recipientFilter: string
      planId?: string
    }): Promise<{ recipientCount: number; sampleRecipients: Array<{ id: string; fullName: string; phone: string }> }> {
      return request('/whatsapp/campaigns/preview', {
        method: 'POST',
        body,
      })
    },
    sendCampaign(body: {
      name: string
      message: string
      mediaUrl?: string | null
      recipientFilter: string
      planId?: string
    }): Promise<{ success: boolean; campaign: { id: string; name: string; recipientCount: number; status: string } }> {
      return request('/whatsapp/campaigns/send', {
        method: 'POST',
        body,
      })
    },
    uploadImage(body: { data: string; mimeType: string }): Promise<{ mediaUrl: string }> {
      return request<{ mediaUrl: string }>('/whatsapp/upload-image', {
        method: 'POST',
        body,
      })
    },
    runReminders(): Promise<{ success: boolean; summary: { upcomingProcessed: number; overdueProcessed: number } }> {
      return request('/whatsapp/reminders/run', {
        method: 'POST',
      })
    },
  },
}
