package com.lezerv.app.ui.components

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.ImageBitmap

/**
 * Loads profile photos (public URLs in Supabase's 'avatars' bucket) for [Initials].
 * Android supplies one (android/AndroidPhotoLoader); without it, people show as initials,
 * which is what the desktop renders and the demo use.
 */
fun interface PhotoLoader {
    /** The photo at [url], decoded at about [sizePx] on its longer side, or null. */
    suspend fun load(url: String, sizePx: Int): ImageBitmap?
}

val LocalPhotoLoader = staticCompositionLocalOf<PhotoLoader?> { null }
