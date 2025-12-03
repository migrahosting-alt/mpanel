import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { GuardianQueueService } from './guardian.queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { ServersService } from '../servers/servers.service';
import { ProvisioningService } from '../provisioning/provisioning.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'guardian:scan' },
      { name: 'guardian:remediation' },
    ),
  ],
  controllers: [GuardianController],
  providers: [
    GuardianService,
    GuardianQueueService,
    PrismaService,
    RbacService,
    ServersService,
    ProvisioningService,
  ],
  exports: [GuardianService, GuardianQueueService],
})
export class GuardianModule {}
