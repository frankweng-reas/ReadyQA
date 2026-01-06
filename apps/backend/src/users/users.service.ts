import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateUserDto) {
    const emailExists = await this.prisma.user.findUnique({
      where: { email: createDto.email },
    });

    if (emailExists) {
      throw new BadRequestException(`Email ${createDto.email} already exists`);
    }

    return this.prisma.user.create({
      data: createDto,
      select: {
        id: true,
        username: true,
        email: true,
        supabaseUserId: true,
        isActive: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(query: UserQueryDto) {
    const where: any = {};

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            chatbots: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        chatbots: {
          select: {
            id: true,
            name: true,
            status: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            planCode: true,
          },
        },
        _count: {
          select: {
            chatbots: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        supabaseUserId: true,
        isActive: true,
        tenantId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return user;
  }

  async update(id: number, updateDto: UpdateUserDto) {
    await this.findOne(id);

    if (updateDto.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateDto.email },
      });

      if (emailExists && emailExists.id !== id) {
        throw new BadRequestException(`Email ${updateDto.email} already exists`);
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        username: true,
        email: true,
        supabaseUserId: true,
        isActive: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
  }
}
