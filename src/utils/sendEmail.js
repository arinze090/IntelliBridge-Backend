const axios = require('axios');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Helper function to compile the Handlebars template
async function loadTemplate(templateName, context) {
  // Using path.resolve to ensure we find the views directory from the project root
  const templatePath = path.resolve('views', `${templateName}.handlebars`);
  const source = fs.readFileSync(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(source);
  return compiledTemplate(context);
}

const sendEmail = async (options) => {
  try {
    // Compile HTML from template
    // Pass the entire options object to the template so any custom variables are available
    const htmlContent = await loadTemplate(options.template, {
      ...options,
      email: options.to, // Keep these as fallbacks/conveniences depending on template design
      name: options.name,
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

    const response = await axios.post(BREVO_API_URL, data, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log('Email sent successfully:', response.data.messageId);
  } catch (err) {
    console.error('Error sending email via Brevo:', err.response?.data || err.message);
  }
};

module.exports = sendEmail;
