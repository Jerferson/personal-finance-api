import { Injectable } from '@nestjs/common';
import { Project, TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProjectDateRangeError,
  ProjectHasLinkedRecordsError,
  ProjectNotFoundException,
} from '../../common/errors/domain.errors';
import { paginate, PaginatedResponse } from '../../common/dto/pagination.dto';
import { parseDate } from '../../common/utils/dates';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  totalIncome: Decimal;
  totalExpense: Decimal;
  netAmount: Decimal;
  expensesByCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    total: Decimal;
  }>;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      if (end < start) {
        throw new ProjectDateRangeError();
      }
    }
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    this.validateDateRange(dto.startDate, dto.endDate);

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? parseDate(dto.startDate) : undefined,
        endDate: dto.endDate ? parseDate(dto.endDate) : undefined,
      },
    });
  }

  async findAll(page: number, limit: number): Promise<PaginatedResponse<Project>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count(),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new ProjectNotFoundException(id);
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.findOne(id);

    // Load existing dates to validate combined range
    const existing = await this.prisma.project.findUnique({ where: { id } });

    const newStartDate = dto.startDate !== undefined ? dto.startDate : existing?.startDate?.toISOString().split('T')[0];
    const newEndDate = dto.endDate !== undefined ? dto.endDate : existing?.endDate?.toISOString().split('T')[0];

    this.validateDateRange(newStartDate, newEndDate);

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate !== undefined && { startDate: parseDate(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: parseDate(dto.endDate) }),
      },
    });
  }

  async remove(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        transactions: { take: 1 },
        scheduledBills: { take: 1 },
      },
    });

    if (!project) {
      throw new ProjectNotFoundException(id);
    }

    const hasTransactions = project.transactions.length > 0;
    const hasScheduledBills = project.scheduledBills.length > 0;

    if (hasTransactions || hasScheduledBills) {
      throw new ProjectHasLinkedRecordsError();
    }

    return this.prisma.project.delete({ where: { id } });
  }

  async getSummary(id: string): Promise<ProjectSummary> {
    const project = await this.findOne(id);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        projectId: id,
        status: TransactionStatus.POSTED,
      },
      include: {
        category: true,
      },
    });

    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);

    // Map: key is categoryId (or 'uncategorized'), value is { categoryId, categoryName, total }
    const expenseMap = new Map<
      string,
      { categoryId: string | null; categoryName: string; total: Decimal }
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.INCOME) {
        totalIncome = totalIncome.add(tx.amount);
      } else {
        totalExpense = totalExpense.add(tx.amount);

        const key = tx.categoryId ?? 'uncategorized';
        const existing = expenseMap.get(key);

        if (existing) {
          existing.total = existing.total.add(tx.amount);
        } else {
          expenseMap.set(key, {
            categoryId: tx.categoryId ?? null,
            categoryName: tx.category?.name ?? 'Uncategorized',
            total: new Decimal(tx.amount),
          });
        }
      }
    }

    const netAmount = totalIncome.sub(totalExpense);

    return {
      projectId: project.id,
      projectName: project.name,
      totalIncome,
      totalExpense,
      netAmount,
      expensesByCategory: Array.from(expenseMap.values()),
    };
  }
}
