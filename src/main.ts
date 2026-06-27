import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DecimalSerializationInterceptor } from './common/interceptors/decimal-serialization.interceptor';
import { IdempotencyGuard } from './common/idempotency/idempotency.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(new DecimalSerializationInterceptor());

  // Global guards — needs Reflector from @nestjs/core
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new IdempotencyGuard(reflector));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Personal Finance Manager API')
    .setDescription('A simplified ledger-based personal finance API')
    .setVersion('1.0')
    .addTag('Accounts')
    .addTag('Categories')
    .addTag('Projects')
    .addTag('Transactions')
    .addTag('Scheduled Bills')
    .addTag('Transfers')
    .addTag('Journal Entries')
    .addTag('Reports')
    .addTag('Projections')
    .addTag('Ledger Accounts')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
