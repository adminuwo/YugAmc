const mongoose = require('mongoose');
const ChatLead = require('../models/chatLead.model');
const RagFile = require('../models/ragFile.model');
const { sendChatRegistrationEmail } = require('../services/email.service');
const { sendWebhookNotification } = require('../services/webhook.service');
const { sendRealtimeLead } = require('../services/sse.service');
const { generateResponse } = require('../services/chat.service');
const { saveLocalLead, getLocalLeads } = require('../utils/localStore');

const registerChatLead = async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and Email are required' });

  try {
    const leadId = new mongoose.Types.ObjectId();
    let isDbSaved = false;

    // 1. Try to save to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const newLead = new ChatLead({ _id: leadId, name, email, messages: [] });
        await newLead.save();
        isDbSaved = true;
      } catch (dbErr) {
        console.warn('[DB Warning] MongoDB save failed, falling back to local store:', dbErr.message);
      }
    }

    // 2. If DB was offline or save failed, store locally
    if (!isDbSaved) {
      saveLocalLead({
        _id: leadId.toString(),
        name,
        email,
        messages: [],
        type: 'chat_lead',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Send Email Notification to Admin (non-blocking)
    sendChatRegistrationEmail(name, email).catch((err) => {
      console.warn('[Email Warning]:', err.message);
    });

    // 4. Trigger Webhook & SSE
    sendWebhookNotification('NEW_CHAT_LEAD', { name, email, leadId });
    sendRealtimeLead('NEW_CHAT_LEAD', { name, email, leadId });

    return res.json({ success: true, leadId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

const getChatLeads = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const leads = await ChatLead.find().sort({ timestamp: -1 });
      return res.json({ leads });
    }
    // Fallback to local store
    const localLeads = getLocalLeads('chat_lead');
    res.json({ leads: localLeads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat leads' });
  }
};

const getChatLeadHistory = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const lead = await ChatLead.findById(req.params.id);
      if (lead) return res.json({ lead });
    }
    const localLeads = getLocalLeads('chat_lead');
    const lead = localLeads.find((l) => l._id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

const exportChatLeads = async (req, res) => {
  try {
    let leads = [];
    if (mongoose.connection.readyState === 1) {
      leads = await ChatLead.find().sort({ timestamp: -1 });
    } else {
      leads = getLocalLeads('chat_lead');
    }

    let csv = 'Name,Email,Registration Time,Message Count\n';
    leads.forEach((l) => {
      const timeStr = l.timestamp ? new Date(l.timestamp).toISOString() : new Date().toISOString();
      const count = (l.messages && l.messages.length) || 0;
      csv += `"${l.name}","${l.email}","${timeStr}","${count}"\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('yug_amc_chat_leads.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
};

const chatWithAI = async (req, res) => {
  const { message, history, leadId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // If leadId is provided and DB is connected, save user message
    if (leadId && mongoose.connection.readyState === 1) {
      try {
        await ChatLead.findByIdAndUpdate(leadId, {
          $push: { messages: { role: 'user', content: message } },
        });
      } catch (err) {
        console.warn('[DB Warning] Could not persist user message to MongoDB:', err.message);
      }
    }

    // Get Dynamic RAG Context from DB if connected
    let contextLines = '';
    if (mongoose.connection.readyState === 1) {
      try {
        const ragEntries = await RagFile.find({}, 'content');
        contextLines = ragEntries.map((f) => f.content).join('\n\n---\n\n');
        if (contextLines.length > 20000) {
          contextLines = contextLines.substring(0, 20000) + '\n...[Context Truncated]...';
        }
      } catch (err) {
        console.warn('[DB Warning] Could not read RAG context:', err.message);
      }
    }

    const responseText = await generateResponse(message, history, contextLines);

    // If leadId is provided and DB is connected, save model response
    if (leadId && mongoose.connection.readyState === 1) {
      try {
        await ChatLead.findByIdAndUpdate(leadId, {
          $push: { messages: { role: 'model', content: responseText } },
        });
      } catch (err) {
        console.warn('[DB Warning] Could not persist assistant message to MongoDB:', err.message);
      }
    }

    res.json({ response: responseText });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Assistant error', details: error.message });
  }
};

module.exports = {
  registerChatLead,
  getChatLeads,
  getChatLeadHistory,
  exportChatLeads,
  chatWithAI,
};
