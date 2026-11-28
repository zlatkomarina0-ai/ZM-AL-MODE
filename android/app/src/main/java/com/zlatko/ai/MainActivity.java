package com.zlatko.ai;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onPostCreate(@Nullable Bundle savedInstanceState) {
        super.onPostCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebViewClient(new BridgeWebViewClient(this.bridge) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri url = request.getUrl();
                    String urlString = url.toString();

                    if ("zlatkosports".equals(url.getScheme())) {
                        startActivity(new Intent(MainActivity.this, SportsBrowserActivity.class));
                        return true;
                    }

                    if ("zlatkobrowser".equals(url.getScheme())) {
                        startActivity(new Intent(MainActivity.this, BrowserActivity.class));
                        return true;
                    }

                    if (urlString.startsWith("intent://") || urlString.startsWith("viber://") || urlString.startsWith("instagram://") || urlString.startsWith("fb://")) {
                        try {
                            Intent intent;
                            if (urlString.startsWith("intent://")) {
                                intent = Intent.parseUri(urlString, Intent.URI_INTENT_SCHEME);
                            } else {
                                intent = new Intent(Intent.ACTION_VIEW, url);
                            }
                            if (intent != null) {
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                view.getContext().startActivity(intent);
                                return true;
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                            return true;
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }
}