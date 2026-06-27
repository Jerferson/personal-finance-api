import { Module } from '@nestjs/common';
import { ScheduledBillsService } from './scheduled-bills.service';
import { ScheduledBillsController } from './scheduled-bills.controller';

@Module({
  controllers: [ScheduledBillsController],
  providers: [ScheduledBillsService],
  exports: [ScheduledBillsService],
})
export class ScheduledBillsModule {}
