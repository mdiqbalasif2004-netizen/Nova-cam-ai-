package com.novacam.ai.update

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.io.File
import java.security.MessageDigest

/**
 * Handles secure APK integrity verification (SHA-256 + signing cert check) for direct updates
 * alongside Google Play In-App Updates. Never performs silent installs.
 */
object AppUpdateVerifier {

    fun verifyFileSha256(apkFile: File, expectedSha256Hex: String): Boolean {
        val digest = MessageDigest.getInstance("SHA-256")
        apkFile.inputStream().use { input ->
            val buf = ByteArray(8192)
            var read: Int
            while (input.read(buf).also { read = it } != -1) {
                digest.update(buf, 0, read)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        return actual.equals(expectedSha256Hex, ignoreCase = true)
    }

    fun verifyArchiveSigningCertificate(
        context: Context,
        apkFile: File,
        expectedCertSha256ColonHex: String
    ): Boolean {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }
        val info = context.packageManager.getPackageArchiveInfo(apkFile.absolutePath, flags) ?: return false
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.signingInfo?.apkContentsSigners
        } else {
            @Suppress("DEPRECATION")
            info.signatures
        } ?: return false

        val digest = MessageDigest.getInstance("SHA-256")
        return signatures.any { sig ->
            val actual = digest.digest(sig.toByteArray()).joinToString(":") { "%02X".format(it) }
            actual.equals(expectedCertSha256ColonHex, ignoreCase = true)
        }
    }
}
