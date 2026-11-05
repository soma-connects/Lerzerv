package com.lezerv.app.android

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.lezerv.app.ui.components.PhotoLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** Biggest photo we download or read from the phone: profile photos are small. */
private const val MAX_PHOTO_BYTES = 10 * 1024 * 1024

/**
 * Profile photos for [com.lezerv.app.ui.components.Initials]: downloaded once over https,
 * decoded at the size they're shown, and kept in a small memory cache.
 */
class AndroidPhotoLoader : PhotoLoader {
    private val cache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    override suspend fun load(url: String, sizePx: Int): ImageBitmap? {
        if (!url.startsWith("https://")) return null
        val key = "$url@$sizePx"
        cache.get(key)?.let { return it.asImageBitmap() }
        val bitmap = withContext(Dispatchers.IO) { download(url)?.let { decodeScaled(it, sizePx) } } ?: return null
        cache.put(key, bitmap)
        return bitmap.asImageBitmap()
    }

    private fun download(url: String): ByteArray? {
        val c = URL(url).openConnection() as HttpURLConnection
        return try {
            c.connectTimeout = 10_000
            c.readTimeout = 15_000
            if (c.responseCode != HttpURLConnection.HTTP_OK || c.contentLengthLong > MAX_PHOTO_BYTES) null
            else c.inputStream.use { it.readBytes() }.takeIf { it.size <= MAX_PHOTO_BYTES }
        } finally {
            c.disconnect()
        }
    }
}

/**
 * The photo the person picked, ready for the 'avatars' bucket: at most [maxSide] px on the
 * longer side, the right way up, re-encoded as JPEG. Re-encoding also drops the original's
 * metadata, including the GPS position many phones write into photos (the photo is public).
 */
internal fun photoJpeg(resolver: ContentResolver, uri: Uri, maxSide: Int = 640): ByteArray? {
    val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
    if (bytes.size > 4 * MAX_PHOTO_BYTES) return null
    val bitmap = decodeScaled(bytes, maxSide) ?: return null
    return ByteArrayOutputStream().use { out ->
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
        out.toByteArray()
    }
}

/** Decodes [bytes] at about [maxSide] px on the longer side, turned as the camera's EXIF says. */
internal fun decodeScaled(bytes: ByteArray, maxSide: Int): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    // Decode at a power-of-two reduction first, so a 12-megapixel photo never fills memory.
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
    val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val rotation = try {
        when (ExifInterface(ByteArrayInputStream(bytes)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
    } catch (_: Exception) {
        0f
    }
    val longer = maxOf(raw.width, raw.height)
    val scale = if (longer > maxSide) maxSide.toFloat() / longer else 1f
    if (rotation == 0f && scale == 1f) return raw
    val turn = Matrix().apply { postScale(scale, scale); postRotate(rotation) }
    return Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, turn, true).also { if (it !== raw) raw.recycle() }
}
