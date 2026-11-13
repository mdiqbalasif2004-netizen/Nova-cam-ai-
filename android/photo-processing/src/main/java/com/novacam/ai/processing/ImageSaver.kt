package com.novacam.ai.processing

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import java.io.OutputStream

/**
 * Scoped-storage MediaStore image writer.
 * Always saves the untouched original capture separately from any cinematically graded copy.
 */
object ImageSaver {

    fun saveOriginalAndGraded(
        context: Context,
        original: Bitmap,
        graded: Bitmap,
        baseName: String,
        lensSummary: String
    ): Pair<Uri?, Uri?> {
        val origUri = writeJpegToMediaStore(context, original, "${baseName}_original.jpg", "Pictures/NovaCamAI/Originals", lensSummary)
        val gradedUri = writeJpegToMediaStore(context, graded, "${baseName}_graded.jpg", "Pictures/NovaCamAI", lensSummary)
        return origUri to gradedUri
    }

    fun saveGradedCopy(
        context: Context,
        graded: Bitmap,
        fileName: String,
        lensSummary: String
    ): Uri? {
        return writeJpegToMediaStore(context, graded, fileName, "Pictures/NovaCamAI", lensSummary)
    }

    private fun writeJpegToMediaStore(
        context: Context,
        bitmap: Bitmap,
        displayName: String,
        relativePath: String,
        lensSummary: String
    ): Uri? {
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, relativePath)
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return null

        resolver.openOutputStream(uri)?.use { out: OutputStream ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, out)
        }

        resolver.openFileDescriptor(uri, "rw")?.use { pfd ->
            val exif = ExifInterface(pfd.fileDescriptor)
            exif.setAttribute(ExifInterface.TAG_MODEL, "Xiaomi 17T (NOVA CAM AI)")
            exif.setAttribute(ExifInterface.TAG_LENS_MODEL, lensSummary)
            exif.saveAttributes()
        }

        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri
    }
}
