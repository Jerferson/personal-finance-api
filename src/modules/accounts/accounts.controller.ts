import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountBalanceQueryDto } from './dto/account-balance-query.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiCreatedResponse({ description: 'Account created successfully' })
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all accounts (paginated)' })
  @ApiOkResponse({ description: 'Paginated list of accounts' })
  findAll(@Query() pagination: PaginationDto) {
    return this.accountsService.findAll(pagination.page, pagination.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account by ID' })
  @ApiOkResponse({ description: 'Account found' })
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiOkResponse({ description: 'Account updated' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an account' })
  @ApiNoContentResponse({ description: 'Account deleted' })
  remove(@Param('id') id: string) {
    return this.accountsService.remove(id);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get account balance (optionally up to a date)' })
  @ApiOkResponse({ description: 'Account balance' })
  getBalance(@Param('id') id: string, @Query() query: AccountBalanceQueryDto) {
    return this.accountsService.getBalance(id, query.date);
  }
}
