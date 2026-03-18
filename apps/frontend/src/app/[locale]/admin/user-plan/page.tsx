'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { adminApi, type AdminTenant } from '@/lib/api/admin'
import { stripeApi } from '@/lib/api/stripe'
import Modal from '@/components/ui/Modal'
import { useNotification } from '@/hooks/useNotification'

/**
 * Admin - User-Plan 管理（Tenants 表）
 */
export default function AdminUserPlanPage() {
  const t = useTranslations('admin.userPlan')
  const tCommon = useTranslations('common')
  const notify = useNotification()
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [plans, setPlans] = useState<{ code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null)
  const [editPlanCode, setEditPlanCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')

  const filteredTenants = emailSearch.trim()
    ? tenants.filter((tenant) =>
        tenant.users?.some((u) =>
          u.email?.toLowerCase().includes(emailSearch.trim().toLowerCase())
        )
      )
    : tenants

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [tenantsData, plansData] = await Promise.all([
          adminApi.getTenants(),
          stripeApi.getPlans(),
        ])
        setTenants(tenantsData)
        setPlans(plansData.map((p) => ({ code: p.code, name: p.name })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setTenants([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const openEditModal = (tenant: AdminTenant) => {
    setEditingTenant(tenant)
    setEditPlanCode(tenant.planCode)
  }

  const closeEditModal = () => {
    setEditingTenant(null)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!editingTenant) return
    try {
      setSaving(true)
      const updated = await adminApi.updateTenant(editingTenant.id, {
        planCode: editPlanCode,
      })
      setTenants((prev) =>
        prev.map((tenant) => (tenant.id === updated.id ? updated : tenant))
      )
      closeEditModal()
      notify.success(t('saveSuccess'))
    } catch (err) {
      console.error('[AdminUserPlan] Save failed:', err)
      notify.error(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-TW')
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
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xl font-medium text-gray-900">{t('totalCount', { count: filteredTenants.length })}</p>
        <input
          type="text"
          value={emailSearch}
          onChange={(e) => setEmailSearch(e.target.value)}
          placeholder={t('searchEmailPlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:w-64"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('id')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('email')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('name')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('planCode')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('status')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('createdAt')}</th>
              <th className="px-4 py-3 text-left text-base font-medium text-gray-900">{t('updatedAt')}</th>
              <th className="w-12 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">{tenant.id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{tenant.users?.map((u) => u.email).filter(Boolean).join(', ') || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-900">{tenant.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{tenant.planCode}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{tenant.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(tenant.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(tenant.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(tenant)}
                      className="rounded p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      title={t('edit')}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!editingTenant}
        onClose={closeEditModal}
        title={t('editModalTitle')}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-700 hover:bg-gray-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-base text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        }
      >
        {editingTenant && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-base font-medium text-gray-700">{t('id')}</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">{editingTenant.id}</p>
            </div>
            <div>
              <label className="mb-1 block text-base font-medium text-gray-700">{t('email')}</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">{editingTenant.users?.map((u) => u.email).filter(Boolean).join(', ') || '-'}</p>
            </div>
            <div>
              <label className="mb-1 block text-base font-medium text-gray-700">{t('name')}</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">{editingTenant.name}</p>
            </div>
            <div className="rounded-lg border-2 border-blue-500 bg-blue-50 p-3">
              <label className="mb-1 block text-base font-semibold text-blue-800">{t('planCode')}</label>
              <select
                value={editPlanCode}
                onChange={(e) => setEditPlanCode(e.target.value)}
                className="w-full rounded-lg border-2 border-blue-400 bg-white px-3 py-2 text-base font-medium text-blue-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {plans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-base font-medium text-gray-700">{t('status')}</label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-600">{editingTenant.status}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
