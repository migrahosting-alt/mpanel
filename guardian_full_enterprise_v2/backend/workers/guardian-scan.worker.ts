import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../modules/prisma/prisma.service';
import { ProvisioningService } from '../modules/provisioning/provisioning.service';

type ScanJobPayload = {
  scanId: string;
  tenantId: string;
  serverId: string | null;
  dataRegion: string;
  type: string;
};

/**
 * GuardianScanWorker:
 *  - marks scan as running
 *  - asks ProvisioningService to run actual scan via agents
 *  - persists findings
 *  - updates scan status
 */
@Processor('guardian:scan')
export class GuardianScanWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: ProvisioningService,
  ) {
    super();
  }

  async process(job: Job<ScanJobPayload>): Promise<void> {
    const { scanId, tenantId, serverId, type } = job.data;

    await this.prisma.guardianScan.update({
      where: { id: scanId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const findings = await this.provisioning.runGuardianScan({
        tenantId,
        serverId,
        type,
        scanId,
      });

      let findingsCount = 0;
      let severityMax: string | null = null;
      const order = ['low', 'medium', 'high', 'critical'];

      for (const f of findings) {
        await this.prisma.guardianFinding.create({
          data: {
            tenantId,
            scanId,
            serverId: serverId ?? undefined,
            dataRegion: f.dataRegion ?? 'us',
            code: f.code,
            title: f.title,
            description: f.description,
            category: f.category ?? 'system',
            severity: f.severity,
            status: 'open',
            detailsJson: f.detailsJson ? JSON.stringify(f.detailsJson) : undefined,
            rawLogRef: f.rawLogRef,
            evidenceRef: f.evidenceRef,
            remediationHint: f.remediationHint,
          },
        });
        findingsCount += 1;
        if (!severityMax || order.indexOf(f.severity) > order.indexOf(severityMax)) {
          severityMax = f.severity;
        }
      }

      await this.prisma.guardianScan.update({
        where: { id: scanId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          findingsCount,
          severityMax: severityMax ?? undefined,
        },
      });
    } catch (err) {
      await this.prisma.guardianScan.update({
        where: { id: scanId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }
}
