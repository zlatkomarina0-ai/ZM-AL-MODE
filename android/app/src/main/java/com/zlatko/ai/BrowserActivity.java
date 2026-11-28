package com.zlatko.ai;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class BrowserActivity extends Activity {
    private WebView web;
    private EditText address;
    private final int bg = Color.rgb(16, 24, 39), panel = Color.rgb(24, 36, 55);
    private final int gold = Color.rgb(240, 193, 90), white = Color.rgb(244, 247, 251);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(bg);

        TextView title = new TextView(this);
        title.setText("ZLATKO Browser");
        title.setTextColor(white);
        title.setTextSize(19);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setPadding(dp(14), dp(8), dp(14), dp(8));
        root.addView(title);

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(6), dp(4), dp(6), dp(4));
        bar.setBackgroundColor(panel);
        addButton(bar, "‹", () -> { if (web.canGoBack()) web.goBack(); else showHome(); }, 42);
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(14);
        address.setHint("Пребарај или внеси адреса");
        address.setHintTextColor(Color.LTGRAY);
        address.setTextColor(white);
        address.setSelectAllOnFocus(true);
        address.setPadding(dp(8), 0, dp(8), 0);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        bar.addView(address, new LinearLayout.LayoutParams(0, dp(44), 1));
        addButton(bar, "→", this::openAddress, 42);
        root.addView(bar);

        LinearLayout controls = new LinearLayout(this);
        controls.setPadding(dp(5), dp(3), dp(5), dp(3));
        addButton(controls, "⌂", this::showHome, 44);
        addButton(controls, "‹", () -> { if (web.canGoBack()) web.goBack(); }, 44);
        addButton(controls, "›", () -> { if (web.canGoForward()) web.goForward(); }, 44);
        addButton(controls, "⟳", () -> web.reload(), 44);
        addButton(controls, "+", () -> showMessage("За повеќе страници отвори нов прозорец од менито на сајтот."), 44);
        root.addView(controls);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                return !("http".equals(scheme) || "https".equals(scheme));
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (address != null && url != null && (url.startsWith("http://") || url.startsWith("https://"))) address.setText(url);
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        address.setOnEditorActionListener((v, action, event) -> {
            if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE) { openAddress(); return true; }
            return false;
        });
        showHome();
    }

    private void showHome() {
        String html = "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><meta charset='UTF-8'></head>"
          + "<body style='margin:0;padding:18px;background:#101827;color:#f4f7fb;font:16px system-ui'>"
          + "<h2 style='text-align:center;color:#f0c15a;margin:10px 0 4px'>ZLATKO Browser</h2>"
          + "<p style='text-align:center;color:#9aabc0;margin:0 0 18px'>Веб-пребарувач и спортски центар</p>"
          + "<div style='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px'>"
          + card("✦", "ZLATKO AI MODE", "https://zlatkomarina0-ai.github.io/ZM-AL-MODE/")
          + card("◈", "Copilot", "https://copilot.microsoft.com/")
          + card("📰", "Вести", "https://www.google.com/search?q=latest+news")
          + card("🏎", "F1 вести", "https://www.google.com/search?q=Formula+1+latest+news")
          + card("⚽", "Real Madrid вести", "https://www.google.com/search?q=Real+Madrid+latest+news")
          + card("📅", "F1 календар", "https://www.formula1.com/en/racing/2026.html")
          + card("⚽", "Real Madrid распоред", "https://www.realmadrid.com/en-US/football/first-team/fixtures")
          + card("◆", "Спортски проект", "https://github.com/zlatkomarina0-ai/ZM-AL-MODE")
          + "</div><p style='font-size:12px;color:#9aabc0;text-align:center;margin-top:20px'>Внеси пребарување или веб-адреса во горното поле.</p>"
          + "</body></html>";
        web.loadDataWithBaseURL("https://browser.local/", html, "text/html", "UTF-8", null);
        address.setText("");
    }
    private String card(String icon, String label, String url) {
        return "<a href='" + url + "' style='box-sizing:border-box;min-height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px 6px;background:#182437;border:1px solid #2b3a50;border-radius:14px;color:#f0c15a;text-decoration:none;text-align:center;font-weight:700'>"
          + "<span style='font-size:27px'>" + icon + "</span><span style='font-size:13px;line-height:1.3'>" + label + "</span></a>";
    }
    private void openAddress() {
        String value = address.getText().toString().trim();
        if (value.isEmpty()) return;
        String target;
        if (value.matches("(?i)^https?://.*")) target = value;
        else if (value.matches("(?i)^[a-z0-9.-]+\\.[a-z]{2,}([/:?#].*)?$")) target = "https://" + value;
        else target = "https://www.google.com/search?q=" + Uri.encode(value);
        web.loadUrl(target);
    }
    private void addButton(LinearLayout row, String label, Runnable action, int width) {
        Button b = new Button(this);
        b.setText(label); b.setTextSize(17); b.setAllCaps(false);
        b.setTextColor(white);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(panel));
        row.addView(b, new LinearLayout.LayoutParams(dp(width), dp(44)));
        b.setOnClickListener(v -> action.run());
    }
    private void showMessage(String msg) { android.widget.Toast.makeText(this, msg, android.widget.Toast.LENGTH_SHORT).show(); }
    private int dp(int n) { return (int)(n * getResources().getDisplayMetrics().density + 0.5f); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else showHome(); }
}
