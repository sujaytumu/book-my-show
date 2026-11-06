package com.sujaytumu.bookmyshow;

import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.razorpay.CheckoutActivity;
import com.razorpay.ExternalWalletListener;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

import org.json.JSONObject;

/**
 * Opens Razorpay's NATIVE Android checkout (cards, netbanking, UPI apps) instead of the web checkout,
 * because the web checkout cannot open bank / OTP pages inside an app WebView.
 * JS side: registerPlugin("BmsCheckout").open(options)
 */
@CapacitorPlugin(name = "BmsCheckout")
public class RazorpayCheckoutPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        try {
            JSObject options = call.getData();
            Intent intent = new Intent(getActivity(), CheckoutActivity.class);
            intent.putExtra("OPTIONS", options.toString());
            intent.putExtra("FRAMEWORK", "capacitor");
            startActivityForResult(call, intent, "handleCheckoutResult");
        } catch (Exception e) {
            call.reject(errorJson(-1, "Could not open the payment screen: " + e.getMessage(), null));
        }
    }

    @ActivityCallback
    private void handleCheckoutResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        com.razorpay.Checkout.handleActivityResult(
            getActivity(),
            com.razorpay.Checkout.RZP_REQUEST_CODE,
            result.getResultCode(),
            result.getData(),
            new PaymentResultWithDataListener() {
                @Override
                public void onPaymentSuccess(String paymentId, PaymentData data) {
                    JSObject out = new JSObject();
                    try {
                        out.put("response", data != null ? data.getData() : new JSONObject().put("razorpay_payment_id", paymentId));
                    } catch (Exception e) {
                        out.put("response", new JSObject());
                    }
                    call.resolve(out);
                }

                @Override
                public void onPaymentError(int code, String description, PaymentData data) {
                    // code 0 = the user closed the payment screen
                    call.reject(errorJson(code, description, data), String.valueOf(code));
                }
            },
            new ExternalWalletListener() {
                @Override
                public void onExternalWalletSelected(String walletName, PaymentData data) {
                    call.reject(errorJson(-2, "External wallet selected: " + walletName, data));
                }
            }
        );
    }

    /** Builds a JSON string {code, description, reason, step, source} from the SDK's error info. */
    private String errorJson(int code, String description, PaymentData data) {
        JSObject err = new JSObject();
        err.put("code", code);
        err.put("description", description == null ? "" : description);
        try {
            if (data != null && data.getData() != null) {
                JSONObject d = data.getData();
                JSONObject e = d.has("error") ? d.getJSONObject("error") : d;
                for (String key : new String[] {"code", "description", "reason", "step", "source"}) {
                    if (e.has(key) && !e.isNull(key)) {
                        err.put(key, e.get(key));
                    }
                }
            }
        } catch (Exception ignored) {
            // keep the basic info
        }
        return err.toString();
    }
}
