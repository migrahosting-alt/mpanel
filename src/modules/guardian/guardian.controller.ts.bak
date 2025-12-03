import { Controller, Get, Post, Req, Body, Query, Param } from '@nestjs/common';
import { GuardianService, ActorContext } from './guardian.service';

@Controller('guardian')
export class GuardianController {
  constructor(private readonly guardian: GuardianService) {}

  private ctx(req: any): ActorContext {
    const user = req.user ?? {};
    return {
      userId: user.id ?? null,
      tenantId: user.tenantId ?? null,
      roles: user.roles ?? [],
      isPlatform: !!user.isPlatform,
    };
  }

  @Get('summary')
  async summary(@Req() req) {
    const ctx = this.ctx(req);
    return this.guardian.tenantSummary(ctx, ctx.tenantId!);
  }

  @Get('instance')
  async getInstance(@Req() req) {
    const ctx = this.ctx(req);
    return this.guardian.getInstanceForTenant(ctx, ctx.tenantId!);
  }

  @Post('instance')
  async upsertInstance(@Req() req, @Body() body: any) {
    const ctx = this.ctx(req);
    return this.guardian.upsertInstanceForTenant(ctx, ctx.tenantId!, body);
  }

  @Post('scan')
  async triggerScan(@Req() req, @Body() body: { type: string; serverId?: string }) {
    const ctx = this.ctx(req);
    return this.guardian.triggerScan(ctx, ctx.tenantId!, body);
  }

  @Get('scans')
  async listScans(@Req() req, @Query('limit') limit?: string) {
    const ctx = this.ctx(req);
    return this.guardian.listScans(ctx, ctx.tenantId!, limit ? parseInt(limit, 10) : 50);
  }

  @Get('findings')
  async listFindings(
    @Req() req,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    const ctx = this.ctx(req);
    return this.guardian.listFindings(ctx, ctx.tenantId!, { status, severity });
  }

  @Get('remediations')
  async listRemediations(@Req() req, @Query('status') status?: string) {
    const ctx = this.ctx(req);
    return this.guardian.listRemediations(ctx, ctx.tenantId!, status);
  }

  @Post('remediations/request')
  async requestRemediation(@Req() req, @Body() body: any) {
    const ctx = this.ctx(req);
    return this.guardian.requestRemediation(ctx, ctx.tenantId!, body);
  }

  @Post('remediations/:id/approve-tenant')
  async approveTenant(@Req() req, @Param('id') id: string) {
    const ctx = this.ctx(req);
    return this.guardian.approveRemediation(ctx, id, 'tenant');
  }

  @Post('remediations/:id/approve-platform')
  async approvePlatform(@Req() req, @Param('id') id: string) {
    const ctx = this.ctx(req);
    return this.guardian.approveRemediation(ctx, id, 'platform');
  }

  @Get('platform/metrics')
  async platformMetrics(@Req() req) {
    const ctx = this.ctx(req);
    return this.guardian.platformMetrics(ctx);
  }
}
