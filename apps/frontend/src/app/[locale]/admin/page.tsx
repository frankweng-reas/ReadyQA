'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

/**
 * Admin 首頁 - 預設導向 Users
 */
export default function AdminPage() {
  const t = useTranslations('admin')
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/${params.locale}/admin/users`)
  }, [params.locale, router])

  return (
    <div className="flex items-center justify-center p-8 text-base">
      <p className="text-gray-500">{t('redirecting')}</p>
    </div>
  )
}
