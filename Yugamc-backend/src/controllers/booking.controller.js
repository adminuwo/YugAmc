const mongoose = require('mongoose');
const BookVisit = require('../models/bookVisit.model');
const { sendBookVisitEmail } = require('../services/email.service');
const { sendWebhookNotification } = require('../services/webhook.service');
const { sendRealtimeLead } = require('../services/sse.service');
const { saveLocalLead, getLocalLeads } = require('../utils/localStore');

const createBooking = async (req, res) => {
  const { name, phone, email, location, budget, visitDate, timeSlot } = req.body;
  console.log(`[POST /api/book-visit] Received booking from ${name} (${phone})`);

  if (!name || !phone || !email || !visitDate) {
    return res.status(400).json({ success: false, message: 'Required fields missing.' });
  }

  // 1. Save to MongoDB if connected
  let bookingId = null;
  if (mongoose.connection.readyState === 1) {
    try {
      const bookingEntry = new BookVisit({ name, phone, email, location, budget, visitDate, timeSlot });
      const savedBooking = await bookingEntry.save();
      bookingId = savedBooking._id;
      console.log(`[DB SUCCESS] Booking saved with ID: ${bookingId}`);
    } catch (dbError) {
      console.error('[DB ERROR] Failed to save booking:', dbError.message);
    }
  }

  // Fallback to local storage if DB is disconnected/failed
  if (!bookingId) {
    bookingId = new mongoose.Types.ObjectId();
    saveLocalLead({
      _id: bookingId.toString(),
      name,
      phone,
      email,
      location,
      budget,
      visitDate,
      timeSlot,
      type: 'booking',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Send Email Notification (non-blocking)
  sendBookVisitEmail({ name, phone, email, location, budget, visitDate, timeSlot, bookingId }).catch((err) => {
    console.warn('[Email Warning]:', err.message);
  });

  // 3. Trigger Webhook & SSE
  sendWebhookNotification('NEW_BOOKING', { name, phone, email, location, budget, visitDate, timeSlot, bookingId });
  sendRealtimeLead('NEW_BOOKING', { name, phone, email, location, budget, visitDate, timeSlot, bookingId });

  return res.status(200).json({
    success: true,
    message: 'Your site visit has been booked successfully! Our team will contact you shortly.',
  });
};

const getBookings = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const leads = await BookVisit.find().sort({ timestamp: -1 });
      return res.json({ leads });
    }
    const localLeads = getLocalLeads('booking');
    res.json({ leads: localLeads });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching book visit leads' });
  }
};

const deleteBooking = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await BookVisit.findByIdAndDelete(req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting lead' });
  }
};

module.exports = {
  createBooking,
  getBookings,
  deleteBooking,
};
