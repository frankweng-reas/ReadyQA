import { redirect } from 'next/navigation'

export default function RootPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  // 根路徑重定向到 dashboard
  redirect(`/${locale}/dashboard`)
}
