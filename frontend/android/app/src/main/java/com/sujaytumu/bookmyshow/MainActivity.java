package com.sujaytumu.bookmyshow;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Asks the page what to do with the phone's back button. NativeBack.jsx defines window.__bmsBack():
    // true  = the page moved one step back (previous screen / tab) or went Home, so the app stays open
    // false = nothing left to go back to (already on Home / Login), so it is OK to leave the app
    private static final String ASK_PAGE =
            "(function(){try{return typeof window.__bmsBack==='function'?window.__bmsBack()===true:null;}catch(e){return null;}})()";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Added after Capacitor's own handler, so this one runs first on every back press.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    finish();
                    return;
                }
                webView.evaluateJavascript(ASK_PAGE, value -> {
                    if ("true".equals(value)) {
                        return; // the page handled it: stay in the app
                    }
                    if ("null".equals(value) && webView.canGoBack()) {
                        // Page handler not ready yet (still loading): fall back to the WebView's own history.
                        webView.goBack();
                        return;
                    }
                    finish(); // "false": already at the first screen, leave the app
                });
            }
        });
    }
}
