import { Injectable } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CategoryHasLinkedRecordsError,
  CategoryNotFoundException,
} from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        type: dto.type,
      },
    });
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<Category>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count(),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw new CategoryNotFoundException(id);
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
    });
  }

  async remove(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        transactions: { take: 1 },
        scheduledBills: { take: 1 },
      },
    });

    if (!category) {
      throw new CategoryNotFoundException(id);
    }

    const hasTransactions = category.transactions.length > 0;
    const hasScheduledBills = category.scheduledBills.length > 0;

    if (hasTransactions || hasScheduledBills) {
      throw new CategoryHasLinkedRecordsError();
    }

    return this.prisma.category.delete({ where: { id } });
  }
}
