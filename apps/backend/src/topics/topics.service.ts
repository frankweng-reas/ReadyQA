import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto, UpdateTopicDto, TopicQueryDto } from './dto/topic.dto';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateTopicDto) {
    const existing = await this.prisma.topic.findUnique({
      where: { id: createDto.id },
    });

    if (existing) {
      throw new BadRequestException(`Topic with id ${createDto.id} already exists`);
    }

    // 檢查同一 chatbot 下是否有同名 topic
    const duplicate = await this.prisma.topic.findFirst({
      where: {
        chatbotId: createDto.chatbotId,
        name: createDto.name,
      },
    });

    if (duplicate) {
      throw new BadRequestException(`Topic with name "${createDto.name}" already exists in this chatbot`);
    }

    return this.prisma.topic.create({
      data: createDto,
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            faqs: true,
          },
        },
      },
    });
  }

  async findAll(query: TopicQueryDto) {
    const where: any = {
      chatbotId: query.chatbotId,
    };

    if (query.parentId !== undefined) {
      where.parentId = query.parentId || null;
    }

    return this.prisma.topic.findMany({
      where,
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            children: true,
            faqs: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: 'asc' },
        },
        faqs: {
          select: {
            id: true,
            question: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            children: true,
            faqs: true,
          },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with id ${id} not found`);
    }

    return topic;
  }

  async update(id: string, updateDto: UpdateTopicDto) {
    await this.findOne(id);

    return this.prisma.topic.update({
      where: { id },
      data: updateDto,
      include: {
        parent: true,
        _count: {
          select: {
            children: true,
            faqs: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // 檢查是否有子分類
    const children = await this.prisma.topic.count({
      where: { parentId: id },
    });

    if (children > 0) {
      throw new BadRequestException(`Cannot delete topic with ${children} child topics`);
    }

    return this.prisma.topic.delete({
      where: { id },
    });
  }
}


