/**
 * Admin API 服務
 */

export interface AdminUser {
  id: number
  username: string
  email: string
  supabaseUserId: string | null
  isActive: boolean
  tenantId: string | null
  createdAt: string
  updatedAt: string
}

interface AdminUsersResponse {
  success: boolean
  data: AdminUser[]
  total: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

async function getAuthToken(): Promise<string | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('[AdminAPI] Failed to get auth token:', error)
    return null
  }
}

export interface AdminTenant {
  id: string
  name: string
  planCode: string
  status: string
  createdAt: string
  updatedAt: string
  plan: {
    code: string
    name: string
  }
  users: { email: string }[]
}

export interface AdminTenantUpdate {
  name?: string
  planCode?: string
  status?: string
}

export const adminApi = {
  async getUsers(): Promise<AdminUser[]> {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('No auth token')
    }

    const response = await fetch(`${API_URL}/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || `API error: ${response.status}`)
    }

    const result: AdminUsersResponse = await response.json()
    if (!result.success || !result.data) {
      throw new Error('Invalid response')
    }
    return result.data
  },

  async getTenants(): Promise<AdminTenant[]> {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('No auth token')
    }

    const response = await fetch(`${API_URL}/admin/tenants`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || `API error: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success || !result.data) {
      throw new Error('Invalid response')
    }
    return result.data
  },

  async updateTenant(id: string, data: AdminTenantUpdate): Promise<AdminTenant> {
    const token = await getAuthToken()
    if (!token) {
      throw new Error('No auth token')
    }

    const response = await fetch(`${API_URL}/admin/tenants/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || `API error: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success || !result.data) {
      throw new Error('Invalid response')
    }
    return result.data
  },
}
