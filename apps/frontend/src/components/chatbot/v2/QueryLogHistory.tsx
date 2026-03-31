'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';

const PAGE_SIZE = 20;
const QUERY_PREVIEW_LEN = 72;

/** 以 | 連接 sortBy 與 sortOrder，避免欄位名含底線造成解析錯誤 */
type QueryLogSortValue =
  | 'createdAt|desc'
  | 'createdAt|asc'
  | 'resultsCnt|desc'
  | 'resultsCnt|asc'
  | 'readCnt|desc'
  | 'readCnt|asc'
  | 'sessionId|desc'
  | 'sessionId|asc'
  | 'query|asc'
  | 'query|desc';

function parseQueryLogSort(token: string): { sortBy: string; sortOrder: 'asc' | 'desc' } {
  const idx = token.lastIndexOf('|');
  if (idx <= 0) {
    return { sortBy: 'createdAt', sortOrder: 'desc' };
  }
  const sortBy = token.slice(0, idx);
  const sortOrder = token.slice(idx + 1) === 'asc' ? 'asc' : 'desc';
  if (
    !['createdAt', 'resultsCnt', 'readCnt', 'sessionId', 'query'].includes(sortBy)
  ) {
    return { sortBy: 'createdAt', sortOrder: 'desc' };
  }
  return { sortBy, sortOrder };
}

interface QueryLogListItem {
  id: string;
  sessionId: string;
  chatbotId: string;
  query: string;
  resultsCnt: number;
  readCnt: number;
  ignored: boolean;
  createdAt: string;
  session: { id: string };
  _count: { queryLogDetails: number };
}

interface QueryLogDetailRow {
  logId: string;
  faqId: string;
  userAction: string;
  createdAt: string;
  faq: {
    id: string;
    question: string;
    answer: string;
  };
}

interface QueryLogDetailData {
  id: string;
  query: string;
  resultsCnt: number;
  readCnt: number;
  ignored: boolean;
  createdAt: string;
  sessionId: string;
  session?: { id: string };
  queryLogDetails: QueryLogDetailRow[];
}

interface QueryLogHistoryProps {
  chatbotId: string;
}

function buildDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

export default function QueryLogHistory({ chatbotId }: QueryLogHistoryProps) {
  const t = useTranslations('insight');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [sortValue, setSortValue] = useState<QueryLogSortValue>('createdAt|desc');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<QueryLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<QueryLogDetailData | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDateTime = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleString(locale === 'zh-TW' ? 'zh-TW' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return iso;
      }
    },
    [locale],
  );

  const actionLabel = useCallback(
    (action: string) => {
      switch (action) {
        case 'like':
          return t('feedback.like');
        case 'dislike':
          return t('feedback.dislike');
        case 'viewed':
          return t('feedback.viewed');
        case 'not-viewed':
          return t('feedback.notViewed');
        default:
          return action;
      }
    },
    [t],
  );

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { start, end } = buildDateRange(timeRange);
    const params = new URLSearchParams({
      chatbotId,
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    const { sortBy, sortOrder } = parseQueryLogSort(sortValue);
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/query-logs?${params.toString()}`,
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      const result: {
        success?: boolean;
        data?: QueryLogListItem[];
        total?: number;
        message?: string;
      } = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setRows(result.data);
        setTotal(typeof result.total === 'number' ? result.total : 0);
      } else {
        setError(result.message || t('loadError'));
      }
    } catch (err) {
      console.error('[QueryLogHistory] 載入失敗:', err);
      setError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [chatbotId, timeRange, page, sortValue, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setPage(1);
  }, [chatbotId, timeRange, sortValue]);

  const openDetail = async (logId: string) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/query-logs/${logId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result: { success?: boolean; data?: QueryLogDetailData } = await response.json();
      if (result.success && result.data) {
        setDetail(result.data);
      } else {
        setDetailError(t('queryLogs.detailLoadError'));
      }
    } catch (err) {
      console.error('[QueryLogHistory] 詳情載入失敗:', err);
      setDetailError(t('queryLogs.detailLoadError'));
    } finally {
      setDetailLoading(false);
    }
  };

  if (error && rows.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => loadList()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <p className="text-sm text-label px-1">{t('queryLogs.intro')}</p>

      <div className="sticky top-0 z-40 bg-blue-50 shadow-sm border-b border-gray-200 px-4 py-3 -mx-2 flex flex-wrap gap-3 items-center justify-between">
        <button
          type="button"
          onClick={() => loadList()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          title={t('reloadTooltip')}
        >
          <svg
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {t('refresh')}
        </button>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((d) => {
              const labelKey =
                d === 7 ? 'charts.days7' : d === 30 ? 'charts.days30' : 'charts.days90';
              return (
              <button
                key={d}
                type="button"
                onClick={() => setTimeRange(d)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === d ? 'bg-primary text-white' : 'bg-grey text-label hover:bg-gray-200'
                }`}
              >
                {t(labelKey)}
              </button>
            );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center px-1">
        <span className="text-sm text-label">{t('queryLogs.sortLabel')}</span>
        <select
          value={sortValue}
          onChange={(e) => setSortValue(e.target.value as QueryLogSortValue)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white min-w-[12rem]"
          aria-label={t('queryLogs.sortLabel')}
        >
          <option value="createdAt|desc">{t('queryLogs.sortCreatedAtDesc')}</option>
          <option value="createdAt|asc">{t('queryLogs.sortCreatedAtAsc')}</option>
          <option value="resultsCnt|desc">{t('queryLogs.sortResultsCntDesc')}</option>
          <option value="resultsCnt|asc">{t('queryLogs.sortResultsCntAsc')}</option>
          <option value="readCnt|desc">{t('queryLogs.sortReadCntDesc')}</option>
          <option value="readCnt|asc">{t('queryLogs.sortReadCntAsc')}</option>
          <option value="sessionId|desc">{t('queryLogs.sortSessionIdDesc')}</option>
          <option value="sessionId|asc">{t('queryLogs.sortSessionIdAsc')}</option>
          <option value="query|asc">{t('queryLogs.sortQueryAsc')}</option>
          <option value="query|desc">{t('queryLogs.sortQueryDesc')}</option>
        </select>
        <span className="text-sm text-label ml-auto">{t('queryLogs.totalRows', { count: total })}</span>
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-label text-sm">{t('loading')}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-label border-b border-gray-200">
              <tr>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{t('queryLogs.colTime')}</th>
                <th className="text-left font-medium px-3 py-2 min-w-[200px]">{t('queryLogs.colQuery')}</th>
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('queryLogs.colResults')}</th>
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('queryLogs.colRead')}</th>
                <th className="text-left font-medium px-3 py-2 whitespace-nowrap font-mono text-xs">
                  {t('queryLogs.colSession')}
                </th>
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap">{t('queryLogs.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-label">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="px-3 py-2 whitespace-nowrap text-text">{formatDateTime(row.createdAt)}</td>
                    <td className="px-3 py-2 text-text max-w-md" title={row.query}>
                      {truncateText(row.query, QUERY_PREVIEW_LEN)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.resultsCnt}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.readCnt}</td>
                    <td className="px-3 py-2 font-mono text-xs text-label truncate max-w-[120px]" title={row.sessionId}>
                      {truncateText(row.sessionId, 10)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row.id)}
                        className="text-primary hover:underline font-medium"
                      >
                        {t('queryLogs.viewDetail')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <span className="text-sm text-label">{t('queryLogs.pageIndicator', { current: page, total: totalPages })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {t('queryLogs.prevPage')}
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {t('queryLogs.nextPage')}
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        title={t('queryLogs.detailTitle')}
        maxWidth="3xl"
        closeButtonTitle={tCommon('close')}
      >
        {detailLoading && (
          <div className="py-10 text-center text-label">{t('loading')}</div>
        )}
        {detailError && !detailLoading && (
          <div className="py-6 text-center text-red-600">{detailError}</div>
        )}
        {detail && !detailLoading && (
          <div className="space-y-4 text-sm">
            <div>
              <div className="text-label mb-1">{t('queryLogs.detailQuery')}</div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-text whitespace-pre-wrap break-words">
                {detail.query}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-label">
              <span>
                {t('queryLogs.colResults')}: <strong className="text-text">{detail.resultsCnt}</strong>
              </span>
              <span>
                {t('queryLogs.colRead')}: <strong className="text-text">{detail.readCnt}</strong>
              </span>
              <span>
                {t('queryLogs.colTime')}:{' '}
                <strong className="text-text">{formatDateTime(detail.createdAt)}</strong>
              </span>
              {detail.ignored && (
                <span className="text-amber-700">{t('queryLogs.ignoredBadge')}</span>
              )}
            </div>
            <div>
              <div className="text-label mb-1">{t('queryLogs.detailSessionId')}</div>
              <div className="font-mono text-xs break-all text-text">{detail.sessionId}</div>
            </div>
            <div>
              <div className="font-medium text-text mb-2">{t('queryLogs.relatedRecords')}</div>
              {detail.queryLogDetails.length === 0 ? (
                <p className="text-label">{t('queryLogs.noDetails')}</p>
              ) : (
                <ul className="space-y-3">
                  {detail.queryLogDetails.map((d) => (
                    <li
                      key={`${d.logId}-${d.faqId}`}
                      className="rounded-lg border border-gray-200 p-3 bg-white"
                    >
                      <div className="flex flex-wrap justify-between gap-2 mb-1">
                        <span className="font-medium text-text">{d.faq.question}</span>
                        <span className="text-xs text-label whitespace-nowrap">
                          {actionLabel(d.userAction)} · {formatDateTime(d.createdAt)}
                        </span>
                      </div>
                      <p className="text-label text-xs line-clamp-3">{d.faq.answer}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
