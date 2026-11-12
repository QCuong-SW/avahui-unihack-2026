import { Module } from '@nestjs/common';
import { CirclesModule } from '../circles/circles.module';
import { AiController } from './controllers/ai.controller';
import { AiService } from './services/ai.service';

@Module({
  imports: [CirclesModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

