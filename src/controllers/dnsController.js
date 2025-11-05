import DNSZone from '../models/DNSZone.js';
import logger from '../config/logger.js';

export const createZone = async (req, res) => {
  try {
    const zoneData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const zone = await DNSZone.create(zoneData);
    
    // Create default records if requested
    if (req.body.createDefaults && req.body.ipAddress) {
      await DNSZone.createDefaultRecords(
        zone.id,
        zone.name,
        req.body.ipAddress,
        req.body.ipAddressV6
      );
    }
    
    logger.info(`DNS zone created: ${zone.id}`, { userId: req.user.id });
    res.status(201).json(zone);
  } catch (error) {
    logger.error('Error creating DNS zone:', error);
    res.status(500).json({ error: 'Failed to create DNS zone' });
  }
};

export const getZones = async (req, res) => {
  try {
    const zones = await DNSZone.findByTenant(req.user.tenantId);
    res.json(zones);
  } catch (error) {
    logger.error('Error fetching DNS zones:', error);
    res.status(500).json({ error: 'Failed to fetch DNS zones' });
  }
};

export const getZone = async (req, res) => {
  try {
    const zone = await DNSZone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }
    res.json(zone);
  } catch (error) {
    logger.error('Error fetching DNS zone:', error);
    res.status(500).json({ error: 'Failed to fetch DNS zone' });
  }
};

export const getZoneRecords = async (req, res) => {
  try {
    const records = await DNSZone.getRecords(req.params.id);
    res.json(records);
  } catch (error) {
    logger.error('Error fetching DNS records:', error);
    res.status(500).json({ error: 'Failed to fetch DNS records' });
  }
};

export const createRecord = async (req, res) => {
  try {
    const record = await DNSZone.addRecord(req.params.id, req.body);
    logger.info(`DNS record created in zone: ${req.params.id}`, { userId: req.user.id });
    res.status(201).json(record);
  } catch (error) {
    logger.error('Error creating DNS record:', error);
    res.status(500).json({ error: 'Failed to create DNS record' });
  }
};

export const updateRecord = async (req, res) => {
  try {
    const record = await DNSZone.updateRecord(req.params.recordId, req.body);
    if (!record) {
      return res.status(404).json({ error: 'DNS record not found' });
    }
    logger.info(`DNS record updated: ${req.params.recordId}`, { userId: req.user.id });
    res.json(record);
  } catch (error) {
    logger.error('Error updating DNS record:', error);
    res.status(500).json({ error: 'Failed to update DNS record' });
  }
};

export const deleteRecord = async (req, res) => {
  try {
    await DNSZone.deleteRecord(req.params.recordId);
    logger.info(`DNS record deleted: ${req.params.recordId}`, { userId: req.user.id });
    res.json({ message: 'DNS record deleted successfully' });
  } catch (error) {
    logger.error('Error deleting DNS record:', error);
    res.status(500).json({ error: 'Failed to delete DNS record' });
  }
};
