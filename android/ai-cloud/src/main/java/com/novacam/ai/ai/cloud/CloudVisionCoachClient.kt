package com.novacam.ai.ai.cloud

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Secure HTTPS client for optional online Gemini Vision coaching.
 * Never embeds API keys in the APK; communicates strictly with the backend proxy
 * and enforces explicit user consent before transmitting any image bytes.
 */
class CloudVisionCoachClient(private val backendBaseUrl: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()

    fun requestLiveCoach(
        jpegBase64: String,
        userConsented: Boolean,
        capabilitiesJson: JSONObject
    ): Result<String> {
        if (!userConsented) {
            return Result.failure(IllegalStateException("Online Vision AI requires explicit user consent."))
        }
        val payload = JSONObject().apply {
            put("imageBase64", jpegBase64)
            put("mimeType", "image/jpeg")
            put("consent", true)
            put("capabilities", capabilitiesJson)
        }
        val body = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        val req = Request.Builder()
            .url("${backendBaseUrl.trimEnd('/')}/api/ai/coach")
            .post(body)
            .build()

        return client.newCall(req).execute().use { resp ->
            val raw = resp.body?.string().orEmpty()
            if (resp.isSuccessful) Result.success(raw)
            else Result.failure(IllegalStateException("Cloud coach HTTP ${resp.code}: $raw"))
        }
    }
}
