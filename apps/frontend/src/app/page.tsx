import { redirect } from 'next/navigation'

export default function HomePage() {
  // 重定向到預設語言的 dashboard
  redirect('/zh-TW/dashboard')
}

