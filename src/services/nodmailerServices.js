import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// verify connection (optional but useful)
transporter.verify((error, success) => {
  if (error) {
    console.log("Email server error:", error);
  } else {
    console.log("Email server is ready");
  }
});

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Your App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Nodemailer Error:", error.message);
    throw error;
  }
};