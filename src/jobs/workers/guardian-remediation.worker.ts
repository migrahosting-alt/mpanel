import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../modules/prisma/prisma.service';
import { ProvisioningService } from '../modules/provisioning/provisioning.service';

type RemediationJobPayload = {
  remediationId: string;
  tenantId: string;
  serverId: string | null;
  dataRegion: string;
};

/**
 * GuardianRemediationWorker:
 *  - ensures dual approval is present
 *  - calls ProvisioningService to execute remediation
 *  - persists result, logs
 */
@Processor('guardian:remediation')
export class GuardianRemediationWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: ProvisioningService,
  ) {
    super();
  }

  async process(job: Job<RemediationJobPayload>): Promise<void> {
    const { remediationId } = job.data;

    const task = await this.prisma.guardianRemediationTask.findUnique({
      where: { id: remediationId },
    });
    if (!task) return;

    if (!task.tenantApprovedAt || !task.platformApprovedAt || task.status !== 'pending') {
      return;
    }

    await this.prisma.guardianRemediationTask.update({
      where: { id: remediationId },
      data: {
        status: 'executing',
        executedAt: new Date(),
      },
    });

    try {
      result = await this.provisioning.executeGuardianRemediation({
        tenantId: task.tenantId,
        serverId: task.serverId,
        actionType: task.actionType,
        payloadJson: task.actionPayloadJson,
      });

      await this.prisma.guardianRemediationTask.update({
        where: { id: remediationId },
        data: {
          status: 'completed',
          resultStatus: 'success',
          resultMessage: result?.message ?? null,
          resultLogRef: result?.logRef ?? null,
        },
      });
    } catch (err) {
      await this.prisma.guardianRemediationTask.update({
        where: { id: remediationId },
        data: {
          status: 'failed',
          resultStatus: 'error',
          resultMessage: err?.message ?? 'Remediation failed',
        },
      });
      throw err;
    }
  }
}
