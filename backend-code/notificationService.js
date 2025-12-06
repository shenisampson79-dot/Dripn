const sgMail = require('@sendgrid/mail');

let sendGridSettings = null;

async function getSendGridCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  sendGridSettings = data.items?.[0];

  if (!sendGridSettings || (!sendGridSettings.settings.api_key || !sendGridSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }

  return {
    apiKey: sendGridSettings.settings.api_key,
    fromEmail: sendGridSettings.settings.from_email
  };
}

async function getSendGridClient() {
  const { apiKey, fromEmail } = await getSendGridCredentials();
  sgMail.setApiKey(apiKey);
  return { client: sgMail, fromEmail };
}

const ADMIN_EMAILS = [
  'shenisampson79@gmail.com',
  'sheni_sampson@yahoo.co.uk'
];

const ADMIN_PHONE = '+447835913601';

async function sendEmailNotification(subject, htmlContent, textContent) {
  try {
    const { client, fromEmail } = await getSendGridClient();
    
    const messages = ADMIN_EMAILS.map(email => ({
      to: email,
      from: fromEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
    }));

    await Promise.all(messages.map(msg => client.send(msg)));
    console.log('Email notifications sent to:', ADMIN_EMAILS.join(', '));
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error.message);
    return false;
  }
}

async function sendSMSNotification(message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    console.log('Twilio not configured - SMS notification skipped');
    console.log('To enable SMS, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER');
    return false;
  }

  try {
    const twilio = require('twilio')(accountSid, authToken);
    
    await twilio.messages.create({
      body: message,
      from: twilioPhone,
      to: ADMIN_PHONE
    });

    console.log('SMS notification sent to:', ADMIN_PHONE);
    return true;
  } catch (error) {
    console.error('Failed to send SMS notification:', error.message);
    return false;
  }
}

async function notifyVIPPurchase(customerEmail, customerName, purchaseDate) {
  const formattedDate = new Date(purchaseDate).toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const subject = 'New VIP Membership Purchase - StyleWise';
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a; border-bottom: 2px solid #c9a961;">New VIP Member</h1>
      <div style="background: linear-gradient(135deg, #c9a961 0%, #d4af37 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin: 0 0 10px 0;">VIP Membership Purchased!</h2>
        <p style="margin: 0; font-size: 18px;"><strong>${customerName || customerEmail}</strong></p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Customer Email:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${customerEmail}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Customer Name:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${customerName || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Purchase Date:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Tier:</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; color: #c9a961; font-weight: bold;">VIP</td>
        </tr>
      </table>
      <p style="margin-top: 20px; color: #666;">This VIP member now has access to unlimited posts and 4x 60-minute video styling sessions per month.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">StyleWise Admin Notification System</p>
    </div>
  `;

  const textContent = `
New VIP Membership Purchase - StyleWise

Customer: ${customerName || customerEmail}
Email: ${customerEmail}
Purchase Date: ${formattedDate}
Tier: VIP

This VIP member now has access to unlimited posts and 4x 60-minute video styling sessions per month.
  `;

  const smsMessage = `StyleWise VIP Alert: ${customerName || customerEmail} just purchased a VIP membership!`;

  const emailSent = await sendEmailNotification(subject, htmlContent, textContent);
  const smsSent = await sendSMSNotification(smsMessage);

  return { emailSent, smsSent };
}

module.exports = {
  sendEmailNotification,
  sendSMSNotification,
  notifyVIPPurchase,
  ADMIN_EMAILS,
  ADMIN_PHONE
};
