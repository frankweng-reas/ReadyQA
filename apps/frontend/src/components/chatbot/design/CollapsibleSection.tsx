'use client';

import { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function CollapsibleSection({
  title,
  children,
  isCollapsed,
  onToggle,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <svg
          className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="p-4 space-y-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

