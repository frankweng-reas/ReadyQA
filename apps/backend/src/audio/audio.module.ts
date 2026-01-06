import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AudioController } from './audio.controller';
import { WhisperService } from './whisper.service';

@Module({
  imports: [ConfigModule],
  controllers: [AudioController],
  providers: [WhisperService],
  exports: [WhisperService],
})
export class AudioModule {}

