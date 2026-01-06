import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { Converter } from 'opencc-js';

/**
 * Elasticsearch 服務
 * 提供 FAQ 索引管理功能
 */
@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client | null = null;
  private readonly embeddingDimensions: number;
  private readonly converter: (text: string) => string;
  private readonly stopWords = ['嗎', '呢', '吧', '啊', '呀', '了', '可以'];

  constructor(private readonly configService: ConfigService) {
    // 從環境變數讀取向量維度（默認 3072）
    this.embeddingDimensions = parseInt(
      this.configService.get<string>('EMBEDDING_DIMENSIONS', '3072'),
      10,
    );

    // 初始化 OpenCC 轉換器（繁體轉簡體）
    this.converter = Converter({ from: 'tw', to: 'cn' });
    this.logger.log('✅ OpenCC 轉換器初始化成功 (tw → cn)');
  }

  async onModuleInit() {
    await this.initializeClient();
  }

  /**
   * 初始化 Elasticsearch 客戶端
   */
  private async initializeClient() {
    const esHost = this.configService.get<string>('ELASTICSEARCH_HOST');
    const esUsername = this.configService.get<string>('ELASTICSEARCH_USERNAME');
    const esPassword = this.configService.get<string>('ELASTICSEARCH_PASSWORD');
    const esApiKey = this.configService.get<string>('ELASTICSEARCH_API_KEY');

    // 如果沒有配置 ES，跳過初始化（允許 ES 為可選）
    if (!esHost) {
      this.logger.warn(
        'ELASTICSEARCH_HOST 未配置，Elasticsearch 功能將被禁用',
      );
      return;
    }

    try {
      const connectionParams: any = {
        node: esHost,
        requestTimeout: 30000,
        maxRetries: 3,
        // 開發環境可以關閉 SSL 驗證
        tls: {
          rejectUnauthorized: false,
        },
      };

      // 優先使用 API Key
      if (esApiKey) {
        connectionParams.auth = {
          apiKey: esApiKey,
        };
        this.logger.log(`使用 API Key 連接到 Elasticsearch: ${esHost}`);
      } else if (esUsername && esPassword) {
        connectionParams.auth = {
          username: esUsername,
          password: esPassword,
        };
        this.logger.log(`使用基本認證連接到 Elasticsearch: ${esHost}`);
      } else {
        this.logger.log(`無認證連接到 Elasticsearch: ${esHost}`);
      }

      this.client = new Client(connectionParams);

      // 測試連接
      const health = await this.client.cluster.health();
      this.logger.log(
        `✅ Elasticsearch 連接成功，集群狀態: ${health.status}`,
      );
    } catch (error) {
      this.logger.error(`❌ Elasticsearch 連接失敗: ${error.message}`);
      this.client = null; // 設置為 null，後續操作會跳過
    }
  }

  /**
   * 獲取索引名稱
   * 格式：faq_{chatbot_id}
   */
  private getIndexName(chatbotId: string): string {
    return `faq_${chatbotId}`;
  }

  /**
   * 獲取索引配置（settings + mappings）
   * 使用 IK 分詞器
   */
  private getIndexConfig() {
    return {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            // IK Analyzer 中文分詞器（需要安裝 IK 插件）
            // 索引和搜尋都使用 ik_smart（粗粒度分詞）
            // 這樣可以確保索引時和搜尋時的分詞結果一致
            ik_max_word_analyzer: {
              type: 'ik_smart', // 索引時使用
            },
            ik_smart_analyzer: {
              type: 'ik_smart', // 搜尋時使用
            },
          },
        },
      },
      mappings: {
        properties: {
          faq_id: {
            type: 'keyword',
          },
          chatbot_id: {
            type: 'keyword',
          },
          question: {
            type: 'text',
            index: false, // 不索引原始問題（繁體中文）
          },
          answer: {
            type: 'text',
            index: false, // 不索引答案
          },
          synonym: {
            type: 'text',
            analyzer: 'ik_max_word_analyzer', // 使用 IK 分詞器（簡體中文）
            search_analyzer: 'ik_smart_analyzer',
          },
          dense_vector: {
            type: 'dense_vector',
            dims: this.embeddingDimensions, // ES 8.x 使用 dims 而非 dimensions
            index: true,
            similarity: 'cosine',
          },
          created_at: {
            type: 'date',
          },
          updated_at: {
            type: 'date',
          },
          active_from: {
            type: 'date',
          },
          active_until: {
            type: 'date',
          },
          status: {
            type: 'keyword',
          },
        },
      },
    };
  }

  /**
   * 創建 FAQ 索引
   *
   * @param chatbotId Chatbot ID
   * @param forceRecreate 是否強制重新創建（會刪除現有索引）
   * @returns 是否成功創建
   */
  async createFaqIndex(
    chatbotId: string,
    forceRecreate: boolean = false,
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(
        `Elasticsearch 未連接，跳過索引創建: ${chatbotId}`,
      );
      return false;
    }

    const indexName = this.getIndexName(chatbotId);
    const startTime = Date.now();

    try {
      // 檢查索引是否已存在
      const exists = await this.client.indices.exists({
        index: indexName,
      });

      if (exists) {
        if (forceRecreate) {
          this.logger.log(`索引 ${indexName} 已存在，強制重新創建`);
          await this.client.indices.delete({ index: indexName });
        } else {
          this.logger.log(`索引 ${indexName} 已存在，跳過創建`);
          return true;
        }
      }

      // 獲取配置
      const config = this.getIndexConfig();

      // 創建索引
      await this.client.indices.create({
        index: indexName,
        wait_for_active_shards: 1,
        timeout: '5s',
        ...config,
      } as any);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 成功創建索引: ${indexName} (耗時: ${duration}ms)`,
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || String(error);

      // 如果索引已存在，視為成功（可能是競態條件導致）
      if (
        errorMsg.includes('resource_already_exists_exception') ||
        errorMsg.includes('already_exists') ||
        errorMsg.includes('AlreadyExistsException')
      ) {
        this.logger.warn(
          `索引已存在（視為成功）: ${indexName} (耗時: ${duration}ms)`,
        );
        return true;
      }

      this.logger.error(
        `❌ 創建索引失敗: ${indexName} (耗時: ${duration}ms)`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * 刪除 FAQ 索引
   * 
   * @param chatbotId Chatbot ID
   * @returns 是否成功刪除
   */
  async deleteFaqIndex(chatbotId: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(
        `Elasticsearch 未連接，跳過索引刪除: ${chatbotId}`,
      );
      return false;
    }

    const indexName = this.getIndexName(chatbotId);
    const startTime = Date.now();

    try {
      // 檢查索引是否存在
      const exists = await this.client.indices.exists({
        index: indexName,
      });

      if (!exists) {
        this.logger.log(`索引不存在，跳過刪除: ${indexName}`);
        return true;
      }

      // 刪除索引
      await this.client.indices.delete({
        index: indexName,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 成功刪除索引: ${indexName} (耗時: ${duration}ms)`,
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ 刪除索引失敗: ${indexName} (耗時: ${duration}ms)`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * 保存 FAQ 到 Elasticsearch
   * 
   * @param chatbotId Chatbot ID
   * @param faqId FAQ ID
   * @param question 問題（繁體中文）
   * @param answer 答案
   * @param synonym 同義詞（原始，可以是空字串）
   * @param status 狀態
   * @param denseVector embedding 向量
   * @returns 是否成功保存
   * 
   * Note:
   *   ES 的 synonym 欄位會自動組合為 "question + ' ' + synonym" 格式，
   *   然後轉換為簡體中文並去除停用詞
   */
  async saveFaq(
    chatbotId: string,
    faqId: string,
    question: string,
    answer: string,
    synonym: string,
    status: string,
    denseVector: number[],
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Elasticsearch 未連接，跳過 FAQ 保存');
      return false;
    }

    const indexName = this.getIndexName(chatbotId);
    const startTime = Date.now();

    try {
      // 檢查索引是否存在，如果不存在則創建
      const exists = await this.client.indices.exists({ index: indexName });
      if (!exists) {
        this.logger.warn(`索引不存在，自動創建: ${indexName}`);
        const created = await this.createFaqIndex(chatbotId);
        if (!created) {
          this.logger.error(`索引創建失敗: ${indexName}`);
          return false;
        }
      }

      // 1. 組合 question 和 synonym
      const synonymCombined = `${question} ${synonym || ''}`.trim();
      
      // 2. 轉簡體並去停用詞
      const synonymSimplified = this.extractKeywords(synonymCombined);
      
      this.logger.debug(`[FAQ ${faqId}] synonym 處理:`);
      this.logger.debug(`  原始: ${synonymCombined}`);
      this.logger.debug(`  簡體: ${synonymSimplified}`);

      // 準備文檔數據
      const document: any = {
        faq_id: faqId,
        chatbot_id: chatbotId,
        question, // 保持原樣（不索引）
        answer,   // 保持原樣（不索引）
        synonym: synonymSimplified, // 使用處理後的簡體中文
        dense_vector: denseVector,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 添加可選欄位（如果提供）
      // active_from 和 active_until 用於定時啟用/停用 FAQ
      // 目前暫時不使用，但保留欄位結構

      // 保存到 ES (使用 index API，會自動創建或更新)
      await this.client.index({
        index: indexName,
        id: faqId,
        document,
        refresh: true, // 立即刷新，確保可搜尋
      } as any);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 成功保存 FAQ 到 Elasticsearch: ${faqId} (耗時: ${duration}ms)`,
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ 保存 FAQ 到 Elasticsearch 失敗: ${faqId} (耗時: ${duration}ms)`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * 從 Elasticsearch 刪除 FAQ
   * 
   * @param chatbotId Chatbot ID
   * @param faqId FAQ ID
   * @returns 是否成功刪除
   */
  async deleteFaq(chatbotId: string, faqId: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Elasticsearch 未連接，跳過 FAQ 刪除');
      return false;
    }

    const indexName = this.getIndexName(chatbotId);
    const startTime = Date.now();

    try {
      // 檢查索引是否存在
      const indexExists = await this.client.indices.exists({ index: indexName });
      if (!indexExists) {
        this.logger.warn(`索引不存在，跳過刪除: ${indexName}`);
        return true;
      }

      // 檢查文檔是否存在
      const docExists = await this.client.exists({
        index: indexName,
        id: faqId,
      });

      if (!docExists) {
        this.logger.warn(`文檔不存在，跳過刪除: ${faqId}`);
        return true;
      }

      // 刪除文檔
      await this.client.delete({
        index: indexName,
        id: faqId,
        refresh: true,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 成功從 Elasticsearch 刪除 FAQ: ${faqId} (耗時: ${duration}ms)`,
      );
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ 從 Elasticsearch 刪除 FAQ 失敗: ${faqId} (耗時: ${duration}ms)`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * 提取關鍵詞並轉簡體
   * 1. 移除停用詞
   * 2. 轉換為簡體中文
   * 
   * @param text 原始文本（繁體中文）
   * @returns 優化後的文本（簡體中文，已移除停用詞）
   */
  private extractKeywords(text: string): string {
    // 移除停用詞
    let cleaned = text;
    for (const stopWord of this.stopWords) {
      cleaned = cleaned.replace(new RegExp(stopWord, 'g'), ' ');
    }

    // 轉簡體
    const simplified = this.converter(cleaned);

    // 清理多餘空格
    return simplified.split(/\s+/).filter(Boolean).join(' ');
  }

  /**
   * 混合搜尋 (BM25 + kNN)
   * 使用 RRF (Reciprocal Rank Fusion) 合併排名
   * 
   * @param chatbotId Chatbot ID
   * @param query 用戶問題（繁體中文）
   * @param denseVector 問題的 embedding 向量
   * @param topK 返回前 K 個結果
   * @param bm25Weight BM25 權重
   * @param knnWeight kNN 權重
   * @param simThreshold kNN 相似度閾值（預設 0.45）
   * @param rankConstant RRF 排名常數（預設 60）
   * @returns 搜尋結果列表
   */
  async hybridSearch(
    chatbotId: string,
    query: string,
    denseVector: number[],
    topK: number = 5,
    bm25Weight: number = 0.3,
    knnWeight: number = 0.7,
    simThreshold: number = 0.45,
    rankConstant: number = 60,
  ): Promise<any[]> {
    if (!this.client) {
      this.logger.warn('Elasticsearch 未連接，返回空結果');
      return [];
    }

    const indexName = this.getIndexName(chatbotId);
    const startTime = Date.now();

    try {
      // 檢查索引是否存在
      const exists = await this.client.indices.exists({ index: indexName });
      if (!exists) {
        this.logger.warn(`索引不存在: ${indexName}，返回空結果`);
        return [];
      }

      // ========== 處理查詢文本 ==========
      // 1. 轉簡體並去停用詞（與保存時一致）
      const querySimplified = this.extractKeywords(query);

      this.logger.debug(`[混合搜尋] 查詢處理:`);
      this.logger.debug(`  原始: ${query}`);
      this.logger.debug(`  簡體: ${querySimplified}`);
      this.logger.debug(`  相似度閾值(sim): ${simThreshold}`);
      this.logger.debug(`  權重設定: bm25_weight=${bm25Weight}, knn_weight=${knnWeight}`);

      // ========== 步驟 1: 執行 BM25 查詢（關鍵詞匹配）==========
      const bm25Query: any = {
        size: topK * 2, // 多取候選以確保覆蓋
        _source: ['faq_id', 'question', 'answer', 'chatbot_id', 'created_at', 'updated_at'],
        query: {
          bool: {
            must: [
              // 只搜尋 active 狀態的 FAQ
              {
                term: {
                  status: 'active',
                },
              },
              // BM25 文本搜尋（搜尋 synonym 欄位，使用簡體中文）
              {
                match: {
                  synonym: {
                    query: querySimplified,
                  },
                },
              },
            ],
          },
        },
      };

      const bm25Response = await this.client.search({
        index: indexName,
        body: bm25Query,
      } as any);

      const bm25Hits = bm25Response.hits.hits;

      // 計算 BM25 排名：rank = 1, 2, 3, ...（按分數排序）
      const bm25Rank = new Map<string, number>();
      bm25Hits.forEach((hit: any, index: number) => {
        const faqId = hit._source.faq_id;
        bm25Rank.set(faqId, index + 1);
      });

      this.logger.debug(`  ✅ BM25 查詢: 找到 ${bm25Hits.length} 個結果`);

      // ========== 步驟 2: 執行 kNN 查詢（語義向量相似度）==========
      const knnQuery: any = {
        size: topK * 2, // 多取候選以確保覆蓋
        _source: ['faq_id', 'question', 'answer', 'chatbot_id', 'created_at', 'updated_at'],
        query: {
          bool: {
            must: [
              // 只搜尋 active 狀態的 FAQ
              {
                term: {
                  status: 'active',
                },
              },
            ],
            should: [
              // kNN 向量搜尋（使用 script_score）
              {
                script_score: {
                  query: {
                    match_all: {},
                  },
                  script: {
                    // cosineSimilarity 返回範圍 [-1, 1]，加上 1.0 使其變成 [0, 2]
                    source: "cosineSimilarity(params.query_vector, 'dense_vector') + 1.0",
                    params: {
                      query_vector: denseVector,
                    },
                  },
                },
              },
            ],
          },
        },
      };

      const knnResponse = await this.client.search({
        index: indexName,
        body: knnQuery,
      } as any);

      const knnHits = knnResponse.hits.hits;

      // 步驟 2.1: 過濾相似度太低的結果
      // 注意：由於 script_score 中已經將 cosineSimilarity 結果加上 1.0
      // 所以分數範圍從 [-1, 1] 變成了 [0, 2]
      // 因此需要將 sim_threshold 也加上 1.0 來保持一致的判斷邏輯
      const adjustedThreshold = simThreshold + 1.0;
      const knnRank = new Map<string, number>();
      let rank = 1;

      for (const hit of knnHits) {
        const sim = hit._score || 0;
        if (sim < adjustedThreshold) {
          continue;
        }
        const faqId = (hit._source as any).faq_id;
        knnRank.set(faqId, rank);
        rank++;
      }

      this.logger.debug(`  ✅ kNN 查詢: 找到 ${knnHits.length} 個結果`);
      this.logger.debug(`  🔍 相似度過濾 (原始閾值: ${simThreshold}, 調整後閾值: ${adjustedThreshold.toFixed(6)}): ${knnHits.length} → ${knnRank.size} 個符合條件`);

      // ========== 步驟 3: RRF 合併排名 ==========
      // RRF 公式：RRF(rank) = 1.0 / (rank_constant + rank)
      // 最終分數 = RRF(bm25_rank) * bm25_weight + RRF(knn_rank) * knn_weight
      this.logger.debug(`  📊 RRF 合併排名 (rank_constant=${rankConstant})`);

      // 合併兩個搜尋結果的所有 ID
      const allIds = new Set<string>([
        ...Array.from(bm25Rank.keys()),
        ...Array.from(knnRank.keys()),
      ]);

      // RRF 分數計算：排名越小，分數越高
      const rrf = (rank: number): number => {
        return 1.0 / (rankConstant + rank);
      };

      // 計算每個 FAQ 的 RRF 總分
      const scores = new Map<string, number>();
      for (const fid of allIds) {
        const r1 = bm25Rank.get(fid) || 9999; // 如果不在 BM25 結果中，使用大排名值
        const r2 = knnRank.get(fid) || 9999; // 如果不在 kNN 結果中，使用大排名值
        const score = rrf(r1) * bm25Weight + rrf(r2) * knnWeight; // 加權重
        scores.set(fid, score);
      }

      // 步驟 4: 按 RRF 分數排序，取前 top_k 個
      const sortedIds = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK);

      this.logger.debug(`  ✅ RRF 合併完成: ${sortedIds.length} 個結果`);

      // ========== 步驟 5: 組合最終結果 ==========
      // 建立 FAQ ID 到完整文檔的映射
      const allHitsMap = new Map<string, any>();
      for (const hit of [...bm25Hits, ...knnHits]) {
        const source = hit._source as any;
        const faqId = source.faq_id;
        if (!allHitsMap.has(faqId)) {
          allHitsMap.set(faqId, source);
        }
      }

      const finalResults: any[] = [];
      for (const [fid, score] of sortedIds) {
        const sourceDoc = allHitsMap.get(fid);
        if (!sourceDoc) {
          this.logger.warn(`⚠️ 找不到 FAQ ID ${fid} 的資料，跳過`);
          continue;
        }

        finalResults.push({
          faq_id: fid,
          question: sourceDoc.question,
          answer: sourceDoc.answer,
          chatbot_id: sourceDoc.chatbot_id,
          score: score, // RRF 最終分數
          metadata: {
            bm25_rank: bm25Rank.get(fid),
            knn_rank: knnRank.get(fid),
            rrf_score: score,
            rank_constant: rankConstant,
            method: 'manual_rrf',
            search_type: 'hybrid',
          },
        });
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 混合搜尋完成: 找到 ${finalResults.length} 個結果 (耗時: ${duration}ms)`,
      );

      return finalResults;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ 混合搜尋失敗 (耗時: ${duration}ms)`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * 檢查 Elasticsearch 是否可用
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}

