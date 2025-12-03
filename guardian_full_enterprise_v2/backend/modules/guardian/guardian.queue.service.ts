import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export type ScanJobPayload = {
  scanId: string;
  tenantId: string;
  serverId: string | null;
  dataRegion: string;
  type: string;
};

export type RemediationJobPayload = {
  remediationId: string;
  tenantId: string;
  serverId: string | null;
  dataRegion: string;
};

@Injectable()
export class GuardianQueueService {
  private readonly logger = new Logger(GuardianQueueService.name);

  constructor(
    @InjectQueue('guardian:scan') private readonly scanQueue: Queue<ScanJobPayload>,
    @InjectQueue('guardian:remediation') private readonly remediationQueue: Queue<RemediationJobPayload>,
  ) {}

  async enqueueScan(payload: ScanJobPayload) {
    this.logger.log(`Enqueue Guardian scan ${payload.scanId} for tenant ${payload.tenantId}`);
    await this.scanQueue.add('guardian-scan', payload, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async enqueueRemediationExecution(payload: RemediationJobPayload) {
    this.logger.log(`Enqueue Guardian remediation ${payload.remediationId} for tenant ${payload.tenantId}`);
    await this.remediationQueue.add('guardian-remediation', payload, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
