import axios from 'axios';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';

export interface ProvisionMailAccountParams {
  domain: string;
  domainId: string;
  email: string;
  tenantId: string;
}

export class MailService {
  private mailApiUrl: string;
  private mailApiKey: string;

  constructor() {
    this.mailApiUrl = env.MAILCORE_API_URL;
    this.mailApiKey = env.MAILCORE_API_KEY || '';
  }

  /**
   * Provision mail account on mail-core
   */
  async provisionMailAccount(params: ProvisionMailAccountParams): Promise<void> {
    const { domain, domainId, email, tenantId } = params;

    logger.info('Provisioning mail account', { domain, email });

    try {
      // For now, just create the database record
      // In production, you would call mail-core API to create mailbox

      const mailAccount = await prisma.mailAccount.create({
        data: {
          tenantId,
          domainId,
          email: `admin@${domain}`,
          status: 'ACTIVE',
          quotaMb: 1024, // 1GB default quota
        },
      });

      logger.info('Mail account provisioned successfully', {
        domain,
        mailAccountId: mailAccount.id,
        email: mailAccount.email,
      });

      // TODO: Call mail-core API to create actual mailbox
      // await axios.post(
      //   `${this.mailApiUrl}/mailboxes`,
      //   {
      //     email: `admin@${domain}`,
      //     password: generateRandomPassword(),
      //     quota: 1024,
      //   },
      //   {
      //     headers: {
      //       'X-API-Key': this.mailApiKey,
      //     },
      //   }
      // );
    } catch (error) {
      logger.error('Mail provisioning error', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(`Failed to provision mail account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get mail accounts for domain
   */
  async getMailAccounts(domainId: string): Promise<any[]> {
    return prisma.mailAccount.findMany({
      where: { domainId },
    });
  }
}

export default new MailService();
