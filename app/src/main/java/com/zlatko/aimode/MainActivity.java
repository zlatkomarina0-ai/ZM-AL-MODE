package com.zlatko.aimode;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class MainActivity extends Activity {

    private void openUrl(String u) {
        u = u.trim();
        if (u.isEmpty()) return;
        if (!u.startsWith("http")) u = "https://" + u;
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u)));
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(15, 23, 42));
        root.setPadding(24, 24, 24, 24);

        // КОПИЛОТ: код и приказ со боја
        TextView t1 = new TextView(this);
        t1.setText("КОПИЛОТ");
        t1.setTextColor(Color.WHITE);
        t1.setTextSize(18);
        root.addView(t1);

        final EditText code = new EditText(this);
        code.setText("// Внеси го твојот код тука\nconsole.log(\"Zdravo\");");
        code.setTextColor(Color.rgb(74, 222, 128));
        code.setBackgroundColor(Color.rgb(11, 18, 32));
        code.setTypeface(Typeface.MONOSPACE);
        root.addView(code);

        final TextView out = new TextView(this);
        out.setTextColor(Color.rgb(74, 222, 128));
        out.setTypeface(Typeface.MONOSPACE);
        out.setPadding(0, 16, 0, 16);

        Button conv = new Button(this);
        conv.setText("Конвертирај");
        conv.setOnClickListener(v -> out.setText(code.getText().toString()));
        root.addView(conv);
        root.addView(out);

        // ПРЕЛИСТУВАЧ / СПОРТСКИ ТИПОВИ / РЕЗУЛТАТИ
        TextView t2 = new TextView(this);
        t2.setText("АДРЕСА");
        t2.setTextColor(Color.WHITE);
        t2.setTextSize(18);
        root.addView(t2);

        final EditText url = new EditText(this);
        url.setHint("https://...");
        url.setTextColor(Color.WHITE);
        root.addView(url);

        Button go = new Button(this);
        go.setText("Отвори");
        go.setOnClickListener(v -> openUrl(url.getText().toString()));
        root.addView(go);

        // F1 И REAL MADRID
        Button f1 = new Button(this);
        f1.setText("F1 вести");
        f1.setOnClickListener(v -> openUrl("https://www.formula1.com/en/latest/all"));
        root.addView(f1);

        Button real = new Button(this);
        real.setText("Real Madrid вести");
        real.setOnClickListener(v -> openUrl("https://www.realmadrid.com/en/news"));
        root.addView(real);

        // ПРЕВОД
        TextView t3 = new TextView(this);
        t3.setText("ПРЕВОД");
        t3.setTextColor(Color.WHITE);
        t3.setTextSize(18);
        root.addView(t3);

        final EditText tr = new EditText(this);
        tr.setHint("Текст за превод");
        tr.setTextColor(Color.WHITE);
        root.addView(tr);

        Button prevedi = new Button(this);
        prevedi.setText("Преведи (Google Translate)");
        prevedi.setOnClickListener(v -> openUrl(
            "https://translate.google.com/?sl=auto&tl=mk&text=" + Uri.encode(tr.getText().toString())));
        root.addView(prevedi);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }
}
