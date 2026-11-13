package com.novacam.ai.theme

import android.content.Context
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.novacam.ai.domain.ThemeConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.novaThemeStore by preferencesDataStore(name = "nova_theme_prefs")

class ThemeDataStore(private val context: Context) {
    private val keyDark = booleanPreferencesKey("dark_mode")
    private val keyAccent = longPreferencesKey("accent_hex")
    private val keyBlur = floatPreferencesKey("glass_blur")
    private val keyOpacity = floatPreferencesKey("glass_opacity")

    val themeState: Flow<ThemeConfig> = context.novaThemeStore.data.map { prefs ->
        ThemeConfig(
            darkMode = prefs[keyDark] ?: true,
            accentHex = prefs[keyAccent] ?: 0xFF8B5CF6,
            glassBlurDp = prefs[keyBlur] ?: 18f,
            glassOpacity = prefs[keyOpacity] ?: 0.62f
        )
    }

    suspend fun updateTheme(config: ThemeConfig) {
        context.novaThemeStore.edit { prefs ->
            prefs[keyDark] = config.darkMode
            prefs[keyAccent] = config.accentHex
            prefs[keyBlur] = config.glassBlurDp
            prefs[keyOpacity] = config.glassOpacity
        }
    }
}

@Composable
fun NovaTheme(config: ThemeConfig, content: @Composable () -> Unit) {
    val accent = Color(config.accentHex)
    val scheme = if (config.darkMode) {
        darkColorScheme(primary = accent, background = Color(0xFF050507), surface = Color(0xFF111216))
    } else {
        lightColorScheme(primary = accent, background = Color(0xFFF4F5F8), surface = Color.White)
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
