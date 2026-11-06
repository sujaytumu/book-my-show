import { Capacitor, registerPlugin } from "@capacitor/core";

// Inside the Android app payments use Razorpay's NATIVE checkout (see RazorpayCheckoutPlugin.java), because the
// web checkout cannot open bank / OTP pages inside an app WebView.
const BmsCheckout = registerPlugin("BmsCheckout");

// true only in an APK that includes the native plugin (older APKs fall back to the web checkout)
export const hasNativeCheckout = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BmsCheckout");

// Always resolves:
//   { ok: true, response: { razorpay_payment_id, razorpay_order_id, razorpay_signature } }
//   { ok: false, cancelled: true }   (user closed the screen)
//   { ok: false, error: { code, description, reason, step, source } }
export const openNativeCheckout = async (options) => {
  try {
    const result = await BmsCheckout.open(options);
    let response = result?.response;
    if (typeof response === "string") response = JSON.parse(response);
    if (!response?.razorpay_payment_id) {
      return { ok: false, error: { description: "Payment finished but no payment id was returned" } };
    }
    return { ok: true, response };
  } catch (err) {
    let error = {};
    try {
      error = JSON.parse(err?.message);
    } catch {
      error = { description: err?.message || "Payment failed" };
    }
    if (Number(error.code) === 0 || /cancel/i.test(error.description || "")) return { ok: false, cancelled: true };
    return { ok: false, error };
  }
};
