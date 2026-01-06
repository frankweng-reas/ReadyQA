import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import fetch from 'node-fetch';

export interface TranscribeOptions {
  chatbotId: string;
  audioData: Express.Multer.File;
  language?: string;
  prompt?: string;
  enableDenoise?: boolean;
}

export interface TranscribeResult {
  text: string;
}

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);

  constructor(private configService: ConfigService) {}

  async transcribeAudio(options: TranscribeOptions): Promise<TranscribeResult> {
    const { audioData, language, prompt } = options;

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const provider = this.configService.get<string>('OPENAI_PROVIDER') || 'openai';
    const azureEndpoint = this.configService.get<string>('AZURE_OPENAI_ENDPOINT');
    const azureApiVersion = this.configService.get<string>('AZURE_OPENAI_API_VERSION');
    const whisperDeployment = this.configService.get<string>('WHISPER_DEPLOYMENT_NAME');

    if (!apiKey) {
      throw new Error('未配置 OpenAI API Key，請設置環境變數 OPENAI_API_KEY');
    }

    this.logger.log(`開始語音轉文字處理，提供者: ${provider}, 檔案大小: ${audioData.size} bytes`);
    
    if (provider === 'azure-openai') {
      this.logger.log(`使用 Azure OpenAI - Endpoint: ${azureEndpoint}, Deployment: ${whisperDeployment}, API Version: ${azureApiVersion}`);
    }

    // 調用 Whisper API
    const text = await this.callWhisperAPI(audioData, apiKey, {
      language,
      prompt,
      provider,
      apiUrl: azureEndpoint,
      apiVersion: azureApiVersion,
      deploymentName: whisperDeployment,
    });

    return { text };
  }

  private async callWhisperAPI(
    audioFile: Express.Multer.File,
    apiKey: string,
    options?: {
      language?: string;
      prompt?: string;
      provider?: string;
      apiUrl?: string;
      apiVersion?: string;
      deploymentName?: string;
    },
  ): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioFile.buffer, {
      filename: audioFile.originalname,
      contentType: audioFile.mimetype,
    });

    const provider = options?.provider || 'openai';
    let apiEndpoint: string;
    let headers: Record<string, string>;

    if (provider === 'azure-openai') {
      const apiUrl = options?.apiUrl || this.configService.get<string>('AZURE_OPENAI_ENDPOINT') || '';
      const apiVersion = options?.apiVersion || this.configService.get<string>('AZURE_OPENAI_API_VERSION') || '2024-10-21';
      const deploymentName = options?.deploymentName || this.configService.get<string>('WHISPER_DEPLOYMENT_NAME') || 'whisper';

      if (!apiUrl) {
        throw new Error('Azure OpenAI 需要設置 AZURE_OPENAI_ENDPOINT 環境變數');
      }

      const baseUrl = apiUrl.replace(/\/$/, '');
      apiEndpoint = `${baseUrl}/openai/deployments/${deploymentName}/audio/transcriptions?api-version=${apiVersion}`;
      headers = {
        'api-key': apiKey,
        ...formData.getHeaders(),
      };
    } else {
      formData.append('model', 'whisper-1');
      apiEndpoint = options?.apiUrl || 'https://api.openai.com/v1/audio/transcriptions';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      };
    }

    if (options?.language) {
      formData.append('language', options.language);
    }

    if (options?.prompt && options.prompt.trim()) {
      formData.append('prompt', options.prompt.trim());
    }

    this.logger.log(`調用 Whisper API: ${apiEndpoint}`);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: headers,
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText || `API 錯誤: ${response.status}` } };
      }
      const errorMessage = errorData.error?.message || errorData.error || `API 錯誤: ${response.status}`;
      this.logger.error(`Whisper API 錯誤: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const data = await response.json() as any;

    if (!data || !data.text) {
      throw new Error('Whisper API 返回空結果，請檢查音頻格式或重試');
    }

    this.logger.log(`轉錄成功，文字長度: ${data.text.length}`);

    return data.text;
  }
}

