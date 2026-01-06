# 階段 1: 共用層開發指南

> 📅 預計時間：2-3 天  
> 🎯 目標：建立可重用的共用層，為後續開發打好基礎

---

## 📋 本階段目標

### 主要成果
1. ✅ 完善的型別定義系統
2. ✅ 統一的驗證機制 (class-validator + Zod)
3. ✅ 統一的錯誤處理
4. ✅ 測試工具與 Fixtures
5. ✅ 日誌系統

---

## 🏗 任務清單

### 1. 完善型別定義 (0.5 天)

#### 新增型別
- [ ] `topic.types.ts` - Topic 相關型別
- [ ] `session.types.ts` - Session 相關型別
- [ ] `tenant.types.ts` - 租戶相關型別
- [ ] `plan.types.ts` - 方案相關型別
- [ ] `metrics.types.ts` - 監控指標型別

#### 優化現有型別
- [ ] 添加更詳細的註解
- [ ] 添加範例值
- [ ] 確保一致性

---

### 2. 驗證機制 (1 天)

#### DTO 驗證 (NestJS)
使用 `class-validator` + `class-transformer`

```typescript
// Example: CreateChatbotDto
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateChatbotDto {
  @IsString()
  chatbotId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['draft', 'active', 'archived'])
  status: string;
}
```

#### Schema 驗證 (Frontend)
使用 `Zod` 進行前端驗證

```typescript
// Example: chatbotSchema
import { z } from 'zod';

export const chatbotSchema = z.object({
  chatbotId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']),
});
```

**任務**:
- [ ] 建立所有 DTO 類別 (Backend)
- [ ] 建立所有 Zod Schema (Frontend)
- [ ] 建立共用驗證工具函數

---

### 3. 錯誤處理機制 (0.5 天)

#### 統一錯誤格式
```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any,
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, `${resource} not found${id ? `: ${id}` : ''}`, 'NOT_FOUND');
  }
}
```

**任務**:
- [ ] 建立錯誤類別層級
- [ ] 建立全域錯誤過濾器 (NestJS)
- [ ] 建立錯誤處理 Hook (React)

---

### 4. 日誌系統 (0.5 天)

#### 使用 Winston (Backend)
```typescript
import * as winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

**任務**:
- [ ] 配置 Winston Logger
- [ ] 建立日誌中介層 (Middleware)
- [ ] 建立結構化日誌格式

---

### 5. 測試工具 (0.5 天)

#### Test Fixtures
```typescript
// fixtures/chatbot.fixture.ts
export const mockChatbot = {
  chatbotId: 'test-chatbot-1',
  name: 'Test Chatbot',
  status: 'active',
  userId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const createMockChatbot = (overrides?: Partial<Chatbot>) => ({
  ...mockChatbot,
  ...overrides,
});
```

#### Test Utilities
```typescript
// test/utils.ts
export const mockPrismaService = {
  chatbot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
```

**任務**:
- [ ] 建立測試 Fixtures
- [ ] 建立測試工具函數
- [ ] 建立 Mock 服務

---

## 🔍 Review 檢查點

### 可重用性檢查

#### 型別定義
- [ ] 所有型別都有清楚的註解
- [ ] 前後端可共用型別
- [ ] 有範例值參考

#### 驗證機制
- [ ] DTO 和 Schema 保持一致
- [ ] 驗證錯誤訊息友善
- [ ] 可擴展新的驗證規則

#### 錯誤處理
- [ ] 錯誤格式統一
- [ ] 錯誤訊息國際化準備
- [ ] 開發/生產環境不同處理

#### 日誌系統
- [ ] 日誌格式結構化
- [ ] 敏感資訊已遮蔽
- [ ] 支援不同日誌等級

#### 測試工具
- [ ] Fixtures 可重用
- [ ] Mock 服務完整
- [ ] 測試輔助函數充足

---

## 🧪 測試策略

### 單元測試
每個工具函數都要有測試：
```typescript
describe('isValidEmail', () => {
  it('should return true for valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
  });
});
```

### 測試覆蓋率目標
- [ ] Utils: 100%
- [ ] Validators: 100%
- [ ] Error Classes: 100%

---

## 📊 完成標準

### 必須完成
- [ ] 所有核心型別定義完成
- [ ] DTO 和 Schema 建立
- [ ] 錯誤處理機制實作
- [ ] 日誌系統配置
- [ ] 測試工具建立

### 驗收測試
- [ ] 所有單元測試通過
- [ ] 測試覆蓋率 >= 90%
- [ ] TypeScript 編譯無錯誤
- [ ] ESLint 檢查通過

### 文檔完成
- [ ] API 型別有完整註解
- [ ] 驗證規則有文檔
- [ ] 錯誤代碼有清單
- [ ] 測試工具有使用範例

---

## 🚀 下一階段預告

### 階段 2: 資料層開發 (3-4 天)
1. Prisma Schema 定義
2. Repository Pattern 實作
3. 資料庫 Migration 管理
4. Seeds 資料建立

---

**文檔版本**: v1.0  
**建立日期**: 2026-01-06

