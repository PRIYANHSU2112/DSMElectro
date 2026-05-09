import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const msg = {
      to,
      from: process.env.EMAIL_FROM,
      subject,
      text,
      html,
    };

    await sgMail.send(msg);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("SendGrid Error:", error.response?.body || error.message);
    throw error;
  }
};