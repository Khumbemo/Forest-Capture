package com.forestcapture.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge rendering so the WebView extends behind
        // both the status bar (top) and the navigation bar (bottom).
        // This causes CSS env(safe-area-inset-top) and env(safe-area-inset-bottom)
        // to report the correct non-zero inset values, allowing the web app
        // to properly position content below the status bar and above the nav bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
