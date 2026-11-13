package com.novacam.ai.settings

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class PrivacyPreferences(
    val autoLiveCoach: Boolean = true,
    val autoSceneOptimize: Boolean = true,
    val onlineVisionConsent: Boolean = false,
    val offlineOnlyMode: Boolean = true
)

class SettingsStateHolder {
    private val _privacy = MutableStateFlow(PrivacyPreferences())
    val privacy: StateFlow<PrivacyPreferences> = _privacy.asStateFlow()

    fun setOnlineConsent(granted: Boolean) {
        _privacy.update {
            it.copy(
                onlineVisionConsent = granted,
                offlineOnlyMode = !granted
            )
        }
    }

    fun setAutoSceneOptimize(enabled: Boolean) {
        _privacy.update { it.copy(autoSceneOptimize = enabled) }
    }
}
