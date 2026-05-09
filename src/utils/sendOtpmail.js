export const sendOTPEmail = async (to, otp) => {
  return sendEmail({
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${otp}</h2>`,
  });
};
