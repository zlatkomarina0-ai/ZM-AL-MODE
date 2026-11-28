package com.zlatko.ai;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Dedicated browser workspace for ZLATKO AI MODE sports project. */
public class SportsBrowserActivity extends Activity {
    private WebView webView;
    private EditText address;
    private final int bg = Color.rgb(7, 21, 47);
    private final int panel = Color.rgb(11, 29, 59);
    private final int gold = Color.rgb(212, 175, 55);
    private final int white = Color.rgb(247, 248, 252);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(bg);

        TextView title = new TextView(this);
        title.setText("⚽  ZLATKO SPORTS Browser");
        title.setTextColor(gold);
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setPadding(dp(14), dp(12), dp(12), dp(12));
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout nav = new LinearLayout(this);
        nav.setGravity(Gravity.CENTER_VERTICAL);
        nav.setPadding(dp(8), dp(4), dp(8), dp(4));
        nav.setBackgroundColor(panel);
        Button back = button("‹", false);
        back.setOnClickListener(v -> { if (webView != null && webView.canGoBack()) webView.goBack(); else showHome(); });
        nav.addView(back, new LinearLayout.LayoutParams(dp(42), dp(44)));
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(14);
        address.setHint("Спортска адреса или пребарување");
        address.setHintTextColor(Color.LTGRAY);
        address.setTextColor(white);
        address.setSelectAllOnFocus(true);
        address.setPadding(dp(10), 0, dp(10), 0);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        nav.addView(address, new LinearLayout.LayoutParams(0, dp(44), 1));
        Button go = button("↗", true);
        nav.addView(go, new LinearLayout.LayoutParams(dp(46), dp(44)));
        go.setOnClickListener(v -> openAddress());
        address.setOnEditorActionListener((v, action, event) -> {
            if (action == EditorInfo.IME_ACTION_GO || action == EditorInfo.IME_ACTION_DONE) { openAddress(); return true; }
            return false;
        });
        root.addView(nav, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout tools = new LinearLayout(this);
        tools.setPadding(dp(8), dp(4), dp(8), dp(4));
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
                return url == null || !(url.startsWith("http://") || url.startsWith("https://"));
            }
        });
        root.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        showHome();
    }

    private void showHome() {
        String html = "<!doctype html><html lang='mk'><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:0;padding:18px;background:#07152f;color:#f7f8fc;font:15px system-ui'>" +
          "<div style='color:#d4af37;font-size:11px;font-weight:900;letter-spacing:2px'>ZM · SPORTS WORKSPACE</div>" +
          "<h2 style='font-size:28px;margin:8px 0'>Спортски проект</h2><p style='color:#a6b6cd;line-height:1.6'>Одделен простор за спортскиот билтен, ZLATKO AI MODE, Формула 1 и Реал Мадрид.</p>" +
          card("ZLATKO AI MODE · спортски проект", "https://zlatkomarina0-ai.github.io/ZM-AL-MODE/sports.html") +
          card("Спортски билтен / главна апликација", "https://zlatkomarina0-ai.github.io/ZM-AL-MODE/") +
          card("F1 вести · официјален извор", "https://www.formula1.com/en/latest/all.html") +
          card("F1 календар", "https://www.formula1.com/en/racing/2026.html") +
          card("Реал Мадрид · официјални вести", "https://www.realmadrid.com/en-US/news") +
          card("Реал Мадрид · натпревари", "https://www.realmadrid.com/en-US/football/first-team/fixtures") +
          card("Пребарај спортски вести", "https://www.google.com/search?q=" + Uri.encode("спортски вести")) +
          "<p style='font-size:12px;color:#a6b6cd;margin-top:20px'>Овој прелистувач е одделен од општиот Browser. Внеси адреса или пребарување во лентата погоре.</p></body></html>";
        webView.loadDataWithBaseURL("https://sports-browser.local/", html, "text/html", "UTF-8", null);
        address.setText("");
    }

    private String card(String name, String url) {
        return "<a href='" + url + "' style='display:block;padding:15px;margin:10px 0;background:#0b1d3b;border:1px solid rgba(212,175,55,.45);border-radius:12px;color:#d4af37;text-decoration:none;font-weight:750'>" + name + "　›</a>";
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