/**
 * Topic 相關型別定義
 * Topic 是 Chatbot 下的知識分類
 */

export interface Topic {
  id: number;
  chatbot_id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTopicDto {
  chatbot_id: number;
  name: string;
  description?: string;
}

export interface UpdateTopicDto {
  name?: string;
  description?: string;
}

export interface TopicWithFaqCount extends Topic {
  faq_count: number;
}

