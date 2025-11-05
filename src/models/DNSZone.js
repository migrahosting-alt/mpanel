import pool from '../config/database.js';

class DNSZone {
  static async create(zoneData) {
    const {
      tenantId,
      customerId,
      domainId,
      name,
      type = 'MASTER',
      master,
      dnssec = false,
      metadata = {}
    } = zoneData;

    // Generate initial serial (YYYYMMDDnn format)
    const now = new Date();
    const serial = parseInt(
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}01`
    );

    const result = await pool.query(
      `INSERT INTO dns_zones (
        tenant_id, customer_id, domain_id, name, type, master, dnssec, serial, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *`,
      [tenantId, customerId, domainId, name, type, master, dnssec, serial, metadata]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM dns_zones WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM dns_zones WHERE name = $1',
      [name]
    );
    return result.rows[0];
  }

  static async findByTenant(tenantId) {
    const result = await pool.query(
      'SELECT * FROM dns_zones WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    return result.rows;
  }

  static async incrementSerial(id) {
    const result = await pool.query(
      `UPDATE dns_zones 
       SET serial = serial + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async addRecord(zoneId, recordData) {
    const {
      name,
      type,
      content,
      ttl = 3600,
      priority,
      metadata = {}
    } = recordData;

    const result = await pool.query(
      `INSERT INTO dns_records (
        zone_id, name, type, content, ttl, priority, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [zoneId, name, type, content, ttl, priority, metadata]
    );

    // Increment zone serial
    await this.incrementSerial(zoneId);

    return result.rows[0];
  }

  static async getRecords(zoneId) {
    const result = await pool.query(
      'SELECT * FROM dns_records WHERE zone_id = $1 AND disabled = FALSE ORDER BY type, name',
      [zoneId]
    );
    return result.rows;
  }

  static async updateRecord(recordId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(recordId);
    
    const result = await pool.query(
      `UPDATE dns_records SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    // Get zone_id and increment serial
    if (result.rows[0]) {
      await this.incrementSerial(result.rows[0].zone_id);
    }

    return result.rows[0];
  }

  static async deleteRecord(recordId) {
    const record = await pool.query(
      'SELECT zone_id FROM dns_records WHERE id = $1',
      [recordId]
    );

    await pool.query(
      'DELETE FROM dns_records WHERE id = $1',
      [recordId]
    );

    // Increment zone serial
    if (record.rows[0]) {
      await this.incrementSerial(record.rows[0].zone_id);
    }
  }

  static async createDefaultRecords(zoneId, zoneName, ipAddress, ipAddressV6 = null) {
    const records = [
      { name: zoneName, type: 'A', content: ipAddress, ttl: 3600 },
      { name: `www.${zoneName}`, type: 'A', content: ipAddress, ttl: 3600 },
      { name: zoneName, type: 'MX', content: `mail.${zoneName}`, ttl: 3600, priority: 10 },
      { name: `mail.${zoneName}`, type: 'A', content: ipAddress, ttl: 3600 },
      { name: zoneName, type: 'TXT', content: `v=spf1 mx a ip4:${ipAddress} ~all`, ttl: 3600 },
    ];

    if (ipAddressV6) {
      records.push(
        { name: zoneName, type: 'AAAA', content: ipAddressV6, ttl: 3600 },
        { name: `www.${zoneName}`, type: 'AAAA', content: ipAddressV6, ttl: 3600 }
      );
    }

    for (const record of records) {
      await this.addRecord(zoneId, record);
    }
  }
}

export default DNSZone;
