const mongoose = require('mongoose');
const Lead = require('../models/lead.model');
const { sendContactLeadEmail } = require('../services/email.service');
const { sendWebhookNotification } = require('../services/webhook.service');
const { sendRealtimeLead } = require('../services/sse.service');
const { saveLocalLead, getLocalLeads } = require('../utils/localStore');

const createContactLead = async (req, res) => {
  const { name, phone, email, requirement, project, message } = req.body;
  console.log(`[POST /api/contact] Received lead from ${name} (${phone})`);

  if (!name || !phone || !email || !requirement) {
    return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
  }

  // 1. Save to MongoDB if connected
  let leadId = null;
  if (mongoose.connection.readyState === 1) {
    try {
      const leadEntry = new Lead({ name, phone, email, requirement, project, message });
      const savedLead = await leadEntry.save();
      leadId = savedLead._id;
      console.log(`[DB SUCCESS] Lead saved with ID: ${leadId}`);
    } catch (dbError) {
      console.error('[DB ERROR] Failed to save lead:', dbError.message);
    }
  }

  // Fallback to local storage if DB is disconnected/failed
  if (!leadId) {
    leadId = new mongoose.Types.ObjectId();
    saveLocalLead({
      _id: leadId.toString(),
      name,
      phone,
      email,
      requirement,
      project,
      message,
      type: 'contact',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Send Email Notification (non-blocking)
  sendContactLeadEmail({ name, phone, email, requirement, project, message, leadId }).catch((err) => {
    console.warn('[Email Warning]:', err.message);
  });

  // 3. Trigger Webhook & SSE
  sendWebhookNotification('NEW_ENQUIRY', { name, phone, email, requirement, project, message, leadId });
  sendRealtimeLead('NEW_ENQUIRY', { name, phone, email, requirement, project, message, leadId });

  return res.status(200).json({ success: true, message: 'Your inquiry has been received. We will call you back.' });
};

const getEnquiries = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbLeads = await Lead.find().sort({ timestamp: -1 });
      const leads = dbLeads.map((l) => ({
        id: l._id.toString(),
        name: l.name,
        phone: l.phone,
        email: l.email,
        requirement: l.requirement,
        project: l.project,
        message: l.message,
        timestamp: l.timestamp,
      }));
      return res.json({ leads });
    }
    const localLeads = getLocalLeads('contact');
    res.json({ leads: localLeads });
  } catch (e) {
    console.error('Error fetching leads:', e);
    res.status(500).json({ error: 'Error reading leads' });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Lead.findByIdAndDelete(req.params.id);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed' });
  }
};

module.exports = {
  createContactLead,
  getEnquiries,
  deleteEnquiry,
};
