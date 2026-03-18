'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { adminApi, type AdminUser } from '@/lib/api/admin'

/**
 * Admin - Users 管理
 */
export default function AdminUsersPage() {
  const t = useTranslations('admin.users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await adminApi.getUsers()
        setUsers(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setUsers([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-TW')
  }

  if (loading) {
    return (
      <div className="text-base">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('title')}</h2>
        <p className="text-gray-500">{t('loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-base">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('title')}</h2>
        <p className="text-red-600">{t('error')}: {error}</p>
      </div>
    )
  }

  return (
    <div className="text-base">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('title')}</h2>
      <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-xl font-medium text-gray-900">{t('totalCount', { count: users.length })}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('id')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('username')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('email')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('supabaseUserId')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('isActive')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('tenantId')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('createdAt')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('updatedAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">{user.id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">{user.username}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">{user.email}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-600" title={user.supabaseUserId || ''}>
                    {user.supabaseUserId || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">{user.isActive ? '✓' : '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{user.tenantId || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(user.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(user.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
