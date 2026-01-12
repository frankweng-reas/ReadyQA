import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Throttler 異常過濾器
 * 自定義 Rate Limit 錯誤訊息，參考 answergo 的實作
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: '請求過於頻繁，請稍後再試。為了保護服務穩定性，我們限制了每個 IP 的請求頻率。',
      error: 'Too Many Requests',
    });
  }
}
