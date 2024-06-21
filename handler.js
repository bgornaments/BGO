'use strict';
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports.sendEmail = async (event) => {
  try {
    // Parse the event body to extract necessary data
    const { receiver_email, subject, body_text } = JSON.parse(event.body);

    // Validate required fields
    if (!receiver_email || !subject || !body_text) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Missing required fields: receiver_email, subject, body_text',
        }),
      };
    }

    // Validate email format using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(receiver_email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid email format',
        }),
      };
    }

    // Construct the email message
    const msg = {
      to: receiver_email,
      from: 'your-email@example.com', // Use your verified sender email
      subject: subject,
      text: body_text,
    };

    // Send the email using SendGrid
    await sgMail.send(msg);

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email sent successfully!',
      }),
    };
  } catch (error) {
    console.error('Error sending email:', error);

    // Handle errors
    let statusCode = 500;
    let errorMessage = 'Failed to send email';
    
    // Check for SendGrid specific errors
    if (error.response && error.response.body && error.response.body.errors) {
      errorMessage = error.response.body.errors.map(e => e.message).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Return error response
    return {
      statusCode: statusCode,
      body: JSON.stringify({
        message: errorMessage,
      }),
    };
  }
};
