'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

type KnowledgeSubView = 'list' | 'topics' | 'bulk-upload'

interface KnowledgeSidebarProps {
  currentSubView: KnowledgeSubView
  onSubViewChange: (view: KnowledgeSubView) => void
}

export default function KnowledgeSidebar({
  currentSubView,
  onSubViewChange,
}: KnowledgeSidebarProps) {
  const t = useTranslations('knowledge')

  const navItems = [
    {
      id: 'list' as KnowledgeSubView,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      label: t('faqList'),
    },
    {
      id: 'topics' as KnowledgeSubView,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      label: t('topics'),
    },
    {
      id: 'bulk-upload' as KnowledgeSubView,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      label: t('bulkUpload'),
    },
  ]

  return (
    <motion.div
      initial={{ x: -200 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.2 }}
      className="w-52 bg-white border-r border-gray-200 h-full flex flex-col"
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {t('knowledgeManagement')}
        </h3>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = currentSubView === item.id
          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSubViewChange(item.id)}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 ${
                isActive
                  ? 'bg-cyan-100 text-cyan-700 border border-cyan-200'
                  : 'hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <div
                className={`flex-shrink-0 ${
                  isActive ? 'text-cyan-600' : 'text-gray-600'
                }`}
              >
                {item.icon}
              </div>
              <span className="font-medium text-base truncate">{item.label}</span>
            </motion.button>
          )
        })}
      </nav>
    </motion.div>
  )
}

