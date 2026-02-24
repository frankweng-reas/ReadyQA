/**
 * Topic API 服務
 * 與 Backend API 通訊
 */

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const topicApi = {
  /**
   * 取得 Topic 列表
   */
  async getAll(chatbotId: string): Promise<Topic[]> {
    const response = await fetch(`${API_URL}/topics?chatbotId=${chatbotId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch topics');
    }

    const result = await response.json();
    return result.data || [];
  },

  /**
   * 取得單一 Topic
   */
  async getOne(id: string): Promise<Topic> {
    const response = await fetch(`${API_URL}/topics/${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch topic');
    }

    const result = await response.json();
    return result;
  },

  /**
   * 建立 Topic
   */
  async create(data: {
    chatbotId: string;
    name: string;
    parentId?: string | null;
    sortOrder?: number;
    description?: string | null;
  }): Promise<Topic> {
    // 生成 ID
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    const id = `topic_${timestamp}_${randomStr}`;

    const response = await fetch(`${API_URL}/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        ...data,
        sortOrder: data.sortOrder || 0,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create topic');
    }

    const result = await response.json();
    return result.data || result;
  },

  /**
   * 更新 Topic
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      parentId: string | null;
      sortOrder: number;
      description: string | null;
    }>
  ): Promise<Topic> {
    console.log('[topicApi.update] 更新 Topic:', { id, data });
    
    const response = await fetch(`${API_URL}/topics/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[topicApi.update] 更新失敗:', errorText);
      throw new Error('Failed to update topic');
    }

    const result = await response.json();
    console.log('[topicApi.update] 更新成功:', result);
    return result.data || result;
  },

  /**
   * 刪除 Topic
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/topics/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete topic');
    }
  },
};

