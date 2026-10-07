package org.stagehold.capture

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/** Turns one captured bitmap into the two artifacts the contract wants, within its size caps. */
object ShotProcessing {
    const val MAX_JPEG = 150 * 1024   // contract MAX_JPEG
    const val MAX_THUMB = 30 * 1024   // contract MAX_THUMB / MAX_ANCHOR

    private fun scaled(src: Bitmap, factor: Float): Bitmap =
        Bitmap.createScaledBitmap(src, (src.width * factor).toInt().coerceAtLeast(16), (src.height * factor).toInt().coerceAtLeast(16), true)

    private fun toLongEdge(src: Bitmap, longEdge: Int): Bitmap {
        val current = maxOf(src.width, src.height)
        return if (current <= longEdge) src else scaled(src, longEdge.toFloat() / current)
    }

    fun rotate(src: Bitmap, degrees: Int): Bitmap {
        if (degrees == 0) return src
        val m = Matrix().apply { postRotate(degrees.toFloat()) }
        return Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
    }

    /** JPEG at most 150 KB: lower the quality first, then shrink, until it fits. */
    fun encodeFrame(src: Bitmap): ByteArray {
        var bmp = toLongEdge(src, 1280)
        var quality = 80
        while (true) {
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
            val data = out.toByteArray()
            if (data.size <= MAX_JPEG) return data
            if (quality > 40) {
                quality -= 5
            } else {
                bmp = scaled(bmp, 0.88f)
                quality = 70
            }
        }
    }

    /** Grayscale PNG with a 160 px long edge, at most 30 KB. Used for the anchor and for alignment. */
    fun thumbnailPng(src: Bitmap): ByteArray {
        var bmp = toLongEdge(src, 160)
        val gray = Bitmap.createBitmap(bmp.width, bmp.height, Bitmap.Config.ARGB_8888)
        val paint = Paint().apply { colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) }) }
        Canvas(gray).drawBitmap(bmp, 0f, 0f, paint)
        bmp = gray
        while (true) {
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
            val data = out.toByteArray()
            if (data.size <= MAX_THUMB) return data
            bmp = scaled(bmp, 0.85f)
        }
    }

    /** The shot package the checker (app/tools/check_package.py) and submit script read. */
    fun shotPackage(contract: String, builder: String, stage: String, code: String, deadline: Long, bitmap: Bitmap): JSONObject {
        val jpeg = encodeFrame(bitmap)
        val thumb = thumbnailPng(bitmap)
        val message = Crypto.shotMessage(contract, stage, code, deadline, Crypto.hex(Crypto.sha256(jpeg)), Crypto.hex(Crypto.sha256(thumb)))
        val signature = Crypto.sign(contract, builder, message)
        return JSONObject()
            .put("version", "stagehold.shot.v1")
            .put("contract", contract)
            .put("stage", stage)
            .put("code", code)
            .put("deadline", deadline)
            .put("key_id", Crypto.keyId(contract, builder))
            .put("jpeg_b64", Base64.encodeToString(jpeg, Base64.NO_WRAP))
            .put("thumb_b64", Base64.encodeToString(thumb, Base64.NO_WRAP))
            .put("signature_hex", Crypto.hex(signature))
    }

    fun devicePackage(contract: String, builder: String, chainB64: List<String>): JSONObject =
        JSONObject()
            .put("version", "stagehold.device.v1")
            .put("contract", contract)
            .put("builder", builder)
            .put("chain_b64", org.json.JSONArray(chainB64))
}
