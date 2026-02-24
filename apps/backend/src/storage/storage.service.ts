import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

/**
 * 上傳 Chatbot 圖片（Logo / 首頁背景）到 GCS，回傳公開 URL。
 * 未設定 GCS_BUCKET 時不初始化，由 controller 改走本機磁碟。
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage | null = null;
  private bucketName: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const bucket = this.configService.get<string>('GCS_BUCKET');
    if (bucket) {
      this.bucketName = bucket;
      try {
        this.storage = new Storage();
        this.logger.log(`GCS 儲存已啟用，bucket: ${bucket}`);
      } catch (e) {
        this.logger.warn(`GCS 初始化失敗，將使用本機磁碟: ${e}`);
        this.storage = null;
        this.bucketName = null;
      }
    }
  }

  isGcsEnabled(): boolean {
    return this.storage !== null && this.bucketName !== null;
  }

  /**
   * 上傳 Chatbot 圖片到 GCS，並設為公開讀取，回傳公開 URL。
   * objectName 建議格式：chatbot-logos/chatbot-{id}-{suffix}.{ext}
   */
  async uploadChatbotImage(
    buffer: Buffer,
    objectName: string,
    mimetype: string,
  ): Promise<string> {
    if (!this.storage || !this.bucketName) {
      throw new Error('GCS 未設定或未啟用');
    }
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, {
      metadata: { contentType: mimetype },
    });
    try {
      await file.makePublic();
    } catch (e) {
      this.logger.warn(`GCS makePublic 略過（物件已上傳）: ${objectName}`, (e as Error).message);
    }
    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${objectName}`;
    this.logger.log(`已上傳至 GCS: ${objectName}`);
    return publicUrl;
  }
}
