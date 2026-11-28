package com.zlatko.ai;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class BrowserActivity extends Activity {
    private WebView webView;
    private EditText address;
    private final int bg = Color.rgb(16, 24, 39);
    private final int panel = Color.rgb(24, 36, 55);
    private final int gold = Color.rgb(240, 193, 90);
    private final int white = Color.rgb(244, 247, 251);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(bg);

        TextView title = new TextView(this);
        title.setText("🌐  ZLATKO Browser");
        title.setTextColor(white);
        title.setTextSize(19);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setPadding(dp(16), dp(14), dp(12), dp(14));
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout nav = new LinearLayout(this);
        nav.setGravity(Gravity.CENTER_VERTICAL);
        nav.setPadding(dp(8), dp(5), dp(8), dp(5));
        nav.setBackgroundColor(panel);
        Button back = button("‹", false);
        back.setOnClickListener(v -> { if (webView != null && webView.canGoBack()) webView.goBack(); else showHome(); });
        nav.addView(back, new LinearLayout.LayoutParams(dp(42), dp(44)));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(14);
        address.setHint("Пребарај или внеси адреса");
        address.setHintTextColor(Color.LTGRAY);
        address.setTextColor(white);
        address.setSelectAllOnFocus(true);
        address.setPadding(dp(10), 0, dp(10), 0);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        nav.addView(address, new LinearLayout.LayoutParams(0, dp(44), 1));
        Button go = button("↗", true);
        nav.addView(go, new LinearLayout.LayoutParams(dp(46), dp(44)));
        go.setOnClickListener(v -> openAddress());
        address.setOnEditorActionListener((v, action, event) -> { if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE) { openAddress(); return true; } return false; });
        root.addView(nav, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout tools = new LinearLayout(this);
        tools.setPadding(dp(8), dp(5), dp(8), dp(5));
        Button home = button("⌂", false); home.setOnClickListener(v -> showHome());
        Button refresh = button("⟳", false); refresh.setOnClickListener(v -> { if (webView != null) webView.reload(); });
        tools.addView(home, new LinearLayout.LayoutParams(dp(52), dp(40)));
        tools.addView(refresh, new LinearLayout.LayoutParams(dp(52), dp(40)));
        root.addView(tools, new LinearLayout.LayoutParams(-1, -2));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportMultipleWindows(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new android.webkit.WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) return false;
                return true;
            }
        });
        root.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        showHome();
    }

    private void showHome() {
        String html = "<!doctype html><html><meta name='viewport' content='width=device-width, initial-scale=1'><body style='margin:0;padding:24px;background:#101827;color:#f4f7fb;font:16px system-ui'><h2 style='text-align:center'>Добредојде</h2><p style='text-align:center;color:#9aabc0'>Твоите веб-проекти на едно место</p>" +
          card("Copilot", "https://copilot.microsoft.com/") +
          card("ZLATKO AI MODE", "https://zlatkomarina0-ai.github.io/ZM-AL-MODE/") +
          card("Спортски вести", "https://www.google.com/search?q=спортски+вести") +
          card("F1 вести", "https://www.google.com/search?q=Formula+1+новости") +
          card("Real Madrid", "https://www.google.com/search?q=Real+Madrid+новости") +
          card("Google", "https://www.google.com/") +
          "<p style='font-size:12px;color:#9aabc0;margin-top:24px'>Внеси адреса или пребарување во лентата погоре. Некои сајтови може да ограничуваат Android WebView.</p></body></html>";
        webView.loadDataWithBaseURL("https://browser.local/", html, "text/html", "UTF-8", null);
        address.setText("");
    }

    private String card(String name, String url) {
        return "<a href='" + url + "' style='display:block;padding:16px;margin:12px 0;background:#182437;border:1px solid #2b3a50;border-radius:14px;color:#f0c15a;text-decoration:none;font-weight:700'>" + name + "　›</a>";
    }

    private void openAddress() {
        String value = address.getText().toString().trim();
        if (value.isEmpty()) return;
        String target;
        if (value.matches("(?i)^https?://.*")) target = value;
        else if (value.matches("(?i)^[a-z0-9.-]+\\.[a-z]{2,}([/:?#].*)?$")) target = "https://" + value;
        else target = "https://www.google.com/search?q=" + Uri.encode(value);
        webView.loadUrl(target);
    }

    private Button button(String text, boolean primary) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(18);
        b.setAllCaps(false);
        b.setTextColor(primary ? bg : white);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primary ? gold : panel));
        return b;
    }
    private int dp(int n) { return (int)(n * getResources().getDisplayMetrics().density + 0.5f); }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else showHome(); }
}