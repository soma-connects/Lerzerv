package com.lezerv.app.android

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import com.lezerv.app.BuildConfig
import com.lezerv.app.R
import com.lezerv.app.state.LezervState
import com.lezerv.app.ui.LezervApp
import com.lezerv.app.ui.theme.LzFonts

/**
 * Holds the app state across configuration changes (rotation, dark-mode toggle…),
 * which would otherwise recreate the Activity and lose an in-progress booking.
 */
class MainViewModel : ViewModel() {
    val state = LezervState(demo = BuildConfig.DEMO_MODE)
}

private val fonts = LzFonts(
    heading = FontFamily(
        Font(R.font.barlow_condensed_medium, FontWeight.Medium),
        Font(R.font.barlow_condensed_semibold, FontWeight.SemiBold),
        Font(R.font.barlow_condensed_bold, FontWeight.Bold),
    ),
    body = FontFamily(
        Font(R.font.archivo_regular, FontWeight.Normal),
        Font(R.font.archivo_medium, FontWeight.Medium),
        Font(R.font.archivo_semibold, FontWeight.SemiBold),
        Font(R.font.archivo_bold, FontWeight.Bold),
    ),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Draw behind the system bars with dark icons on the light Lezerv ground.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent {
            val state = viewModel<MainViewModel>().state
            // System back: close sheets, pop pushed screens, then return to the home tab.
            BackHandler(enabled = state.canGoBack) { state.back() }
            // safeDrawingPadding keeps content clear of the status bar, gesture bar and keyboard.
            LezervApp(state, fonts, Modifier.safeDrawingPadding())
        }
    }
}
