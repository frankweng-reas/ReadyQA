'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { topicApi } from '@/lib/api/topic';
import { faqApi, type FAQ } from '@/lib/api/faq';
import { useNotification } from '@/hooks/useNotification';
import { layout } from '@/config/layout';

interface Topic {
  id: string;
  chatbotId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    faqs: number;
    children: number;
  };
}

interface SortableItem {
  id: string;
  type: 'topic' | 'faq';
  data: Topic | FAQ;
  topicId?: string | null; // FAQ 的 topicId
}

interface SortManagerProps {
  chatbotId: string;
  onRefresh?: () => void;
}

// 排序項目組件
function SortableItemComponent({
  item,
  index,
}: {
  item: SortableItem;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isTopic = item.type === 'topic';
  const topic = isTopic ? (item.data as Topic) : null;
  const faq = !isTopic ? (item.data as FAQ) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
        isTopic
          ? 'bg-blue-50 border-blue-200 hover:border-blue-300'
          : 'bg-white border-gray-200 hover:border-gray-300 pl-12'
      } ${isDragging ? 'shadow-lg' : 'shadow-sm hover:shadow-md'}`}
    >
      {/* 拖曳手柄 */}
      {isTopic ? (
        <div className="text-gray-300 flex-shrink-0 cursor-not-allowed" title="分類排序請使用分類管理">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      ) : (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}

      {/* 序號 */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
        {index + 1}
      </div>

      {/* 內容 */}
      <div className="flex-1 min-w-0">
        {isTopic ? (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="font-medium text-gray-800 text-lg">{topic?.name}</span>
            {topic?._count?.faqs !== undefined && (
              <span className="text-sm text-gray-500">({topic._count.faqs} 個問答)</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-700 truncate">{faq?.question}</span>
            {item.topicId && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">分類中</span>
            )}
            {!item.topicId && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">未分類</span>
            )}
          </div>
        )}
      </div>

      {/* 排序值顯示 */}
      <div className="flex-shrink-0 text-sm text-gray-500">
        {isTopic ? `排序: ${topic?.sortOrder}` : `排序: ${faq?.sortOrder ?? 0}`}
      </div>
    </div>
  );
}

export default function SortManager({ chatbotId, onRefresh }: SortManagerProps) {
  const t = useTranslations('knowledge');
  const tCommon = useTranslations('common');
  const notify = useNotification();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [items, setItems] = useState<SortableItem[]>([]);
  const [categorizedItems, setCategorizedItems] = useState<SortableItem[]>([]);
  const [uncategorizedItems, setUncategorizedItems] = useState<SortableItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 拖曳感應器設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 載入資料
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [topicsData, faqsData] = await Promise.all([
        topicApi.getAll(chatbotId),
        faqApi.getAll(chatbotId, undefined, undefined, 'active'),
      ]);

      setTopics(topicsData);
      setFaqs(faqsData);

      // 構建扁平化列表：先按 sortOrder 排序，然後合併
      const sortedTopics = [...topicsData]
        .filter(t => t.parentId === null) // 只顯示頂層 topics
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const sortedFaqs = [...faqsData].sort((a, b) => {
        const sortDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
        if (sortDiff !== 0) return sortDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // 構建已分類列表：Topic + 其下的 FAQs
      const categorized: SortableItem[] = [];

      sortedTopics.forEach(topic => {
        // 添加 Topic
        categorized.push({
          id: `topic_${topic.id}`,
          type: 'topic',
          data: topic,
        });

        // 添加該 Topic 下的 FAQs
        const topicFaqs = sortedFaqs.filter(f => f.topicId === topic.id);
        topicFaqs.forEach(faq => {
          categorized.push({
            id: `faq_${faq.id}`,
            type: 'faq',
            data: faq,
            topicId: faq.topicId,
          });
        });
      });

      // 構建未分類列表
      const uncategorized: SortableItem[] = [];
      const uncategorizedFaqs = sortedFaqs.filter(f => !f.topicId);
      uncategorizedFaqs.forEach(faq => {
        uncategorized.push({
          id: `faq_${faq.id}`,
          type: 'faq',
          data: faq,
          topicId: null,
        });
      });

      setCategorizedItems(categorized);
      setUncategorizedItems(uncategorized);
      // 保留 items 用於拖曳（合併兩個列表）
      setItems([...categorized, ...uncategorized]);
    } catch (error) {
      console.error('[SortManager] 載入資料失敗:', error);
      notify.error('載入資料失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 當 chatbotId 改變時重新載入資料
    if (chatbotId) {
      loadData();
    }
  }, [chatbotId]);

  // 處理拖曳結束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // 防止並發操作
    if (isSaving || isLoading) {
      console.warn('[SortManager] 正在處理中，請稍候');
      return;
    }

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedItem = items[oldIndex];
    const targetItem = items[newIndex];

    // 只允許排序 FAQs，不允許排序 Topics
    // Topics 的排序應該在 TopicManager 中處理
    if (draggedItem.type === 'topic') {
      console.warn('[SortManager] Topics 不允許在此處排序，請使用 TopicManager');
      return;
    }

    // 如果拖曳的是 FAQ，只更新該 FAQ 所屬 Topic 組內的 FAQs
    if (draggedItem.type !== targetItem.type) {
      // 跨類型拖曳不允許（Topic 和 FAQ 不能互換位置）
      console.warn('[SortManager] 不允許跨類型拖曳');
      return;
    }

    // 檢查是否跨區塊拖曳（已分類 <-> 未分類）
    const draggedIsUncategorized = draggedItem.topicId === null;
    const targetIsUncategorized = targetItem.topicId === null;
    
    if (draggedIsUncategorized !== targetIsUncategorized) {
      // 不允許跨區塊拖曳（已分類和未分類不能互換位置）
      console.warn('[SortManager] 不允許跨區塊拖曳（已分類和未分類）');
      return;
    }

    try {
      setIsSaving(true);

      // 重新排序項目（在檢查通過後才執行）
      const reorderedItems = arrayMove(items, oldIndex, newIndex);

      // 準備批量更新（只更新受影響的項目）
      const topicUpdates: Array<{ id: string; sortOrder: number; oldSortOrder: number }> = [];
      const faqUpdates: Array<{ id: string; sortOrder: number; oldSortOrder: number }> = [];

      if (draggedItem.type === 'topic') {
        // 只更新 Topics：找出受影響的範圍
        const topLevelTopics = reorderedItems.filter(item => item.type === 'topic');
        const draggedTopic = draggedItem.data as Topic;
        const oldTopicIndex = items
          .filter(item => item.type === 'topic')
          .findIndex(item => item.id === draggedItem.id);
        const newTopicIndex = reorderedItems
          .filter(item => item.type === 'topic')
          .findIndex(item => item.id === draggedItem.id);

        // 只更新受影響範圍內的 Topics（從 min 到 max）
        const affectedRange = {
          start: Math.min(oldTopicIndex, newTopicIndex),
          end: Math.max(oldTopicIndex, newTopicIndex),
        };

        topLevelTopics.forEach((item, index) => {
          const topic = item.data as Topic;
          // 只更新受影響範圍內的項目，或 sortOrder 實際變化的項目
          if (
            index >= affectedRange.start &&
            index <= affectedRange.end &&
            topic.sortOrder !== index
          ) {
            topicUpdates.push({
              id: topic.id,
              sortOrder: index,
              oldSortOrder: topic.sortOrder,
            });
          }
        });
      } else {
        // 只更新 FAQs：找出受影響的 Topic 組或未分類組
        const draggedFaq = draggedItem.data as FAQ;
        const draggedTopicId = draggedFaq.topicId || null;

        // 找出該 Topic 組內的所有 FAQs（在原始 items 中）
        const originalGroupItems: Array<{ item: SortableItem; position: number }> = [];
        items.forEach((item, index) => {
          if (item.type === 'faq') {
            const faq = item.data as FAQ;
            const topicId = faq.topicId || null;
            if (topicId === draggedTopicId) {
              originalGroupItems.push({ item, position: index });
            }
          }
        });

        // 找出該 Topic 組內的所有 FAQs（在 reorderedItems 中）
        const reorderedGroupItems: Array<{ item: SortableItem; position: number }> = [];
        reorderedItems.forEach((item, index) => {
          if (item.type === 'faq') {
            const faq = item.data as FAQ;
            const topicId = faq.topicId || null;
            if (topicId === draggedTopicId) {
              reorderedGroupItems.push({ item, position: index });
            }
          }
        });

        // 按位置排序
        originalGroupItems.sort((a, b) => a.position - b.position);
        reorderedGroupItems.sort((a, b) => a.position - b.position);

        // 找出在組內的相對位置（舊位置）
        const oldFaqIndex = originalGroupItems.findIndex(({ item }) => item.id === draggedItem.id);
        // 找出在組內的相對位置（新位置）
        const newFaqIndex = reorderedGroupItems.findIndex(({ item }) => item.id === draggedItem.id);

        // 如果找不到索引，可能是因為跨區塊拖曳被阻止了，這裡應該不會執行到
        if (oldFaqIndex === -1 || newFaqIndex === -1) {
          console.warn('[SortManager] 無法找到 FAQ 在組內的位置', {
            draggedItemId: draggedItem.id,
            draggedTopicId,
            oldFaqIndex,
            newFaqIndex,
            originalGroupCount: originalGroupItems.length,
            reorderedGroupCount: reorderedGroupItems.length,
          });
          setIsSaving(false);
          return;
        }

        const affectedRange = {
          start: Math.min(oldFaqIndex, newFaqIndex),
          end: Math.max(oldFaqIndex, newFaqIndex),
        };

        // 使用 reorderedGroupItems 來計算新的 sortOrder
        reorderedGroupItems.forEach(({ item }, index) => {
          const faq = item.data as FAQ;
          // 只更新受影響範圍內的項目，或 sortOrder 實際變化的項目
          if (
            index >= affectedRange.start &&
            index <= affectedRange.end &&
            faq.sortOrder !== index
          ) {
            faqUpdates.push({
              id: faq.id,
              sortOrder: index,
              oldSortOrder: faq.sortOrder,
            });
          }
        });
      }

      // 批量更新（只更新受影響的項目）
      const updatePromises: Promise<any>[] = [];

      // 更新 Topics（只更新受影響的）
      if (topicUpdates.length > 0) {
        console.log(`[SortManager] 準備更新 ${topicUpdates.length} 個 Topics (受影響範圍)`);
        topicUpdates.forEach(update => {
          updatePromises.push(topicApi.update(update.id, { sortOrder: update.sortOrder }));
        });
      }

      // 更新 FAQs（只更新受影響的）
      if (faqUpdates.length > 0) {
        console.log(`[SortManager] 準備更新 ${faqUpdates.length} 個 FAQs (受影響範圍)`);
        // 只傳送需要更新的項目（不包含 sortOrder）
        const updatesToSend = faqUpdates.map(({ id, sortOrder }) => ({ id, sortOrder }));
        updatePromises.push(faqApi.batchUpdateSortOrder(chatbotId, updatesToSend));
      }

      if (updatePromises.length === 0) {
        console.warn('[SortManager] 沒有需要更新的項目（sortOrder 沒有變化）');
        // 即使沒有更新，也要更新本地狀態以反映拖曳結果
        setItems(reorderedItems);
        
        // 更新分區狀態
        const newCategorized: SortableItem[] = [];
        const newUncategorized: SortableItem[] = [];
        
        reorderedItems.forEach(item => {
          if (item.type === 'topic' || (item.type === 'faq' && item.topicId !== null)) {
            newCategorized.push(item);
          } else if (item.type === 'faq' && item.topicId === null) {
            newUncategorized.push(item);
          }
        });
        
        setCategorizedItems(newCategorized);
        setUncategorizedItems(newUncategorized);
        setIsSaving(false);
        return;
      }

      console.log(`[SortManager] 開始批量更新，共 ${updatePromises.length} 個請求（優化後只更新受影響項目）`);
      await Promise.all(updatePromises);
      console.log('[SortManager] 批量更新完成');

      // 更新本地狀態
      setItems(reorderedItems);
      
      // 更新分區狀態
      const newCategorized: SortableItem[] = [];
      const newUncategorized: SortableItem[] = [];
      
      reorderedItems.forEach(item => {
        if (item.type === 'topic' || (item.type === 'faq' && item.topicId !== null)) {
          newCategorized.push(item);
        } else if (item.type === 'faq' && item.topicId === null) {
          newUncategorized.push(item);
        }
      });
      
      setCategorizedItems(newCategorized);
      setUncategorizedItems(newUncategorized);

      notify.success('排序已更新');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('[SortManager] 更新排序失敗:', error);
      const errorMessage = error?.message || '更新排序失敗，請稍後再試';
      console.error('[SortManager] 錯誤詳情:', {
        message: errorMessage,
        stack: error?.stack,
        error,
      });
      notify.error(errorMessage);
      // 重新載入資料以恢復原狀
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 說明文字 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-blue-800 font-medium mb-1">排序管理說明</p>
            <p className="text-sm text-blue-700">
              拖曳問答左側圖標來調整順序。分類僅供參考，分類排序請使用「分類管理」功能。
            </p>
          </div>
        </div>
      </div>

      {/* 排序列表 */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">目前沒有可排序的項目</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              {/* 已分類區塊 */}
              {categorizedItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-700">已分類問答</h3>
                  </div>
                  {categorizedItems.map((item, index) => (
                    <SortableItemComponent key={item.id} item={item} index={index} />
                  ))}
                </div>
              )}

              {/* 未分類區塊 */}
              {uncategorizedItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-700">未分類問答</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {uncategorizedItems.length} 個
                    </span>
                  </div>
                  {uncategorizedItems.map((item, index) => (
                    <SortableItemComponent 
                      key={item.id} 
                      item={item} 
                      index={index} 
                    />
                  ))}
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 儲存狀態提示 */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>正在儲存排序...</span>
        </div>
      )}
    </div>
  );
}
