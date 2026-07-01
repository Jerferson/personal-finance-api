import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DecimalSerializationInterceptor } from './common/interceptors/decimal-serialization.interceptor';

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

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Personal Finance Manager API')
    .setDescription('A simplified ledger-based personal finance API')
    .setVersion('1.0')
    .addTag('accounts')
    .addTag('categories')
    .addTag('projects')
    .addTag('transactions')
    .addTag('scheduled-bills')
    .addTag('transfers')
    .addTag('statement')
    .addTag('journal-entries')
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
