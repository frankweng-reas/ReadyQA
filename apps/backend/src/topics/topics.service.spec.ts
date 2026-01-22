import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto, UpdateTopicDto, TopicQueryDto } from './dto/topic.dto';

describe('TopicsService', () => {
  let service: TopicsService;
  let prismaService: any;

  const mockPrismaService = {
    topic: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TopicsService>(TopicsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTopicDto = {
      id: 'topic-1',
      chatbotId: 'chatbot-1',
      name: '測試主題',
      parentId: undefined,
      sortOrder: 1,
      description: '測試描述',
    };

    const createdTopic = {
      ...createDto,
      parent: null,
      _count: {
        children: 0,
        faqs: 0,
      },
    };

    it('✅ 應該成功創建 Topic', async () => {
      prismaService.topic.findUnique.mockResolvedValue(null);
      prismaService.topic.findFirst.mockResolvedValue(null);
      prismaService.topic.create.mockResolvedValue(createdTopic);

      const result = await service.create(createDto);

      expect(result).toEqual(createdTopic);
      expect(prismaService.topic.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.id },
      });
      expect(prismaService.topic.findFirst).toHaveBeenCalledWith({
        where: {
          chatbotId: createDto.chatbotId,
          name: createDto.name,
        },
      });
      expect(prismaService.topic.create).toHaveBeenCalledWith({
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
    });

    it('❌ 應該拒絕重複的 ID', async () => {
      prismaService.topic.findUnique.mockResolvedValue({ id: 'topic-1' } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('Topic with id topic-1 already exists');
      expect(prismaService.topic.create).not.toHaveBeenCalled();
    });

    it('❌ 應該拒絕同一 chatbot 下的重複名稱', async () => {
      prismaService.topic.findUnique.mockResolvedValue(null);
      prismaService.topic.findFirst.mockResolvedValue({
        id: 'topic-2',
        chatbotId: 'chatbot-1',
        name: '測試主題',
      } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('Topic with name "測試主題" already exists in this chatbot');
      expect(prismaService.topic.create).not.toHaveBeenCalled();
    });

    it('✅ 應該允許不同 chatbot 下的相同名稱', async () => {
      const createDto2 = { ...createDto, chatbotId: 'chatbot-2' };
      prismaService.topic.findUnique.mockResolvedValue(null);
      prismaService.topic.findFirst.mockResolvedValue(null);
      prismaService.topic.create.mockResolvedValue({ ...createdTopic, chatbotId: 'chatbot-2' });

      const result = await service.create(createDto2);

      expect(result.chatbotId).toBe('chatbot-2');
      expect(prismaService.topic.create).toHaveBeenCalled();
    });

    it('✅ 應該支援有 parentId 的 Topic', async () => {
      const createDtoWithParent = { ...createDto, parentId: 'parent-topic-1' };
      prismaService.topic.findUnique.mockResolvedValue(null);
      prismaService.topic.findFirst.mockResolvedValue(null);
      prismaService.topic.create.mockResolvedValue({
        ...createdTopic,
        parentId: 'parent-topic-1',
      });

      const result = await service.create(createDtoWithParent);

      expect(result.parentId).toBe('parent-topic-1');
      expect(prismaService.topic.create).toHaveBeenCalledWith({
        data: createDtoWithParent,
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
    });
  });

  describe('findAll', () => {
    const queryDto: TopicQueryDto = {
      chatbotId: 'chatbot-1',
      parentId: undefined,
    };

    const mockTopics = [
      {
        id: 'topic-1',
        chatbotId: 'chatbot-1',
        name: '主題1',
        parentId: null,
        sortOrder: 1,
        parent: null,
        children: [],
        _count: { children: 0, faqs: 5 },
      },
      {
        id: 'topic-2',
        chatbotId: 'chatbot-1',
        name: '主題2',
        parentId: null,
        sortOrder: 2,
        parent: null,
        children: [],
        _count: { children: 2, faqs: 3 },
      },
    ];

    it('✅ 應該成功查詢所有 Topics', async () => {
      prismaService.topic.findMany.mockResolvedValue(mockTopics);

      const result = await service.findAll(queryDto);

      expect(result).toEqual(mockTopics);
      expect(prismaService.topic.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
        },
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
    });

    it('✅ 應該支援 parentId 過濾', async () => {
      const queryWithParent: TopicQueryDto = {
        chatbotId: 'chatbot-1',
        parentId: 'parent-topic-1',
      };
      prismaService.topic.findMany.mockResolvedValue([
        {
          ...mockTopics[0],
          parentId: 'parent-topic-1',
        },
      ]);

      const result = await service.findAll(queryWithParent);

      expect(result).toHaveLength(1);
      expect(prismaService.topic.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
          parentId: 'parent-topic-1',
        },
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
    });

    it('✅ 應該支援 parentId 為 null 的過濾', async () => {
      const queryWithNullParent: TopicQueryDto = {
        chatbotId: 'chatbot-1',
        parentId: '',
      };
      prismaService.topic.findMany.mockResolvedValue(mockTopics);

      await service.findAll(queryWithNullParent);

      expect(prismaService.topic.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
          parentId: null,
        },
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
    });

    it('✅ 應該返回空陣列當沒有 Topics', async () => {
      prismaService.topic.findMany.mockResolvedValue([]);

      const result = await service.findAll(queryDto);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    const topicId = 'topic-1';
    const mockTopic = {
      id: topicId,
      chatbotId: 'chatbot-1',
      name: '測試主題',
      parentId: null,
      sortOrder: 1,
      description: '測試描述',
      parent: null,
      children: [],
      faqs: [],
      _count: {
        children: 2,
        faqs: 5,
      },
    };

    it('✅ 應該成功查詢單一 Topic', async () => {
      prismaService.topic.findUnique.mockResolvedValue(mockTopic);

      const result = await service.findOne(topicId);

      expect(result).toEqual(mockTopic);
      expect(prismaService.topic.findUnique).toHaveBeenCalledWith({
        where: { id: topicId },
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
    });

    it('❌ 應該在 Topic 不存在時拋出 NotFoundException', async () => {
      prismaService.topic.findUnique.mockResolvedValue(null);

      await expect(service.findOne(topicId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(topicId)).rejects.toThrow(`Topic with id ${topicId} not found`);
    });

    it('✅ 應該包含 parent 資訊', async () => {
      const topicWithParent = {
        ...mockTopic,
        parent: {
          id: 'parent-topic-1',
          name: '父主題',
        },
        parentId: 'parent-topic-1',
      };
      prismaService.topic.findUnique.mockResolvedValue(topicWithParent);

      const result = await service.findOne(topicId);

      expect(result.parent).toBeDefined();
      expect(result.parent?.id).toBe('parent-topic-1');
    });

    it('✅ 應該包含 children 和 faqs', async () => {
      const topicWithChildren = {
        ...mockTopic,
        children: [
          { id: 'child-1', name: '子主題1' },
          { id: 'child-2', name: '子主題2' },
        ],
        faqs: [
          { id: 'faq-1', question: '問題1', status: 'active' },
        ],
      };
      prismaService.topic.findUnique.mockResolvedValue(topicWithChildren);

      const result = await service.findOne(topicId);

      expect(result.children).toHaveLength(2);
      expect(result.faqs).toHaveLength(1);
    });
  });

  describe('update', () => {
    const topicId = 'topic-1';
    const existingTopic = {
      id: topicId,
      chatbotId: 'chatbot-1',
      name: '舊名稱',
      parentId: null,
      sortOrder: 1,
      description: '舊描述',
    };

    beforeEach(() => {
      prismaService.topic.findUnique.mockResolvedValue(existingTopic as any);
    });

    it('✅ 應該成功更新 Topic', async () => {
      const updateDto: UpdateTopicDto = {
        name: '新名稱',
        description: '新描述',
      };
      const updatedTopic = {
        ...existingTopic,
        ...updateDto,
        parent: null,
        _count: { children: 0, faqs: 0 },
      };
      prismaService.topic.update.mockResolvedValue(updatedTopic);

      const result = await service.update(topicId, updateDto);

      expect(result).toEqual(updatedTopic);
      expect(prismaService.topic.findUnique).toHaveBeenCalledWith({
        where: { id: topicId },
        include: expect.any(Object),
      });
      expect(prismaService.topic.update).toHaveBeenCalledWith({
        where: { id: topicId },
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
    });

    it('✅ 應該支援部分更新（只更新 name）', async () => {
      const updateDto: UpdateTopicDto = {
        name: '新名稱',
      };
      const updatedTopic = {
        ...existingTopic,
        name: '新名稱',
        parent: null,
        _count: { children: 0, faqs: 0 },
      };
      prismaService.topic.update.mockResolvedValue(updatedTopic);

      const result = await service.update(topicId, updateDto);

      expect(result.name).toBe('新名稱');
      expect(prismaService.topic.update).toHaveBeenCalledWith({
        where: { id: topicId },
        data: { name: '新名稱' },
        include: expect.any(Object),
      });
    });

    it('✅ 應該支援更新 parentId', async () => {
      const updateDto: UpdateTopicDto = {
        parentId: 'parent-topic-1',
      };
      const updatedTopic = {
        ...existingTopic,
        parentId: 'parent-topic-1',
        parent: { id: 'parent-topic-1', name: '父主題' },
        _count: { children: 0, faqs: 0 },
      };
      prismaService.topic.update.mockResolvedValue(updatedTopic);

      const result = await service.update(topicId, updateDto);

      expect(result.parentId).toBe('parent-topic-1');
    });

    it('✅ 應該支援更新 sortOrder', async () => {
      const updateDto: UpdateTopicDto = {
        sortOrder: 10,
      };
      const updatedTopic = {
        ...existingTopic,
        sortOrder: 10,
        parent: null,
        _count: { children: 0, faqs: 0 },
      };
      prismaService.topic.update.mockResolvedValue(updatedTopic);

      const result = await service.update(topicId, updateDto);

      expect(result.sortOrder).toBe(10);
      expect(prismaService.topic.update).toHaveBeenCalledWith({
        where: { id: topicId },
        data: { sortOrder: 10 },
        include: expect.any(Object),
      });
    });

    it('✅ 應該支援將 parentId 設為 null', async () => {
      const existingTopicWithParent = {
        ...existingTopic,
        parentId: 'parent-topic-1',
      };
      prismaService.topic.findUnique.mockResolvedValue(existingTopicWithParent as any);

      const updateDto: UpdateTopicDto = {
        parentId: null,
      };
      const updatedTopic = {
        ...existingTopicWithParent,
        parentId: null,
        parent: null,
        _count: { children: 0, faqs: 0 },
      };
      prismaService.topic.update.mockResolvedValue(updatedTopic);

      const result = await service.update(topicId, updateDto);

      expect(result.parentId).toBeNull();
    });

    it('❌ 應該在 Topic 不存在時拋出 NotFoundException', async () => {
      prismaService.topic.findUnique.mockResolvedValue(null);

      await expect(service.update(topicId, { name: '新名稱' })).rejects.toThrow(NotFoundException);
      expect(prismaService.topic.update).not.toHaveBeenCalled();
    });

    it('✅ 應該只更新提供的欄位', async () => {
      const updateDto: UpdateTopicDto = {
        name: '新名稱',
        sortOrder: 5,
      };
      const updatedTopic = {
        ...existingTopic,
        name: '新名稱',
        sortOrder: 5,
        description: '舊描述', // 未更新
        parent: null,
        _count: { children: 0, faqs: 0 },
      };
      prismaService.topic.update.mockResolvedValue(updatedTopic);

      const result = await service.update(topicId, updateDto);

      expect(result.name).toBe('新名稱');
      expect(result.sortOrder).toBe(5);
      expect(result.description).toBe('舊描述');
      expect(prismaService.topic.update).toHaveBeenCalledWith({
        where: { id: topicId },
        data: {
          name: '新名稱',
          sortOrder: 5,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('remove', () => {
    const topicId = 'topic-1';
    const existingTopic = {
      id: topicId,
      chatbotId: 'chatbot-1',
      name: '測試主題',
      parentId: null,
    };

    beforeEach(() => {
      prismaService.topic.findUnique.mockResolvedValue(existingTopic as any);
    });

    it('✅ 應該成功刪除 Topic', async () => {
      prismaService.topic.count.mockResolvedValue(0);
      prismaService.topic.delete.mockResolvedValue(existingTopic);

      const result = await service.remove(topicId);

      expect(result).toEqual(existingTopic);
      expect(prismaService.topic.findUnique).toHaveBeenCalled();
      expect(prismaService.topic.count).toHaveBeenCalledWith({
        where: { parentId: topicId },
      });
      expect(prismaService.topic.delete).toHaveBeenCalledWith({
        where: { id: topicId },
      });
    });

    it('❌ 應該在有子分類時拒絕刪除', async () => {
      prismaService.topic.count.mockResolvedValue(3);

      await expect(service.remove(topicId)).rejects.toThrow(BadRequestException);
      await expect(service.remove(topicId)).rejects.toThrow('Cannot delete topic with 3 child topics');
      expect(prismaService.topic.delete).not.toHaveBeenCalled();
    });

    it('❌ 應該在 Topic 不存在時拋出 NotFoundException', async () => {
      prismaService.topic.findUnique.mockResolvedValue(null);

      await expect(service.remove(topicId)).rejects.toThrow(NotFoundException);
      expect(prismaService.topic.count).not.toHaveBeenCalled();
      expect(prismaService.topic.delete).not.toHaveBeenCalled();
    });

    it('✅ 應該允許刪除有 0 個子分類的 Topic', async () => {
      prismaService.topic.count.mockResolvedValue(0);
      prismaService.topic.delete.mockResolvedValue(existingTopic);

      await service.remove(topicId);

      expect(prismaService.topic.delete).toHaveBeenCalled();
    });

    it('✅ 應該允許刪除有子分類但子分類數量為 0 的情況', async () => {
      prismaService.topic.count.mockResolvedValue(0);
      prismaService.topic.delete.mockResolvedValue(existingTopic);

      const result = await service.remove(topicId);

      expect(result).toBeDefined();
      expect(prismaService.topic.count).toHaveBeenCalledWith({
        where: { parentId: topicId },
      });
    });
  });
});
