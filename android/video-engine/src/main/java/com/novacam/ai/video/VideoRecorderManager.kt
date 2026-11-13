package com.novacam.ai.video

import android.content.ContentValues
import android.content.Context
import android.provider.MediaStore
import androidx.camera.video.MediaStoreOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat

/**
 * CameraX + MediaStore VideoCapture manager supporting hardware-verified 4K / 1080p recording.
 */
class VideoRecorderManager(private val context: Context) {

    private var activeRecording: Recording? = null

    fun createVideoCapture(prefer4k: Boolean): VideoCapture<Recorder> {
        val selector = if (prefer4k) {
            QualitySelector.fromOrderedList(listOf(Quality.UHD, Quality.FHD))
        } else {
            QualitySelector.from(Quality.FHD)
        }
        val recorder = Recorder.Builder()
            .setQualitySelector(selector)
            .build()
        return VideoCapture.withOutput(recorder)
    }

    fun startRecording(
        videoCapture: VideoCapture<Recorder>,
        enableAudio: Boolean,
        onEvent: (VideoRecordEvent) -> Unit
    ) {
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, "NOVA_${System.currentTimeMillis()}.mp4")
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/NovaCamAI")
        }
        val outputOptions = MediaStoreOutputOptions.Builder(
            context.contentResolver,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        ).setContentValues(values).build()

        var pending = videoCapture.output.prepareRecording(context, outputOptions)
        if (enableAudio) {
            pending = pending.withAudioEnabled()
        }
        activeRecording = pending.start(ContextCompat.getMainExecutor(context), onEvent)
    }

    fun stopRecording() {
        activeRecording?.stop()
        activeRecording = null
    }
}
