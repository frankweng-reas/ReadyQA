import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TopicsService } from './topics.service';
import { CreateTopicDto, UpdateTopicDto, TopicQueryDto } from './dto/topic.dto';

@ApiTags('topics')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '建立新 Topic' })
  async create(@Body() createDto: CreateTopicDto) {
    const topic = await this.topicsService.create(createDto);
    return {
      success: true,
      data: topic,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得 Topic 列表' })
  async findAll(@Query() query: TopicQueryDto) {
    const topics = await this.topicsService.findAll(query);
    return {
      success: true,
      data: topics,
      total: topics.length,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取得單一 Topic' })
  async findOne(@Param('id') id: string) {
    const topic = await this.topicsService.findOne(id);
    return {
      success: true,
      data: topic,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新 Topic' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateTopicDto) {
    const topic = await this.topicsService.update(id, updateDto);
    return {
      success: true,
      data: topic,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刪除 Topic' })
  async remove(@Param('id') id: string) {
    await this.topicsService.remove(id);
    return {
      success: true,
      message: 'Topic deleted successfully',
    };
  }
}

