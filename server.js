const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['https://soulshaktiwellness.com', 'https://www.soulshaktiwellness.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Initialize Services
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Health Check Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Soul Shakti Wellness API - Divine Blessings 🙏',
    status: 'running',
    endpoints: {
      assessment: '/api/assessment/analyze',
      createOrder: '/api/payment/create-order',
      verifyPayment: '/api/payment/verify',
      createBooking: '/api/booking/create'
    }
  });
});

// Assessment Analysis Route
app.post('/api/assessment/analyze', async (req, res) => {
  try {
    const { answers, contactInfo } = req.body;

    // Generate AI Analysis (you'll integrate OpenAI here)
    const analysis = generateAnalysis(answers);

    // Send Email with Results
    await sendAssessmentEmail(contactInfo, analysis);

    res.json({
      success: true,
      analysis: analysis
    });
  } catch (error) {
    console.error('Assessment Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze assessment' 
    });
  }
});

// Create Razorpay Order
app.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', bookingData } = req.body;

    const options = {
      amount: amount * 100, // Convert to paise
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        service: bookingData.service,
        customerName: bookingData.name,
        customerEmail: bookingData.email,
        date: bookingData.date,
        time: bookingData.time
      }
    };

    const order = await razorpay.orders.create(options);

     res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      },
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Payment Order Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create payment order' 
    });
  }
});

// Verify Razorpay Payment
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      bookingData 
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Payment verified successfully
      // Send confirmation email
      await sendBookingConfirmationEmail(bookingData, razorpay_payment_id);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }
  } catch (error) {
    console.error('Payment Verification Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Payment verification failed' 
    });
  }
});

// Create Booking (Pay After Session)
app.post('/api/booking/create', async (req, res) => {
  try {
    const { bookingData } = req.body;

    // Generate booking reference
    const bookingRef = `SSW-${Date.now().toString(36).toUpperCase()}`;

  // Send booking confirmation email
    // await sendBookingConfirmationEmail({
    //   ...bookingData,
    //   bookingRef: bookingRef,
    //   paymentStatus: 'Pay After Session'
    // });
    res.json({
      success: true,
      bookingRef: bookingRef,
      message: 'Booking confirmed successfully'
    });
  } catch (error) {
    console.error('Booking Creation Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking' 
    });
  }
});

// ============================================
// ABUNDANCE QUIZ ENDPOINT
// ============================================

// Submit Quiz Response
app.post('/api/quiz/submit', async (req, res) => {
  try {
    const quizData = req.body;
    
    console.log('Quiz submission received:', quizData);
    
    // Forward to Google Apps Script webhook
    const webhookUrl = process.env.QUIZ_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error('Quiz webhook URL not configured');
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quizData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save quiz response');
    }
    
    console.log('Quiz response saved to Google Sheets');
    
    res.json({
      success: true,
      message: 'Quiz response saved successfully',
      recommendedService: quizData.recommendedService
    });
    
  } catch (error) {
    console.error('Quiz submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit quiz'
    });
  }
});
// Helper Functions

function generateAnalysis(answers) {
  // Basic analysis logic - you can integrate OpenAI API here
  const stressLevel = parseInt(answers[2]) || 5;
  const selfConnection = parseInt(answers[6]) || 5;
  
  const score = Math.max(50, Math.min(100, 100 - (stressLevel * 5) + (selfConnection * 5)));

  return {
    overallScore: score,
    primaryFocus: determinePrimaryFocus(answers),
    recommendations: [
      "Begin daily gratitude practice with Maa Durga's blessings",
      "Schedule regular meditation and energy healing sessions",
      "Work on subconscious reprogramming for limiting beliefs",
      "Join our transformation package for comprehensive healing"
    ],
    nextSteps: [
      "Book a free 15-minute consultation call",
      "Join our divine community WhatsApp group",
      "Start the 7-day gratitude challenge",
      "Schedule your first transformation session"
    ]
  };
}

function determinePrimaryFocus(answers) {
  const areas = [
    "Career & Purpose",
    "Relationships & Love",
    "Health & Wellbeing",
    "Spiritual Growth",
    "Financial Abundance"
  ];
  
  // Simple logic - use answer from question 3
  return answers[3] || "Spiritual Growth & Inner Peace";
}

async function sendAssessmentEmail(contactInfo, analysis) {
  const msg = {
    to: contactInfo.email,
    from: process.env.SENDGRID_FROM_EMAIL || 'soulshaktie@gmail.com',
    subject: 'Your Soul Shakti Assessment Results - Divine Guidance 🙏',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🦁 Soul Shakti Wellness</h1>
          <p style="margin: 10px 0 0 0;">Your Divine Assessment Results</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 2px solid #fed7aa; border-radius: 0 0 10px 10px;">
          <p>Dear ${contactInfo.name},</p>
          
          <p>Blessed with Maa Durga's divine grace! 🙏</p>
          
          <div style="background: #fff7ed; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #ea580c; margin: 0 0 10px 0;">Your Divine Readiness Score</h2>
            <div style="font-size: 48px; font-weight: bold; color: #ea580c; text-align: center;">
              ${analysis.overallScore}%
            </div>
          </div>
          
          <h3 style="color: #ea580c;">Primary Focus Area:</h3>
          <p style="background: #fff7ed; padding: 15px; border-radius: 5px;">
            ${analysis.primaryFocus}
          </p>
          
          <h3 style="color: #ea580c;">Personalized Recommendations:</h3>
          <ul>
            ${analysis.recommendations.map(rec => `<li style="margin: 10px 0;">${rec}</li>`).join('')}
          </ul>
          
          <h3 style="color: #ea580c;">Your Next Steps:</h3>
          <ul>
            ${analysis.nextSteps.map(step => `<li style="margin: 10px 0;">${step}</li>`).join('')}
          </ul>
          
          <div style="background: #ea580c; color: white; padding: 20px; border-radius: 10px; margin: 30px 0; text-align: center;">
            <h3 style="margin: 0 0 15px 0;">Ready to Begin Your Divine Journey?</h3>
            <a href="${process.env.FRONTEND_URL}/booking" style="display: inline-block; background: white; color: #ea580c; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
              Book Your First Session
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            With divine blessings,<br>
            <strong>Nagesh</strong><br>
            Founder, Soul Shakti Wellness<br>
            📧 soulshaktie@gmail.com
          </p>
        </div>
      </div>
    `
  };

  await sgMail.send(msg);
}

async function sendBookingConfirmationEmail(bookingData, paymentId = null) {
  const msg = {
    to: bookingData.email,
    from: process.env.SENDGRID_FROM_EMAIL || 'soulshaktie@gmail.com',
    subject: '✅ Booking Confirmed - Soul Shakti Wellness',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🦁 Soul Shakti Wellness</h1>
          <p style="margin: 10px 0 0 0;">Your Session is Confirmed!</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 2px solid #fed7aa; border-radius: 0 0 10px 10px;">
          <div style="background: #dcfce7; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
            <h2 style="color: #16a34a; margin: 0;">✓ Booking Confirmed!</h2>
          </div>
          
          <p>Dear ${bookingData.name},</p>
          
          <p>Your divine transformation journey begins! Blessed with Maa Durga's grace 🙏</p>
          
          <div style="background: #fff7ed; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #ea580c; margin: 0 0 15px 0;">Booking Details</h3>
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Booking Reference:</td>
                <td style="padding: 8px 0; font-weight: bold;">${bookingData.bookingRef || 'SSW-' + Date.now().toString(36).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Service:</td>
                <td style="padding: 8px 0; font-weight: bold;">${bookingData.service}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date & Time:</td>
                <td style="padding: 8px 0; font-weight: bold;">${bookingData.date} at ${bookingData.time}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Format:</td>
                <td style="padding: 8px 0; font-weight: bold;">${bookingData.format}</td>
              </tr>
              ${paymentId ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Payment ID:</td>
                <td style="padding: 8px 0; font-weight: bold;">${paymentId}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #666;">Payment Status:</td>
                <td style="padding: 8px 0; font-weight: bold; color: ${paymentId ? '#16a34a' : '#ea580c'};">
                  ${paymentId ? '✓ Paid' : 'Pay After Session'}
                </td>
              </tr>
            </table>
          </div>
          
          <h3 style="color: #ea580c;">What's Next?</h3>
          <ul>
            <li style="margin: 10px 0;">You'll receive a reminder 24 hours before your session</li>
            <li style="margin: 10px 0;">Meeting link will be sent 1 hour before (for online sessions)</li>
            <li style="margin: 10px 0;">Prepare any questions or topics you'd like to discuss</li>
            <li style="margin: 10px 0;">Come with an open heart and mind 🙏</li>
          </ul>
          
          <div style="background: #fff7ed; padding: 15px; border-radius: 10px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Need to reschedule?</strong> Please contact us at least 24 hours in advance.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            With divine blessings,<br>
            <strong>Nagesh</strong><br>
            Founder, Soul Shakti Wellness<br>
            📧 soulshaktie@gmail.com<br>
            🌐 www.soulshaktiwellness.com
          </p>
        </div>
      </div>
    `
  };

  await sgMail.send(msg);
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Soul Shakti API running on port ${PORT}`);
  console.log(`🙏 Blessed with Maa Durga's divine grace`);
});
