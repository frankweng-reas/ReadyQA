'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ZeroResultQueriesDetail from './ZeroResultQueriesDetail';

interface KPI {
  totalQueries: number;
  queriesGrowth: number;
  totalFaqs: number;
  activeFaqs: number;
  totalSessions: number;
  activeSessions: number;
  avgSatisfaction: number;
}

interface QueryTrendItem {
  date: string;
  count: number;
}

interface TopFaq {
  id: string;
  question: string;
  hitCount: number;
}

interface TopDislikedFaq {
  id: string;
  question: string;
  dislikeCount: number;
}

interface FeedbackDistribution {
  like: number;
  dislike: number;
  viewed: number;
}

interface Performance {
  avgResultsCnt: number;
  avgReadCnt: number;
  ignoredRate: number;
  conversionRate: number;
}

interface TopicDistributionItem {
  topicName: string;
  count: number;
}

interface Alerts {
  noResultQueries: number;
  negativeFeedback: number;
  emptyTopics: number;
}

interface QueryResultEffectiveness {
  total: number;
  withResults: number;
  noResults: number;
  successRate: number;
}

interface OverviewData {
  kpi: KPI;
  queryTrend: QueryTrendItem[];
  topFaqs: TopFaq[];
  topDislikedFaqs: TopDislikedFaq[];
  feedbackDistribution: FeedbackDistribution;
  performance: Performance;
  topicDistribution: TopicDistributionItem[];
  queryResultEffectiveness: QueryResultEffectiveness;
  alerts: Alerts;
}

interface OverviewStatsProps {
  chatbotId: string;
  onCreateFaq?: (question: string) => void;
  onEditFaq?: (faqId: string) => void;
}

export default function OverviewStats({ chatbotId, onCreateFaq, onEditFaq }: OverviewStatsProps) {
  const t = useTranslations('insight');
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [isTopFaqsExpanded, setIsTopFaqsExpanded] = useState(false);
  const [isTopDislikedExpanded, setIsTopDislikedExpanded] = useState(false);
  const [isZeroResultExpanded, setIsZeroResultExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, [chatbotId, timeRange]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[OverviewStats] 載入數據:', { chatbotId, timeRange });
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chatbots/${chatbotId}/overview-stats?days=${timeRange}`
      );
      console.log('[OverviewStats] 回應狀態:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OverviewStats] API 錯誤:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('[OverviewStats] 回應數據:', result);
      
      if (result.success) {
        setData(result.data);
      } else {
        console.error('[OverviewStats] API 返回失敗:', result);
        setError(result.message || t('loadError'));
      }
    } catch (err) {
      console.error('[OverviewStats] 載入失敗:', err);
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-label">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-red-500 font-medium mb-2">{error || t('loadError')}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 時間範圍選擇器與刷新按鈕 - 固定在上方 */}
      <div className="sticky top-0 z-50 bg-blue-50 shadow-sm border-b border-gray-200 px-6 py-4 mb-6 -mx-6 flex justify-between items-center">
        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="重新載入數據"
        >
          <svg 
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>

        <div className="flex gap-2">
        <button
          onClick={() => setTimeRange(7)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            timeRange === 7
              ? 'bg-primary text-white'
              : 'bg-grey text-label hover:bg-gray-200'
          }`}
        >
          {t('charts.days7')}
        </button>
        <button
          onClick={() => setTimeRange(30)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            timeRange === 30
              ? 'bg-primary text-white'
              : 'bg-grey text-label hover:bg-gray-200'
          }`}
        >
          {t('charts.days30')}
        </button>
        <button
          onClick={() => setTimeRange(90)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            timeRange === 90
              ? 'bg-primary text-white'
              : 'bg-grey text-label hover:bg-gray-200'
          }`}
        >
          {t('charts.days90')}
        </button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 總查詢次數 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-label">{t('kpi.totalQueries')}</span>
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-text mb-1">
            {data.kpi.totalQueries.toLocaleString()}
          </div>
          {data.kpi.queriesGrowth !== 0 && (
            <div className={`text-sm flex items-center ${
              data.kpi.queriesGrowth > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {data.kpi.queriesGrowth > 0 ? '↑' : '↓'} {Math.abs(data.kpi.queriesGrowth)}% {t('kpi.growth')}
            </div>
          )}
        </div>

        {/* 問答卡片數 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-label">{t('kpi.totalFaqs')}</span>
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-text mb-1">
            {data.kpi.totalFaqs}
          </div>
          <div className="text-sm text-label">
            {data.kpi.activeFaqs} 啟用
          </div>
        </div>

        {/* 查詢成功率 */}
        {data.queryResultEffectiveness && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-label">{t('kpi.querySuccessRate')}</span>
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-3xl font-bold text-text mb-1">
              {data.queryResultEffectiveness.successRate}%
            </div>
            <div className="text-sm text-label">
              {data.queryResultEffectiveness.withResults} / {data.queryResultEffectiveness.total}
            </div>
          </div>
        )}

        {/* 回饋狀態 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-label">{t('kpi.feedbackStatus')}</span>
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-text mb-1">
            {data.kpi.totalQueries > 0 
              ? `${((data.feedbackDistribution.like + data.feedbackDistribution.dislike) / data.kpi.totalQueries * 100).toFixed(1)}%`
              : '0%'
            }
          </div>
          <div className="text-sm text-label">
            {data.feedbackDistribution.like + data.feedbackDistribution.dislike} / {data.kpi.totalQueries}
          </div>
        </div>
      </div>

      {/* 用戶反饋分佈 與 分類查詢分佈 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 用戶反饋分佈 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <h3 className="text-lg font-semibold text-text mb-4">{t('charts.feedbackDistribution')}</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-label">👍 {t('feedback.like')}</span>
                <span className="text-sm font-medium text-text">{data.feedbackDistribution.like}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(data.feedbackDistribution.like / (data.feedbackDistribution.like + data.feedbackDistribution.dislike + data.feedbackDistribution.viewed || 1)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-label">👎 {t('feedback.dislike')}</span>
                <span className="text-sm font-medium text-text">{data.feedbackDistribution.dislike}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(data.feedbackDistribution.dislike / (data.feedbackDistribution.like + data.feedbackDistribution.dislike + data.feedbackDistribution.viewed || 1)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-label">👁 {t('feedback.viewed')}</span>
                <span className="text-sm font-medium text-text">{data.feedbackDistribution.viewed}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(data.feedbackDistribution.viewed / (data.feedbackDistribution.like + data.feedbackDistribution.dislike + data.feedbackDistribution.viewed || 1)) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* 分類查詢分佈 */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <h3 className="text-lg font-semibold text-text mb-4">{t('charts.topicDistribution')}</h3>
          {data.topicDistribution.length === 0 ? (
            <p className="text-label text-center py-6">{t('noData')}</p>
          ) : (
            <div className="space-y-3">
              {data.topicDistribution.map((topic, index) => {
                const maxCount = Math.max(...data.topicDistribution.map(t => t.count));
                const percentage = (topic.count / maxCount) * 100;
                
                return (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-text">{topic.topicName}</span>
                      <span className="text-sm font-medium text-primary">{topic.count} {t('hitCount')}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 無結果查詢卡片 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <button
            onClick={() => setIsZeroResultExpanded(!isZeroResultExpanded)}
            className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-text">無結果查詢</h3>
              <span className="text-sm text-label">
                {t('zeroResultSummary', { 
                  days: timeRange, 
                  count: data.alerts.noResultQueries 
                })}
              </span>
            </div>
            <svg 
              className={`w-5 h-5 text-label transition-transform ${isZeroResultExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 零結果查詢詳細資料 */}
          {isZeroResultExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              {data.alerts.noResultQueries === 0 ? (
                <p className="text-label text-center py-6">{t('noData')}</p>
              ) : (
                <ZeroResultQueriesDetail
                  chatbotId={chatbotId}
                  timeRange={timeRange}
                  onCreateFaq={(question) => {
                    if (onCreateFaq) {
                      onCreateFaq(question);
                    } else {
                      console.warn('[OverviewStats] onCreateFaq callback not provided');
                    }
                  }}
                />
              )}
            </div>
          )}
      </div>

      {/* 熱門問答 TOP 10 - 可折疊 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
        <button
          onClick={() => setIsTopFaqsExpanded(!isTopFaqsExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <h3 className="text-lg font-semibold text-text">{t('charts.topFaqs')}</h3>
          <svg 
            className={`w-5 h-5 text-label transition-transform ${isTopFaqsExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isTopFaqsExpanded && (
          <div className="mt-3">
            {data.topFaqs.length === 0 ? (
              <p className="text-label text-center py-6">{t('noData')}</p>
            ) : (
              <div className="space-y-1">
                {data.topFaqs.map((faq, index) => (
                  <div key={faq.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-grey transition-colors group">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{faq.question}</p>
                    </div>
                    <div className="flex-shrink-0 text-sm font-medium text-primary">
                      {faq.hitCount} {t('hitCount')}
                    </div>
                    <button
                      onClick={() => {
                        if (onEditFaq) {
                          onEditFaq(faq.id);
                        } else {
                          console.warn('[OverviewStats] onEditFaq callback not provided');
                        }
                      }}
                      className="flex-shrink-0 p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="編輯"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 不滿意回答 TOP 10 - 可折疊 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-md">
          <button
            onClick={() => setIsTopDislikedExpanded(!isTopDislikedExpanded)}
            className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          >
            <h3 className="text-lg font-semibold text-text">{t('charts.topDislikedFaqs')}</h3>
            <svg 
              className={`w-5 h-5 text-label transition-transform ${isTopDislikedExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isTopDislikedExpanded && (
            <div className="mt-3">
              {!data.topDislikedFaqs || data.topDislikedFaqs.length === 0 ? (
                <p className="text-label text-center py-6">{t('noData')}</p>
              ) : (
                <div className="space-y-1">
                  {data.topDislikedFaqs.map((faq, index) => (
                  <div key={faq.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-grey transition-colors group">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-red-100 text-red-700' :
                      index === 1 ? 'bg-orange-100 text-orange-600' :
                      index === 2 ? 'bg-yellow-100 text-yellow-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{faq.question}</p>
                    </div>
                    <div className="flex-shrink-0 text-sm font-medium text-red-600">
                      👎 {faq.dislikeCount} {t('dislikeCount')}
                    </div>
                    <button
                      onClick={() => {
                        if (onEditFaq) {
                          onEditFaq(faq.id);
                        } else {
                          console.warn('[OverviewStats] onEditFaq callback not provided');
                        }
                      }}
                      className="flex-shrink-0 p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="編輯"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
