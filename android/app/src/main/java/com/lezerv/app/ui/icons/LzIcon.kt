package com.lezerv.app.ui.icons

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
import com.lezerv.app.ui.theme.Lz

private val cache = HashMap<String, List<Path>>()

private fun pathsFor(name: String): List<Path> = cache.getOrPut(name) {
    LzIconPaths[name].orEmpty().map { PathParser().parsePathString(it).toPath() }
}

/**
 * Lucide icon drawn on a 24×24 grid with a 1.5 stroke, exactly like the prototype's
 * `<lz-icon>`. [filled] fills the shape too (used for selected rating stars).
 */
@Composable
fun LzIcon(name: String, size: Int = 20, color: Color = Lz.Ink, modifier: Modifier = Modifier, filled: Boolean = false) {
    val paths = remember(name) { pathsFor(name) }
    Canvas(modifier.size(size.dp)) {
        val k = this.size.width / 24f
        scale(k, k, pivot = androidx.compose.ui.geometry.Offset.Zero) {
            val stroke = Stroke(width = 1.5f, cap = StrokeCap.Round, join = StrokeJoin.Round)
            paths.forEach { p ->
                if (filled) drawPath(p, color, style = Fill)
                drawPath(p, color, style = stroke)
            }
        }
    }
}
