package com.novacam.ai

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.novacam.ai.cameracore.HardwareCapabilityManager
import com.novacam.ai.theme.NovaTheme
import com.novacam.ai.theme.ThemeDataStore
import com.novacam.ai.ui.glass.NovaBottomNavigationBar

class NovaCamApplication : Application() {
    lateinit var capabilityManager: HardwareCapabilityManager
        private set
    lateinit var themeDataStore: ThemeDataStore
        private set

    override fun onCreate() {
        super.onCreate()
        capabilityManager = HardwareCapabilityManager(this)
        themeDataStore = ThemeDataStore(this)
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as NovaCamApplication

        setContent {
            val themeState by app.themeDataStore.themeState.collectAsState(initial = com.novacam.ai.domain.ThemeConfig())
            NovaTheme(config = themeState) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    NovaNavShell()
                }
            }
        }
    }
}

@Composable
fun NovaNavShell() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "photo") {
        composable("photo") { NovaBottomNavigationBar(current = "photo", onNavigate = { navController.navigate(it) }) }
        composable("video") { NovaBottomNavigationBar(current = "video", onNavigate = { navController.navigate(it) }) }
        composable("coach") { NovaBottomNavigationBar(current = "coach", onNavigate = { navController.navigate(it) }) }
        composable("gallery") { NovaBottomNavigationBar(current = "gallery", onNavigate = { navController.navigate(it) }) }
        composable("settings") { NovaBottomNavigationBar(current = "settings", onNavigate = { navController.navigate(it) }) }
    }
}
