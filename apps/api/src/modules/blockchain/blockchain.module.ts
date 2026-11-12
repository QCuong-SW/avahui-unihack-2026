import { Module } from '@nestjs/common';
import { BlockchainIndexerService } from './services/blockchain-indexer.service';
import { AutonomousKeeperService } from './services/autonomous-keeper.service';

@Module({
  providers: [BlockchainIndexerService, AutonomousKeeperService],
  exports: [BlockchainIndexerService, AutonomousKeeperService],
})
export class BlockchainModule {}
