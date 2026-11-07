import { Module } from '@nestjs/common';
import { CirclesController } from './controllers/circles.controller';
import { CirclesService } from './services/circles.service';

@Module({
  controllers: [CirclesController],
  providers: [CirclesService],
  exports: [CirclesService],
})
export class CirclesModule {}

