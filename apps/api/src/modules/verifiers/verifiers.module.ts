import { Module } from '@nestjs/common';
import { VerifiersController } from './controllers/verifiers.controller';
import { VerifiersService } from './services/verifiers.service';

@Module({
  controllers: [VerifiersController],
  providers: [VerifiersService],
  exports: [VerifiersService],
})
export class VerifiersModule {}

