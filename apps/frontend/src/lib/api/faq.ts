/**
 * FAQ API 服務
 * 與 Backend API 通訊
 */

interface FAQ {
  id: string;
  chatbotId: string;
  question: string;
  answer: string;
  synonym: string;
  status: string;
  topicId: string | null;
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
};

