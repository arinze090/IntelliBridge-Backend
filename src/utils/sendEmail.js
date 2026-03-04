const axios = require('axios');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Helper function to compile the Handlebars template
// Use __dirname so the path is always relative to this file, not the cwd
function loadTemplate(templateName, context) {
  const templatePath = path.join(__dirname, '../../views', `${templateName}.handlebars`);
  const source = fs.readFileSync(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(source);
  return compiledTemplate(context);
}

const sendEmail = async (options) => {
  // Compile HTML from template
  // Pass the entire options object to the template so any custom variables are available
  const htmlContent = loadTemplate(options.template, {
    ...options,
    email: options.to, // convenience alias so templates can use {{email}} or {{to}}
  });

  const data = {
    sender: {
      email: process.env.EMAIL_FROM || 'noreply@legacybridgepublishing.com',
      name: 'Legacy Bridge Publishing',
    },
    to: [
      {
        email: options.to,
        name: options.name || 'User',
      },
    ],
    subject: options.subject,
    htmlContent,
  };

  try {
    const response = await axios.post(BREVO_API_URL, data, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log('Email sent successfully:', response.data.messageId);
  } catch (err) {
    // Log the full Brevo error and re-throw so the caller can handle it
    const errMsg = err.response?.data || err.message;
    console.error('Error sending email via Brevo:', errMsg);
    throw new Error(`Email delivery failed: ${JSON.stringify(errMsg)}`);
  }
};

module.exports = sendEmail;
