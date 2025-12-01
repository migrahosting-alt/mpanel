import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

const execAsync = promisify(exec);

export interface ProvisionHostingAccountParams {
  domain: string;
  domainId: string;
  customerId: string;
  email: string;
  tenantId: string;
}

export class HostingService {
  /**
   * Provision hosting account on srv1-web
   */
  async provisionHostingAccount(params: ProvisionHostingAccountParams): Promise<void> {
    const { domain, domainId, customerId, email, tenantId } = params;

    logger.info('Provisioning hosting account', { domain, email });

    try {
      // Get srv1-web server from database
      const server = await prisma.server.findFirst({
        where: {
          tenantId,
          role: 'WEB',
          isActive: true,
        },
      });

      if (!server) {
        throw new Error('No active WEB server found for tenant');
      }

      // Create hosting directory structure on srv1 via SSH
      const systemUser = domain.replace(/\./g, '_');
      const homeDir = `/srv/web/clients/${domain}`;

      const commands = [
        // Create directory structure
        `mkdir -p ${homeDir}/public`,
        `mkdir -p ${homeDir}/logs`,
        `mkdir -p ${homeDir}/private`,
        
        // Create default index.html
        `echo '<html><head><title>Welcome to ${domain}</title></head><body><h1>Your website is live!</h1><p>Hosted by MigraHosting</p></body></html>' > ${homeDir}/public/index.html`,
        
        // Set permissions
        `chown -R www-data:www-data ${homeDir}`,
        `chmod -R 755 ${homeDir}/public`,
        `chmod -R 750 ${homeDir}/logs`,
      ].join(' && ');

      const sshCommand = `ssh mhadmin@${server.ipAddress} "${commands}"`;

      logger.debug('Executing SSH command', {
        server: server.ipAddress,
        domain,
      });

      const { stdout, stderr } = await execAsync(sshCommand);

      if (stderr) {
        logger.warn('SSH command stderr', { stderr, domain });
      }

      logger.info('Hosting directory created', {
        domain,
        homeDir,
        stdout: stdout.trim(),
      });

      // Create hosting account record in database
      await prisma.hostingAccount.create({
        data: {
          tenantId,
          domainId,
          serverId: server.id,
          systemUser,
          homeDir,
          phpVersion: '8.2',
          status: 'ACTIVE',
        },
      });

      logger.info('Hosting account provisioned successfully', {
        domain,
        systemUser,
        homeDir,
      });
    } catch (error) {
      logger.error('Hosting provisioning error', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(`Failed to provision hosting account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get hosting account by domain
   */
  async getHostingAccount(domainId: string): Promise<any> {
    return prisma.hostingAccount.findUnique({
      where: { domainId },
      include: {
        server: true,
        domain: true,
      },
    });
  }

  /**
   * Suspend hosting account
   */
  async suspendHostingAccount(domainId: string): Promise<void> {
    await prisma.hostingAccount.update({
      where: { domainId },
      data: {
        status: 'SUSPENDED',
      },
    });

    logger.info('Hosting account suspended', { domainId });
  }

  /**
   * Unsuspend hosting account
   */
  async unsuspendHostingAccount(domainId: string): Promise<void> {
    await prisma.hostingAccount.update({
      where: { domainId },
      data: {
        status: 'ACTIVE',
      },
    });

    logger.info('Hosting account unsuspended', { domainId });
  }
}

export default new HostingService();
