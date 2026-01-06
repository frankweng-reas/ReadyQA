/**
 * FAQ related types
 */

export interface FAQ {
  faqId: string;
  chatbotId: string;
  userId: number;
  tenantId?: string;
  question: string;
  answer: string;
  synonym?: string;
  status: 'active' | 'inactive';
  activeFrom?: Date | string;
  activeUntil?: Date | string;
  topicId?: string;
  layout: 'text' | 'image' | 'video';
  images?: string; // JSON string
  hitCount: number;
  lastHitAt?: Date | string;
  descStatus: 'pending' | 'completed' | 'failed';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateFAQDto {
  chatbotId: string;
  question: string;
  answer: string;
  synonym?: string;
  status: 'active' | 'inactive';
  activeFrom?: string;
  activeUntil?: string;
  topicId?: string;
  layout?: 'text' | 'image' | 'video';
  images?: string;
}

export interface UpdateFAQDto {
  question?: string;
  answer?: string;
  synonym?: string;
  status?: 'active' | 'inactive';
  activeFrom?: string;
  activeUntil?: string;
  topicId?: string;
  layout?: 'text' | 'image' | 'video';
  images?: string;
}

export interface FAQResponse {
  success: boolean;
  faq: FAQ;
  message?: string;
}

export interface FAQListResponse {
  success: boolean;
  faqs: FAQ[];
  total?: number;
}

export interface SearchFAQsDto {
  chatbotId: string;
  query: string;
  limit?: number;
}

