import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from './elasticsearch.service';
import { Client } from '@elastic/elasticsearch';

// Mock @elastic/elasticsearch
jest.mock('@elastic/elasticsearch');

describe('ElasticsearchService', () => {
  let service: ElasticsearchService;
  let configService: jest.Mocked<ConfigService>;
  let mockClient: any;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Client - 使用 jest.fn() 創建 mock 函數
    mockClient = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      index: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
      cluster: {
        health: jest.fn(),
      },
    };

    // Mock Client constructor
    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElasticsearchService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ElasticsearchService>(ElasticsearchService);
    configService = module.get(ConfigService);

    // Mock 環境變數
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const envMap: Record<string, any> = {
        ELASTICSEARCH_HOST: 'http://localhost:9200',
        EMBEDDING_DIMENSIONS: '3072',
      };
      return envMap[key] || defaultValue;
    });

    jest.clearAllMocks();
  });

  // ========== createFaqIndex 測試 ==========

  describe('createFaqIndex', () => {
    const chatbotId = 'test-chatbot-1';
    const indexName = `faq_${chatbotId}`;

    beforeEach(() => {
      // Mock client 存在
      (service as any).client = mockClient;
    });

    it('✅ 應該成功創建索引', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({ acknowledged: true });

      const result = await service.createFaqIndex(chatbotId);

      expect(result).toBe(true);
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: indexName });
      expect(mockClient.indices.create).toHaveBeenCalled();
    });

    it('✅ 應該跳過已存在的索引', async () => {
      mockClient.indices.exists.mockResolvedValue(true);

      const result = await service.createFaqIndex(chatbotId);

      expect(result).toBe(true);
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });

    it('✅ 應該強制重新創建索引', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.indices.delete.mockResolvedValue({ acknowledged: true });
      mockClient.indices.create.mockResolvedValue({ acknowledged: true });

      const result = await service.createFaqIndex(chatbotId, true);

      expect(result).toBe(true);
      expect(mockClient.indices.delete).toHaveBeenCalledWith({ index: indexName });
      expect(mockClient.indices.create).toHaveBeenCalled();
    });

    it('✅ 應該處理索引已存在的錯誤（競態條件）', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      const error = new Error('resource_already_exists_exception');
      mockClient.indices.create.mockRejectedValue(error);

      const result = await service.createFaqIndex(chatbotId);

      expect(result).toBe(true); // 視為成功
    });

    it('❌ 應該處理其他錯誤', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      const error = new Error('Unknown error');
      mockClient.indices.create.mockRejectedValue(error);

      const result = await service.createFaqIndex(chatbotId);

      expect(result).toBe(false);
    });

    it('❌ 應該在 client 不存在時返回 false', async () => {
      (service as any).client = null;

      const result = await service.createFaqIndex(chatbotId);

      expect(result).toBe(false);
      expect(mockClient.indices.exists).not.toHaveBeenCalled();
    });
  });

  // ========== deleteFaqIndex 測試 ==========

  describe('deleteFaqIndex', () => {
    const chatbotId = 'test-chatbot-1';
    const indexName = `faq_${chatbotId}`;

    beforeEach(() => {
      (service as any).client = mockClient;
    });

    it('✅ 應該成功刪除索引', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.indices.delete.mockResolvedValue({ acknowledged: true });

      const result = await service.deleteFaqIndex(chatbotId);

      expect(result).toBe(true);
      expect(mockClient.indices.delete).toHaveBeenCalledWith({ index: indexName });
    });

    it('✅ 應該跳過不存在的索引', async () => {
      mockClient.indices.exists.mockResolvedValue(false);

      const result = await service.deleteFaqIndex(chatbotId);

      expect(result).toBe(true);
      expect(mockClient.indices.delete).not.toHaveBeenCalled();
    });

    it('❌ 應該處理刪除錯誤', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      const error = new Error('Delete failed');
      mockClient.indices.delete.mockRejectedValue(error);

      const result = await service.deleteFaqIndex(chatbotId);

      expect(result).toBe(false);
    });

    it('❌ 應該在 client 不存在時返回 false', async () => {
      (service as any).client = null;

      const result = await service.deleteFaqIndex(chatbotId);

      expect(result).toBe(false);
    });
  });

  // ========== saveFaq 測試 ==========

  describe('saveFaq', () => {
    const chatbotId = 'test-chatbot-1';
    const faqId = 'faq-1';
    const question = '如何重置密碼？';
    const answer = '請點擊登入頁面的「忘記密碼」連結';
    const synonym = '忘記密碼,重設密碼';
    const status = 'active';
    const denseVector = new Array(3072).fill(0.1);

    beforeEach(() => {
      (service as any).client = mockClient;
    });

    it('✅ 應該成功保存 FAQ', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.index.mockResolvedValue({ result: 'created' });

      const result = await service.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        synonym,
        status,
        denseVector,
      );

      expect(result).toBe(true);
      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: `faq_${chatbotId}`,
          id: faqId,
          refresh: true,
        }),
      );
    });

    it('✅ 應該自動創建索引（如果不存在）', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({ acknowledged: true });
      mockClient.index.mockResolvedValue({
        result: 'created',
        _id: faqId,
        _index: `faq_${chatbotId}`,
        _shards: { total: 1, successful: 1, failed: 0 },
        _version: 1,
      });

      const result = await service.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        synonym,
        status,
        denseVector,
      );

      expect(result).toBe(true);
      expect(mockClient.indices.create).toHaveBeenCalled();
      expect(mockClient.index).toHaveBeenCalled();
    });

    it('❌ 應該處理索引創建失敗', async () => {
      mockClient.indices.exists.mockResolvedValue(false);
      // Mock createFaqIndex 返回 false（通過 mock create 失敗）
      const createError = new Error('Create failed');
      mockClient.indices.create.mockRejectedValue(createError);

      const result = await service.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        synonym,
        status,
        denseVector,
      );

      expect(result).toBe(false);
      expect(mockClient.index).not.toHaveBeenCalled();
    });

    it('✅ 應該處理空的 synonym', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.index.mockResolvedValue({ result: 'created' });

      const result = await service.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        '',
        status,
        denseVector,
      );

      expect(result).toBe(true);
      const callArgs = (mockClient.index as jest.Mock).mock.calls[0][0];
      expect(callArgs.document.synonym).toBeDefined();
    });

    it('❌ 應該處理保存錯誤', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      const error = new Error('Save failed');
      mockClient.index.mockRejectedValue(error);

      const result = await service.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        synonym,
        status,
        denseVector,
      );

      expect(result).toBe(false);
    });

    it('❌ 應該在 client 不存在時返回 false', async () => {
      (service as any).client = null;

      const result = await service.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        synonym,
        status,
        denseVector,
      );

      expect(result).toBe(false);
    });
  });

  // ========== deleteFaq 測試 ==========

  describe('deleteFaq', () => {
    const chatbotId = 'test-chatbot-1';
    const faqId = 'faq-1';

    beforeEach(() => {
      (service as any).client = mockClient;
    });

    it('✅ 應該成功刪除 FAQ', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.exists.mockResolvedValue(true);
      mockClient.delete.mockResolvedValue({
        result: 'deleted',
        _id: faqId,
        _index: `faq_${chatbotId}`,
        _shards: { total: 1, successful: 1, failed: 0 },
        _version: 1,
      } as any);

      const result = await service.deleteFaq(chatbotId, faqId);

      expect(result).toBe(true);
      expect(mockClient.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          index: `faq_${chatbotId}`,
          id: faqId,
          refresh: true,
        }),
      );
    });

    it('✅ 應該跳過不存在的索引', async () => {
      mockClient.indices.exists.mockResolvedValue(false);

      const result = await service.deleteFaq(chatbotId, faqId);

      expect(result).toBe(true);
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('✅ 應該跳過不存在的文檔', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.exists.mockResolvedValue(false);

      const result = await service.deleteFaq(chatbotId, faqId);

      expect(result).toBe(true);
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('❌ 應該處理刪除錯誤', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.exists.mockResolvedValue(true);
      const error = new Error('Delete failed');
      mockClient.delete.mockRejectedValue(error);

      const result = await service.deleteFaq(chatbotId, faqId);

      expect(result).toBe(false);
    });

    it('❌ 應該在 client 不存在時返回 false', async () => {
      (service as any).client = null;

      const result = await service.deleteFaq(chatbotId, faqId);

      expect(result).toBe(false);
    });
  });

  // ========== hybridSearch 測試 ==========

  describe('hybridSearch', () => {
    const chatbotId = 'test-chatbot-1';
    const query = '如何重置密碼？';
    const denseVector = new Array(3072).fill(0.1);

    beforeEach(() => {
      (service as any).client = mockClient;
    });

    it('✅ 應該成功執行混合搜尋', async () => {
      mockClient.indices.exists.mockResolvedValue(true);

      // Mock BM25 搜尋結果
      const bm25Response = {
        hits: {
          hits: [
            {
              _source: {
                faq_id: 'faq-1',
                question: '如何重置密碼？',
                answer: '答案1',
                synonym: '重置密碼',
              },
            },
          ],
        },
      };

      // Mock kNN 搜尋結果
      const knnResponse = {
        hits: {
          hits: [
            {
              _score: 1.5, // 超過閾值 (0.45 + 1.0 = 1.45)
              _source: {
                faq_id: 'faq-1',
                question: '如何重置密碼？',
                answer: '答案1',
                synonym: '重置密碼',
              },
            },
          ],
        },
      };

      mockClient.search
        .mockResolvedValueOnce(bm25Response as any)
        .mockResolvedValueOnce(knnResponse as any);

      const result = await service.hybridSearch(chatbotId, query, denseVector);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockClient.search).toHaveBeenCalledTimes(2);
    });

    it('✅ 應該返回空結果（索引不存在）', async () => {
      mockClient.indices.exists.mockResolvedValue(false);

      const result = await service.hybridSearch(chatbotId, query, denseVector);

      expect(result).toEqual([]);
      expect(mockClient.search).not.toHaveBeenCalled();
    });

    it('✅ 應該過濾相似度太低的 kNN 結果', async () => {
      mockClient.indices.exists.mockResolvedValue(true);

      const bm25Response = {
        hits: { hits: [] },
      };

      const knnResponse = {
        hits: {
          hits: [
            {
              _score: 1.0, // 低於閾值 (0.45 + 1.0 = 1.45)
              _source: {
                faq_id: 'faq-1',
                question: '問題1',
                answer: '答案1',
              },
            },
          ],
        },
      };

      mockClient.search
        .mockResolvedValueOnce(bm25Response as any)
        .mockResolvedValueOnce(knnResponse as any);

      const result = await service.hybridSearch(chatbotId, query, denseVector);

      // 應該過濾掉低相似度的結果
      expect(result.length).toBe(0);
    });

    it('✅ 應該使用自訂參數', async () => {
      mockClient.indices.exists.mockResolvedValue(true);

      const bm25Response = { hits: { hits: [] } };
      const knnResponse = { hits: { hits: [] } };

      mockClient.search
        .mockResolvedValueOnce(bm25Response as any)
        .mockResolvedValueOnce(knnResponse as any);

      await service.hybridSearch(
        chatbotId,
        query,
        denseVector,
        10, // topK
        0.5, // bm25Weight
        0.5, // knnWeight
        0.6, // simThreshold
        100, // rankConstant
      );

      expect(mockClient.search).toHaveBeenCalledTimes(2);
    });

    it('❌ 應該處理搜尋錯誤', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      const error = new Error('Search failed');
      mockClient.search.mockRejectedValue(error);

      const result = await service.hybridSearch(chatbotId, query, denseVector);

      expect(result).toEqual([]);
    });

    it('❌ 應該在 client 不存在時返回空陣列', async () => {
      (service as any).client = null;

      const result = await service.hybridSearch(chatbotId, query, denseVector);

      expect(result).toEqual([]);
    });
  });

  // ========== isAvailable 測試 ==========

  describe('isAvailable', () => {
    it('✅ 應該返回 true（client 存在）', () => {
      (service as any).client = mockClient;

      const result = service.isAvailable();

      expect(result).toBe(true);
    });

    it('❌ 應該返回 false（client 不存在）', () => {
      (service as any).client = null;

      const result = service.isAvailable();

      expect(result).toBe(false);
    });
  });
});
