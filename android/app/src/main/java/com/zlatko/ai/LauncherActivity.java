package com.zlatko.ai;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class LauncherActivity extends Activity {
    private final int bg = Color.rgb(7, 21, 47);
    private final int panel = Color.rgb(15, 35, 65);
    private final int gold = Color.rgb(212, 175, 55);
    private final int white = Color.rgb(248, 250, 252);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(bg);
        getWindow().setNavigationBarColor(bg);
        renderHome();
    }

    @Override protected void onResume() {
        super.onResume();
        renderHome();
    }

    private void renderHome() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(24), dp(18), dp(12));
        root.setBackgroundColor(bg);

        TextView brand = new TextView(this);
        brand.setText("SKOLKATA");
        brand.setTextColor(gold);
        brand.setTextSize(27);
        brand.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        root.addView(brand);

        TextView subtitle = new TextView(this);
        subtitle.setText("Сите апликации на едно место");
        subtitle.setTextColor(Color.rgb(166, 182, 205));
        subtitle.setTextSize(14);
        subtitle.setPadding(0, dp(4), 0, dp(18));
        root.addView(subtitle);

        ScrollView scroll = new ScrollView(this);
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(4);
        grid.setUseDefaultMargins(false);

        addTile(grid, "🌐", "Browser", () -> startActivity(new Intent(this, BrowserActivity.class)));
        addTile(grid, "✦", "ZLATKO AI", () -> startActivity(getPackageManager().getLaunchIntentForPackage(getPackageName())));

        Intent query = new Intent(Intent.ACTION_MAIN, null);
        query.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps = new ArrayList<>(getPackageManager().queryIntentActivities(query, 0));
        Collections.sort(apps, Comparator.comparing(a -> String.valueOf(a.loadLabel(getPackageManager())).toLowerCase()));
        String ownPackage = getPackageName();
        for (ResolveInfo info : apps) {
            if (info.activityInfo == null || ownPackage.equals(info.activityInfo.packageName)) continue;
            String label = String.valueOf(info.loadLabel(getPackageManager()));
            Drawable icon = info.loadIcon(getPackageManager());
            addInstalledTile(grid, icon, label, () -> {
                Intent launch = getPackageManager().getLaunchIntentForPackage(info.activityInfo.packageName);
                if (launch != null) {
                    try { startActivity(launch); }
                    catch (Exception e) { Toast.makeText(this, "Не може да се отвори апликацијата", Toast.LENGTH_SHORT).show(); }
                }
            });
        }
        scroll.addView(grid);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        TextView footer = new TextView(this);
        footer.setText("Притисни икона за да ја отвориш апликацијата");
        footer.setTextColor(Color.rgb(135, 155, 181));
        footer.setTextSize(12);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, dp(12), 0, dp(4));
        root.addView(footer);
        setContentView(root);
    }

    private void addTile(GridLayout grid, String emoji, String label, Runnable action) {
        LinearLayout tile = tileBase(grid, label, action);
        TextView icon = new TextView(this);
        icon.setText(emoji);
        icon.setTextSize(31);
        icon.setGravity(Gravity.CENTER);
        icon.setTextColor(gold);
        tile.addView(icon, new LinearLayout.LayoutParams(-1, dp(58)));
        addLabel(tile, label);
    }

    private void addInstalledTile(GridLayout grid, Drawable drawable, String label, Runnable action) {
        LinearLayout tile = tileBase(grid, label, action);
        android.widget.ImageView icon = new android.widget.ImageView(this);
        icon.setImageDrawable(drawable);
        icon.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
        tile.addView(icon, new LinearLayout.LayoutParams(dp(48), dp(48)));
        addLabel(tile, label);
    }

    private LinearLayout tileBase(GridLayout grid, String label, Runnable action) {
        LinearLayout tile = new LinearLayout(this);
        tile.setOrientation(LinearLayout.VERTICAL);
        tile.setGravity(Gravity.CENTER);
        tile.setPadding(dp(3), dp(10), dp(3), dp(8));
        tile.setBackgroundColor(panel);
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = 0;
        params.height = dp(106);
        params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        params.setMargins(dp(4), dp(4), dp(4), dp(4));
        grid.addView(tile, params);
        tile.setOnClickListener(v -> action.run());
        return tile;
    }

    private void addLabel(LinearLayout tile, String label) {
        TextView name = new TextView(this);
        name.setText(label);
        name.setTextColor(white);
        name.setTextSize(10);
        name.setGravity(Gravity.CENTER);
        name.setMaxLines(2);
        name.setPadding(dp(2), dp(5), dp(2), 0);
        tile.addView(name, new LinearLayout.LayoutParams(-1, -2));
    }

    private int dp(int n) { return (int)(n * getResources().getDisplayMetrics().density + 0.5f); }
}
