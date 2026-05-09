import userModel from "../model/user.model.js";
import { AppError } from "../utils/apiResponse.js";

/** Self-contained login/register-by-OTP for bulk inquiry only (does not use auth services). */

const FIXED_OTP = "1234";

function normalizePhone(phone) {
  if (phone == null || phone === "") return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export default class BulkInquiryAuthService {
  /** Existing user: attach OTP; new user: create with OTP. */
  static async sendOtp({ phone, firstName, lastName }) {
    const n = normalizePhone(phone);
    if (!n) throw new AppError("Phone number is required", 400);

    let user = await userModel
      .findOne({ number: n })
      .sort({ updatedAt: -1, _id: -1 });

    const code = FIXED_OTP;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (user) {
      user.otp = { code, expiresAt };
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      user.markModified("otp");
      await user.save();
    } else {
      user = await userModel.create({
        firstName,
        lastName,
        number: n,
        otp: { code, expiresAt },
      });
    }

    console.log("[bulk-inquiry] OTP (fixed):", code);

    return user;
  }

  /** Verify OTP for bulk flow, clear OTP, return user. */
  static async verifyOtpByPhone(phone, otp) {
    const n = normalizePhone(phone);
    if (!n) throw new AppError("Phone number is required", 400);

    const inputDigits = String(otp ?? "").replace(/\D/g, "");

    let user = await userModel
      .findOne({
        number: n,
        "otp.code": { $exists: true, $nin: [null, ""] },
      })
      .sort({ updatedAt: -1, _id: -1 });

    if (!user) {
      const any = await userModel.findOne({ number: n });
      if (!any) throw new AppError("User not found", 404);
      throw new AppError(
        "No pending OTP for this phone. Request OTP first (submit without otp).",
        400,
      );
    }

    if (!user.otp?.code) throw new AppError("OTP not found", 400);

    if (user.otp.expiresAt && user.otp.expiresAt < new Date()) {
      throw new AppError("OTP expired", 400);
    }

    const storedDigits = String(user.otp.code).replace(/\D/g, "");
    if (inputDigits !== storedDigits) {
      throw new AppError("Invalid OTP", 400);
    }

    user.otp = null;
    user.markModified("otp");
    await user.save();

    return user;
  }
}
