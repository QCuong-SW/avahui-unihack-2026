import { Module } from '@nestjs/common';
import { BlockchainIndexerService } from './services/blockchain-indexer.service';

@Module({
  providers: [BlockchainIndexerService],
  exports: [BlockchainIndexerService],
})
export class BlockchainModule {}

