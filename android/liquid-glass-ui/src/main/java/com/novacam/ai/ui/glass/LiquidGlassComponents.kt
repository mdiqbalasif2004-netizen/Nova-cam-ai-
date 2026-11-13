package com.novacam.ai.ui.glass

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Selective Liquid Glass surface container.
 * Uses translucent obsidian tint + crisp hairline reflection border without expensive full-preview blurs.
 */
@Composable
fun LiquidGlassPanel(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = Color(0xCC111216),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
        content = content
    )
}

@Composable
fun NovaBottomNavigationBar(current: String, onNavigate: (String) -> Unit) {
    val destinations = listOf("photo", "video", "coach", "gallery", "settings")
    LiquidGlassPanel(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            destinations.forEach { dest ->
                val selected = dest == current
                TextButton(onClick = { onNavigate(dest) }) {
                    Text(
                        text = dest.uppercase(),
                        color = if (selected) MaterialTheme.colorScheme.primary else Color.LightGray
                    )
                }
            }
        }
    }
}
