/**
 * FAQ API 服務
 * 與 Backend API 通訊
 */

export interface FAQ {
  id: string;
  chatbotId: string;
  question: string;
  answer: string;
  synonym: string;
  status: string;
  topicId: string | null;
  sortOrder?: number;
  hitCount: number;
  activeFrom: Date | null;
  activeUntil: Date | null;
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const faqApi = {
  /**
   * 取得 FAQ 列表
   */
  async getAll(chatbotId: string, topicId?: string, searchQuery?: string, statusFilter?: string): Promise<FAQ[]> {
    const params = new URLSearchParams();
    params.append('chatbotId', chatbotId);
    params.append('limit', '500');
    if (topicId) params.append('topicId', topicId);
    if (searchQuery) params.append('search', searchQuery);
    if (statusFilter) params.append('status', statusFilter);

    const response = await fetch(`${API_URL}/faqs?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch FAQs');
    }

    const result = await response.json();
    return result.data || [];
  },

  /**
   * 取得單一 FAQ
   */
  async getOne(id: string): Promise<FAQ> {
    const response = await fetch(`${API_URL}/faqs/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch FAQ');
    }

    return await response.json();
  },

  /**
   * 建立 FAQ
   */
  async create(data: {
    id: string;
    chatbotId: string;
    question: string;
    answer: string;
    synonym?: string;
    status?: string;
    topicId?: string | null;
  }): Promise<FAQ> {
    const response = await fetch(`${API_URL}/faqs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create FAQ');
    }

    return await response.json();
  },

  /**
   * 更新 FAQ
   */
  async update(
    id: string,
    data: Partial<{
      question: string;
      answer: string;
      synonym: string;
      status: string;
      topicId: string | null;
    }>
  ): Promise<FAQ> {
    const response = await fetch(`${API_URL}/faqs/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update FAQ');
    }

    return await response.json();
  },

  /**
   * 刪除 FAQ
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/faqs/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete FAQ');
    }
  },

  /**
   * 批量更新 FAQ 排序
   */
  async batchUpdateSortOrder(
    chatbotId: string,
    updates: Array<{ id: string; sortOrder: number }>
  ): Promise<{ success: boolean; data: { success: boolean; updated: number } }> {
    console.log('[faqApi] batchUpdateSortOrder:', { chatbotId, updatesCount: updates.length });
    
    const response = await fetch(`${API_URL}/faqs/batch-sort`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatbotId,
        updates,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error('[faqApi] batchUpdateSortOrder 失敗:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        requestBody: { chatbotId, updates },
      });
      // 提取詳細錯誤訊息
      const errorMessage = errorData.message || errorData.error || errorText || 'Failed to update sort order';
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[faqApi] batchUpdateSortOrder 成功:', result);
    return result;
  },
};

