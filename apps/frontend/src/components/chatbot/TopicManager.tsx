'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { topicApi } from '@/lib/api/topic';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

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

interface TopicManagerProps {
  chatbotId: string;
  onRefresh?: () => void;
}

interface TopicItemProps {
  topic: Topic;
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

// Topic 項目組件
function TopicItem({
  topic,
  level,
  isExpanded,
  hasChildren,
  canMoveUp,
  canMoveDown,
  onToggleExpand,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TopicItemProps) {
  // 根據層級決定樣式
  const getLevelStyles = () => {
    if (level === 0) {
      return {
        container: 'bg-yellow-50/50 border-yellow-200',
        indicator: 'bg-yellow-200',
        text: 'text-gray-900',
      }
    } else if (level === 1) {
      return {
        container: 'bg-blue-50 border-blue-300',
        indicator: 'bg-blue-200',
        text: 'text-blue-900',
      }
    } else {
      return {
        container: 'bg-purple-50 border-purple-300',
        indicator: 'bg-purple-200',
        text: 'text-purple-900',
      }
    }
  }

  const levelStyles = getLevelStyles()

  return (
    <div className="relative">
      {/* 連接線（層級視覺化） */}
      {level > 0 && (
        <>
          {/* 垂直連接線 */}
          <div
            className="absolute top-0 bottom-0 left-0 border-l-[3px] border-blue-400"
            style={{ left: `${(level - 1) * 32 + 16}px` }}
          />
          {/* 水平連接線 */}
          <div
            className="absolute top-1/2 left-0 border-t-2 border-blue-400"
            style={{ 
              left: `${(level - 1) * 32 + 16}px`,
              width: '16px'
            }}
          />
        </>
      )}

      <div
        className={`flex items-center justify-between px-2 py-0 rounded-lg border ${levelStyles.container} hover:shadow-md mb-3 transition-all`}
        style={{ marginLeft: `${level * 32}px` }}
      >
        {/* 層級指示器 */}
        <div className={`flex items-center justify-center w-5 h-5 rounded-full ${levelStyles.indicator} mr-1 flex-shrink-0`}>
          <span className={`text-xs font-bold ${levelStyles.text}`}>{level + 1}</span>
        </div>

        <div className="flex items-center gap-1 flex-1 min-w-0">
          {/* 展開/摺疊按鈕 */}
          {hasChildren ? (
            <button
              onClick={onToggleExpand}
              className={`p-1 ${levelStyles.text} hover:bg-white/50 rounded-md transition-colors flex-shrink-0`}
              title={isExpanded ? '摺疊' : '展開'}
            >
              <motion.svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </motion.svg>
            </button>
          ) : (
            <div className="w-5 h-5" />
          )}

          {/* Topic 內容 */}
          <div className="flex-1 min-w-0">
            <div className={`font-semibold ${levelStyles.text} truncate`}>
              {topic.name}
              <span className={`font-normal ml-2 ${level === 0 ? 'text-gray-500' : level === 1 ? 'text-blue-600' : 'text-purple-600'}`}>
                ({topic._count?.faqs || 0} 個問答)
              </span>
            </div>
            {topic.description && (
              <div className={`text-sm ${level === 0 ? 'text-gray-600' : level === 1 ? 'text-blue-700' : 'text-purple-700'} truncate`}>
                {topic.description}
              </div>
            )}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center space-x-1 ml-1">
          {/* 順序調整按鈕 */}
          <div className="flex flex-col gap-0.5 border-r border-gray-300 pr-2 mr-1">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className={`px-2 py-1 rounded-md transition-all ${
                canMoveUp 
                  ? 'bg-blue-200 text-blue-800 hover:bg-blue-300 hover:text-blue-900 border border-blue-400' 
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
              title="上移"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={`px-2 py-1 rounded-md transition-all ${
                canMoveDown 
                  ? 'bg-blue-200 text-blue-800 hover:bg-blue-300 hover:text-blue-900 border border-blue-400' 
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
              title="下移"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          <button
            onClick={onEdit}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="編輯"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="刪除"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TopicManager({ chatbotId, onRefresh }: TopicManagerProps) {
  const t = useTranslations('topicManager');
  const tCommon = useTranslations('common');

  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<{ id: string; faqCount: number } | null>(null);

  // 表單狀態
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    description: '',
  });

  // 載入 topics
  const loadTopics = async () => {
    setIsLoading(true);
    try {
      const data = await topicApi.getAll(chatbotId);
      setTopics(data);
      // 預設展開所有分類
      const allTopicIds = new Set<string>(data.map((t) => t.id));
      setExpandedTopics(allTopicIds);
    } catch (error) {
      console.error('載入 Topics 失敗:', error);
      setTopics([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, [chatbotId]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingTopic(null);
    setFormData({
      name: '',
      parentId: '',
      description: '',
    });
    setShowFormModal(true);
  };

  const handleEdit = (topic: Topic) => {
    setEditingTopic(topic);
    setIsCreating(false);
    setFormData({
      name: topic.name,
      parentId: topic.parentId || '',
      description: topic.description || '',
    });
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t('nameRequired'));
      return;
    }

    try {
      const parentId = formData.parentId || null;

      // 檢查層級深度：最多 2 層
      const parentLevel = getTopicLevel(parentId);
      const newLevel = parentLevel + 1;

      if (newLevel > 2) {
        alert(t('maxLevelExceeded'));
        return;
      }

      if (editingTopic) {
        // 更新現有 Topic
        await topicApi.update(editingTopic.id, {
          name: formData.name.trim(),
          parentId: parentId,
          description: formData.description.trim() || null,
        });
      } else {
        // 創建新 Topic
        const siblings = getChildren(parentId);
        const maxSortOrder =
          siblings.length > 0 ? Math.max(...siblings.map((t) => t.sortOrder)) : -1;
        const newSortOrder = maxSortOrder + 1;

        await topicApi.create({
          chatbotId,
          name: formData.name.trim(),
          parentId: parentId,
          sortOrder: newSortOrder,
          description: formData.description.trim() || null,
        });
      }

      loadTopics();
      setShowFormModal(false);
      setIsCreating(false);
      setEditingTopic(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('保存失敗:', error);
      alert(t('saveFailed'));
    }
  };

  const handleDelete = (topicId: string, faqCount: number) => {
    setTopicToDelete({ id: topicId, faqCount });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!topicToDelete) return;

    try {
      await topicApi.delete(topicToDelete.id);
      loadTopics();
      if (onRefresh) onRefresh();
      setShowDeleteConfirm(false);
      setTopicToDelete(null);
    } catch (error) {
      console.error('刪除失敗:', error);
      alert(t('deleteFailed'));
      setShowDeleteConfirm(false);
      setTopicToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setTopicToDelete(null);
  };

  const handleCancel = () => {
    setShowFormModal(false);
    setIsCreating(false);
    setEditingTopic(null);
  };

  const toggleExpand = (topicId: string) => {
    setExpandedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  // 構建樹狀結構 - 獲取指定父節點的子節點
  const getChildren = (parentId: string | null = null): Topic[] => {
    return topics
      .filter((t) => t.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  // 檢查是否有子節點
  const hasChildren = (topicId: string): boolean => {
    return topics.some((t) => t.parentId === topicId);
  };

  // 計算分類的層級深度（從根節點開始，第 1 層 = 1）
  const getTopicLevel = (topicId: string | null): number => {
    if (topicId === null) return 0;

    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return 0;

    if (topic.parentId === null) return 1;

    return getTopicLevel(topic.parentId) + 1;
  };

  // 調整順序：上移
  const handleMoveUp = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    const siblings = getChildren(topic.parentId);
    const currentIndex = siblings.findIndex(t => t.id === topicId);
    
    if (currentIndex <= 0) return; // 已經是最上面了

    const prevTopic = siblings[currentIndex - 1];
    
    // 交換 sortOrder
    try {
      await Promise.all([
        topicApi.update(topicId, { sortOrder: prevTopic.sortOrder }),
        topicApi.update(prevTopic.id, { sortOrder: topic.sortOrder }),
      ]);
      loadTopics();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('[TopicManager] 調整順序失敗:', error);
      alert(t('moveFailed') || '調整順序失敗');
    }
  };

  // 調整順序：下移
  const handleMoveDown = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    const siblings = getChildren(topic.parentId);
    const currentIndex = siblings.findIndex(t => t.id === topicId);
    
    if (currentIndex >= siblings.length - 1) return; // 已經是最下面了

    const nextTopic = siblings[currentIndex + 1];
    
    // 交換 sortOrder
    try {
      await Promise.all([
        topicApi.update(topicId, { sortOrder: nextTopic.sortOrder }),
        topicApi.update(nextTopic.id, { sortOrder: topic.sortOrder }),
      ]);
      loadTopics();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('[TopicManager] 調整順序失敗:', error);
      alert(t('moveFailed') || '調整順序失敗');
    }
  };

  // 遞歸渲染 Topic 樹
  const renderTopicTree = (
    parentId: string | null = null,
    level: number = 0
  ): React.ReactNode => {
    const children = getChildren(parentId);
    if (children.length === 0) return null;

    return children.map((topic, index) => {
      const isExpanded = expandedTopics.has(topic.id);
      const topicHasChildren = hasChildren(topic.id);
      const canMoveUp = index > 0;
      const canMoveDown = index < children.length - 1;

      return (
        <div key={topic.id}>
          <TopicItem
            topic={topic}
            level={level}
            isExpanded={isExpanded}
            hasChildren={topicHasChildren}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onToggleExpand={() => toggleExpand(topic.id)}
            onEdit={() => handleEdit(topic)}
            onDelete={() => handleDelete(topic.id, topic._count?.faqs || 0)}
            onMoveUp={() => handleMoveUp(topic.id)}
            onMoveDown={() => handleMoveDown(topic.id)}
          />

          {/* 遞歸渲染子分類 */}
          {topicHasChildren && isExpanded && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderTopicTree(topic.id, level + 1)}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      );
    });
  };

  // 遞歸渲染階層選項（用於下拉選單）
  const renderTopicOptions = (
    parentId: string | null = null,
    level: number = 0,
    excludeId?: string
  ): React.ReactNode[] => {
    const children = getChildren(parentId);
    const options: React.ReactNode[] = [];

    children.forEach((topic) => {
      // 排除正在編輯的項目及其子項目
      if (excludeId && topic.id === excludeId) return;

      const topicLevel = getTopicLevel(topic.id);

      // 如果該分類已經是第 2 層，不顯示（因為選擇它後會變成第 3 層）
      if (topicLevel >= 2) return;

      // 生成縮排前綴
      const prefix = '　'.repeat(level) + (level > 0 ? '└─ ' : '');
      options.push(
        <option key={topic.id} value={topic.id}>
          {prefix}
          {topic.name}
        </option>
      );

      // 遞歸渲染子項目
      if (topicLevel < 1) {
        const childOptions = renderTopicOptions(topic.id, level + 1, excludeId);
        options.push(...childOptions);
      }
    });

    return options;
  };

  return (
    <>
      <div>
        {/* Header */}
        <div className="bg-cyan-50 border-b border-cyan-200 px-6 py-4 -mx-6 -mt-6 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 pl-2">{t('topics')}</h2>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-cyan-600 text-white rounded-full hover:bg-cyan-700 transition-colors font-medium"
            >
              + {t('createTopic')}
            </button>
          </div>
        </div>

        {/* Topics 列表 */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">{tCommon('loading')}</div>
          ) : topics.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('noTopics')}</div>
          ) : (
            <div>{renderTopicTree(null, 0)}</div>
          )}
        </div>
      </div>

      {/* 表單彈窗 */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-lg shadow-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700">
                <h3 className="text-lg font-semibold text-white">
                  {editingTopic ? t('editTopic') : t('createTopic')}
                </h3>
                <button
                  onClick={handleCancel}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('topicName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('topicNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('parentTopic')}
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">{t('noParent')}</option>
                    {renderTopicOptions(null, 0, editingTopic?.id)}
                  </select>
                  <div className="mt-1.5 text-xs text-gray-500">
                    {(() => {
                      const selectedParentLevel = getTopicLevel(formData.parentId || null);
                      const newLevel = selectedParentLevel + 1;
                      return t('currentLevel', { level: newLevel });
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('descriptionPlaceholder')}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Button variant="ghost" onClick={handleCancel}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!formData.name.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {tCommon('save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('deleteTopic')}
        message={
          topicToDelete && topicToDelete.faqCount > 0
            ? t('deleteConfirmWithFaqs', { faqCount: topicToDelete.faqCount })
            : t('deleteConfirm')
        }
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        type="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}
