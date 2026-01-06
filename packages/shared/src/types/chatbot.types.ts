/**
 * Chatbot related types
 */

export interface ChatbotTheme {
  primaryColor: string;
  chatWindowWidth: string;
  chatWindowHeight: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface DomainWhitelist {
  enabled: boolean;
  domains: string[];
}

export interface Chatbot {
  chatbotId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  isactive: 'Y' | 'N';
  userId: number;
  tenantId?: string;
  theme?: ChatbotTheme;
  domainWhitelist?: DomainWhitelist;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateChatbotDto {
  chatbotId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  userId: number;
  theme?: ChatbotTheme;
  domainWhitelist?: DomainWhitelist;
}

export interface UpdateChatbotDto {
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  isactive?: 'Y' | 'N';
  theme?: ChatbotTheme;
  domainWhitelist?: DomainWhitelist;
}

export interface ChatbotResponse {
  success: boolean;
  chatbot: Chatbot;
  message?: string;
}

export interface ChatbotListResponse {
  success: boolean;
  chatbots: Chatbot[];
  total?: number;
}

