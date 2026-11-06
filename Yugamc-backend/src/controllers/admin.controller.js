const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const Lead = require('../models/lead.model');
const BookVisit = require('../models/bookVisit.model');
const ChatLead = require('../models/chatLead.model');
const RagFile = require('../models/ragFile.model');
const { uploadFile, deleteFile: deleteFileFromStorage } = require('../services/storage.service');
const { extractText } = require('../services/parser.service');
const { verifySignature } = require('../services/webhook.service');

// Admin Login
const login = async (req, res) => {
  const { username, password } = req.body;
  const rawUser = (username || '').trim();
  const rawPass = (password || '').trim();
  const lowerUser = rawUser.toLowerCase();

  const validUsers = [
    'admin',
    'admin@uwo24.com',
    (env.ADMIN_USERNAME || '').toLowerCase(),
    (env.EMAIL_USER || '').toLowerCase()
  ].filter(Boolean);

  const isUserValid = validUsers.includes(lowerUser);
  let isPassValid = false;
  if (env.ADMIN_PASSWORD_HASH) {
    isPassValid = await bcrypt.compare(rawPass, env.ADMIN_PASSWORD_HASH);
  } else if (env.ADMIN_PASSWORD) {
    isPassValid = rawPass === env.ADMIN_PASSWORD;
  }

  if (isUserValid && isPassValid) {
    const token = jwt.sign({ username: rawUser }, env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
};

// Super Admin Connector
const connector = async (req, res) => {
  const signature = req.headers['x-super-admin-signature'];
  const secret = env.SUPER_ADMIN_WEBHOOK_SECRET;
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payloadStr = JSON.stringify(req.body);
  if (!verifySignature(signature, payloadStr, secret)) {
    console.warn('[Connector] Signature mismatch!');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const { action } = req.body;
  console.log(`[Connector] Received Action: ${action}`);

  try {
    switch(action) {
      case 'GET_STATS':
        const leadCount = await Lead.countDocuments();
        const bookingCount = await BookVisit.countDocuments();
        const chatCount = await ChatLead.countDocuments();
        return res.json({ success: true, stats: { leads: leadCount, bookings: bookingCount, chats: chatCount } });
      
      case 'GET_LEADS':
        const leads = await Lead.find().sort({ timestamp: -1 }).limit(50);
        return res.json({ success: true, leads });

      case 'GET_BOOKINGS':
        const bookings = await BookVisit.find().sort({ timestamp: -1 }).limit(50);
        return res.json({ success: true, bookings });

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Command execution failed', details: error.message });
  }
};

// Get all leads
const getAllLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ timestamp: -1 });
    const bookings = await BookVisit.find().sort({ timestamp: -1 });
    const chatLeads = await ChatLead.find().sort({ timestamp: -1 });
    res.json({ success: true, leads, bookings, chatLeads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads', details: error.message });
  }
};

// Dedicated webhook leads
const getWebhookLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ timestamp: -1 });
    const bookings = await BookVisit.find().sort({ timestamp: -1 });
    const chatLeads = await ChatLead.find().sort({ timestamp: -1 });

    res.json({
      success: true,
      total_leads: leads.length + bookings.length + chatLeads.length,
      leads: leads,
      bookings: bookings,
      chat_leads: chatLeads
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve leads via webhook', details: error.message });
  }
};


// Upload RAG files
const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    console.log(`[RAG] Processing ${req.files.length} files...`);
    let indexedCount = 0;
    
    for (let file of req.files) {
      try {
        console.log(`[RAG] Extracting: ${file.originalname}`);
        const extractedText = await extractText(file.path, file.originalname);
        
        if (extractedText && extractedText.trim().length > 0) {
          // 1. Upload to GCS
          console.log(`[GCS] Syncing to Bucket: ${file.originalname}`);
          await uploadFile(file.path, file.originalname);
            
          // 2. Save/Update in MongoDB
          await RagFile.findOneAndUpdate(
            { name: file.originalname },
            { 
              name: file.originalname,
              size: file.size,
              content: extractedText,
              uploadedAt: new Date()
            },
            { upsert: true, new: true }
          );

          indexedCount++;
          console.log(`[RAG + DB] Persisted: ${file.originalname}`);
        } else {
          console.warn(`[RAG] Skipping ${file.originalname}: No text extracted.`);
        }
      } catch (fileError) {
        console.error(`[RAG / GCS / DB] Fatal Error processing ${file.originalname}:`, fileError.message);
      } finally {
        // Ensure temp local file is cleaned up in all cases
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkError) {
            console.error(`Failed to delete temp file ${file.path}:`, unlinkError);
          }
        }
      }
    }
    
    if (indexedCount === 0) {
      return res.status(400).json({ error: 'Koi bhi file train nahi ho saki. Content check karein.' });
    }

    res.json({ message: `${indexedCount} files training database mein safe hain aur GCS par upload ho gayi hain!` });
  } catch (error) {
    console.error('[RAG] Internal Error:', error);
    res.status(500).json({ error: 'Server error during indexing.', details: error.message });
  }
};

// Get files list
const getFiles = async (req, res) => {
  try {
    const files = await RagFile.find().sort({ uploadedAt: -1 });
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: 'Database list retrieval failed.' });
  }
};

// Delete file
const deleteFile = async (req, res) => {
  const { filename } = req.params;
  try {
    // 1. Delete from Bucket
    try {
      await deleteFileFromStorage(filename);
      console.log(`[GCS] Deleted ${filename} from bucket`);
    } catch (e) {
      console.warn(`[GCS] Could not delete ${filename} from bucket (might not exist)`);
    }

    // 2. Delete from MongoDB
    const result = await RagFile.deleteOne({ name: filename });
    
    if (result.deletedCount > 0) {
      return res.json({ message: 'File and trained data deleted permanently' });
    }
    res.status(404).json({ error: 'File entry not found in database' });
  } catch (dbError) {
    res.status(500).json({ error: 'Deletion failed at database level' });
  }
};

module.exports = {
  login,
  connector,
  getAllLeads,
  getWebhookLeads,
  uploadFiles,
  getFiles,
  deleteFile
};
