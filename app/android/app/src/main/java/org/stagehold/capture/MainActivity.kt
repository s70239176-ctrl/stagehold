package org.stagehold.capture

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File

/**
 * DRAFT, UNCOMPILED, UNTESTED. A bare-bones capture app for the Stagehold phone test.
 * Three actions: (1) create the hardware key + attested chain, (2) take a signed shot,
 * (3) take an anchor thumbnail. Output is shared as files from private storage, never saved to the gallery.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var contractField: EditText
    private lateinit var builderField: EditText
    private lateinit var stageField: EditText
    private lateinit var codeField: EditText
    private lateinit var deadlineField: EditText
    private lateinit var status: TextView
    private lateinit var preview: PreviewView
    private var imageCapture: ImageCapture? = null

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera() else say("Camera permission is required.")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 24, 24, 24) }
        fun field(hint: String, number: Boolean = false) = EditText(this).apply {
            this.hint = hint
            isSingleLine = true
            if (number) inputType = InputType.TYPE_CLASS_NUMBER
        }.also { root.addView(it) }
        contractField = field("Job contract address (0x...)")
        builderField = field("Builder address (0x...)")
        stageField = field("Stage (ring_beam, blockwork, roof, openings, plaster)").apply { setText("roof") }
        codeField = field("Code issued for this stage (for example DUCK MOON)")
        deadlineField = field("Code deadline (unix seconds, from the contract status)", number = true)
        fun button(label: String, action: () -> Unit) = Button(this).apply { text = label; setOnClickListener { action() } }.also { root.addView(it) }
        button("1. Create device key and share device.json") { createDevice() }
        button("2. Take SIGNED shot and share shot.json") { takeShot() }
        button("3. Take anchor thumbnail and share anchor.png") { takeAnchor() }
        status = TextView(this).also { root.addView(it) }
        preview = PreviewView(this).apply { layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 900) }
        root.addView(preview)
        setContentView(ScrollView(this).apply { addView(root) })

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
        else askCamera.launch(Manifest.permission.CAMERA)
    }

    private fun say(text: String) { status.text = text; Toast.makeText(this, text, Toast.LENGTH_SHORT).show() }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()
            val previewUse = Preview.Builder().build().also { it.setSurfaceProvider(preview.surfaceProvider) }
            imageCapture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY).build()
            provider.unbindAll()
            provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, previewUse, imageCapture)
        }, ContextCompat.getMainExecutor(this))
    }

    private fun job(): Pair<String, String>? {
        val c = contractField.text.toString().trim()
        val b = builderField.text.toString().trim()
        if (!c.startsWith("0x") || c.length != 42 || !b.startsWith("0x") || b.length != 42) { say("Enter both addresses (0x + 40 hex)."); return null }
        return c to b
    }

    private fun createDevice() {
        val (c, b) = job() ?: return
        try {
            val (chain, strongBox) = Crypto.createKeyAndChain(c, b)
            val file = write("device.json", ShotProcessing.devicePackage(c, b, chain).toString())
            say("Key created (${if (strongBox) "StrongBox" else "TEE"}), ${chain.size} certificates. Sharing device.json")
            share(file, "application/json")
        } catch (e: Exception) { say("Key creation failed: ${e.message}") }
    }

    private fun capture(onBitmap: (Bitmap) -> Unit) {
        val cap = imageCapture ?: return say("Camera not ready.")
        cap.takePicture(ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                try {
                    val bmp = ShotProcessing.rotate(image.toBitmap(), image.imageInfo.rotationDegrees)
                    onBitmap(bmp)
                } finally { image.close() }
            }
            override fun onError(exc: ImageCaptureException) { say("Capture failed: ${exc.message}") }
        })
    }

    private fun takeShot() {
        val (c, b) = job() ?: return
        val stage = stageField.text.toString().trim()
        val code = codeField.text.toString().trim()
        val deadline = deadlineField.text.toString().trim().toLongOrNull() ?: return say("Enter the code deadline.")
        if (code.isEmpty()) return say("Enter the code.")
        capture { bmp ->
            try {
                val pkg = ShotProcessing.shotPackage(c, b, stage, code, deadline, bmp)
                val file = write("shot.json", pkg.toString())
                say("Shot signed (${file.length() / 1024} KB). Sharing shot.json")
                share(file, "application/json")
            } catch (e: Exception) { say("Signing failed: ${e.message}") }
        }
    }

    private fun takeAnchor() {
        capture { bmp ->
            val png = ShotProcessing.thumbnailPng(bmp)
            val file = File(File(cacheDir, "shared").apply { mkdirs() }, "anchor.png").apply { writeBytes(png) }
            say("Anchor thumbnail ${png.size / 1024} KB. Sharing anchor.png")
            share(file, "image/png")
        }
    }

    private fun write(name: String, text: String): File =
        File(File(cacheDir, "shared").apply { mkdirs() }, name).apply { writeText(text) }

    private fun share(file: File, mime: String) {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }, "Share ${file.name}"))
    }
}
