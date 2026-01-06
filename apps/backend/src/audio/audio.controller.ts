import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { WhisperService } from './whisper.service';

@Controller('audio')
@ApiTags('audio')
export class AudioController {
  constructor(private readonly whisperService: WhisperService) {}

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '語音轉文字' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: '轉錄成功' })
  @ApiResponse({ status: 400, description: '請求參數錯誤' })
  @ApiResponse({ status: 500, description: '轉錄失敗' })
  @UseInterceptors(FileInterceptor('file'))
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Body('chatbotId') chatbotId: string,
    @Body('language') language?: string,
    @Body('prompt') prompt?: string,
    @Body('denoise') denoise?: string,
  ) {
    if (!file) {
      throw new BadRequestException('缺少音頻檔案');
    }

    if (!chatbotId) {
      throw new BadRequestException('缺少 chatbotId 參數');
    }

    if (!file.mimetype.startsWith('audio/')) {
      throw new BadRequestException('檔案必須是音頻格式');
    }

    console.log('收到轉錄請求:', {
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      chatbotId,
      language,
      hasPrompt: !!prompt,
      enableDenoise: denoise === 'true',
    });

    const result = await this.whisperService.transcribeAudio({
      chatbotId,
      audioData: file,
      language: language || undefined,
      prompt: prompt || undefined,
      enableDenoise: denoise === 'true',
    });

    return {
      success: true,
      text: result.text,
    };
  }
}

