'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ZeroResultQuery {
  query: string;
  count: number;
  lastQueriedAt: string;
}

interface ZeroResultQueriesData {
  queries: ZeroResultQuery[];
  total: number;
  period: number;
}

interface ZeroResultQueriesDetailProps {
  chatbotId: string;
  timeRange: number;
  onCreateFaq: (question: string) => void;
}

export default function ZeroResultQueriesDetail({
  chatbotId,
  timeRange,
  onCreateFaq,
}: ZeroResultQueriesDetailProps) {
  const t = useTranslations('insight');
  const [data, setData] = useState<ZeroResultQueriesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ignoringQuery, setIgnoringQuery] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [chatbotId, timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[ZeroResultQueriesDetail] 載入數據:', { chatbotId, timeRange });
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chatbots/${chatbotId}/zero-result-queries?days=${timeRange}&limit=20`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[ZeroResultQueriesDetail] 回應數據:', result);
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(t('loadError'));
      }
    } catch (err) {
      console.error('[ZeroResultQueriesDetail] 載入失敗:', err);
      setError(t('loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-TW');
  };

  const handleIgnoreQuery = async (query: string) => {
    setIgnoringQuery(query);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/query-logs/ignore-query`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatbotId,
            query,
            ignored: true,
          }),
        }
      );
      
      if (response.ok) {
        // 從列表中移除該查詢
        setData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            queries: prevData.queries.filter(q => q.query !== query),
            total: prevData.total - 1,
          };
        });
      } else {
        alert('忽略失敗，請稍後再試');
      }
    } catch (error) {
      console.error('[ZeroResultQueriesDetail] 忽略查詢失敗:', error);
      alert('忽略失敗，請稍後再試');
    } finally {
      setIgnoringQuery(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-3">{error || t('loadError')}</p>
        <button
          onClick={loadData}
          className="text-sm text-primary hover:underline"
        >
          重試
        </button>
      </div>
    );
  }

  if (data.queries.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-16 h-16 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-label font-medium">太棒了！沒有零結果查詢</p>
        <p className="text-sm text-label mt-1">所有用戶查詢都找到了答案</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 查詢清單 */}
      <div className="space-y-2">
        {data.queries.map((item, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-3 hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* 排名 */}
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-red-100 text-red-700' :
                index === 1 ? 'bg-orange-100 text-orange-700' :
                index === 2 ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {index + 1}
              </div>

              {/* 查詢內容 */}
              <div className="flex-1 min-w-0">
                <p className="text-base text-text font-medium break-words">
                  {item.query}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-label">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    查詢 {item.count} 次
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    最後查詢：{formatDate(item.lastQueriedAt)}
                  </span>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={() => handleIgnoreQuery(item.query)}
                  disabled={ignoringQuery === item.query}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="忽略此查詢"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  {ignoringQuery === item.query ? '處理中...' : '忽略'}
                </button>
                <button
                  onClick={() => onCreateFaq(item.query)}
                  className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  創建 FAQ
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 批量操作提示 */}
      {data.queries.length > 3 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-sm text-label">
            💡 建議優先處理前 5 個高頻查詢，可以有效降低零結果率
          </p>
        </div>
      )}
    </div>
  );
}
