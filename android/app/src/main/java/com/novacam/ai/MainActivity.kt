package com.novacam.ai

import android.Manifest
import android.app.Application
import android.content.ContentValues
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.Recorder
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.novacam.ai.ai.AiSceneOptimizer
import com.novacam.ai.ai.offline.OfflineVisionAnalyzer
import com.novacam.ai.cameracore.HardwareCapabilityManager
import com.novacam.ai.cinematic.CinematicProfile
import com.novacam.ai.composition.CompositionCoachEngine
import com.novacam.ai.controls.Camera2ControlsBinder
import com.novacam.ai.controls.ManualCaptureParams
import com.novacam.ai.domain.CameraCapabilityReport
import com.novacam.ai.domain.LensRole
import com.novacam.ai.domain.SceneCategory
import com.novacam.ai.domain.ThemeConfig
import com.novacam.ai.gallery.GalleryRepository
import com.novacam.ai.gallery.MediaItemEntry
import com.novacam.ai.settings.SettingsStateHolder
import com.novacam.ai.theme.NovaTheme
import com.novacam.ai.theme.ThemeDataStore
import com.novacam.ai.ui.glass.LiquidGlassPanel
import com.novacam.ai.ui.glass.NovaBottomNavigationBar
import com.novacam.ai.video.VideoRecorderManager
import com.novacam.ai.videohdr.HdrProfileDetector
import com.novacam.ai.xiaomi.Xiaomi17TCameraProfile
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

class NovaCamApplication : Application() {
    lateinit var capabilityManager: HardwareCapabilityManager
        private set
    lateinit var themeDataStore: ThemeDataStore
        private set
    val settingsHolder = SettingsStateHolder()
    val sceneOptimizer = AiSceneOptimizer()
    val compositionCoach = CompositionCoachEngine()

    override fun onCreate() {
        super.onCreate()
        capabilityManager = HardwareCapabilityManager(this)
        themeDataStore = ThemeDataStore(this)
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as NovaCamApplication

        setContent {
            val themeState by app.themeDataStore.themeState.collectAsState(initial = ThemeConfig())
            NovaTheme(config = themeState) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    NovaAppRoot(app = app, themeConfig = themeState)
                }
            }
        }
    }
}

@Composable
fun NovaAppRoot(app: NovaCamApplication, themeConfig: ThemeConfig) {
    val context = LocalContext.current
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route ?: "photo"

    val reports = remember { runCatching { app.capabilityManager.probeAllCameras() }.getOrDefault(emptyList()) }
    val resolvedLenses = remember(reports) { Xiaomi17TCameraProfile.resolveFromProbe(reports) }
    val activeReport: CameraCapabilityReport? = remember(reports, resolvedLenses) {
        resolvedLenses.mainWide ?: reports.firstOrNull()
    }

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var hasAudioPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }

    val requiredPermissions = remember {
        buildList {
            add(Manifest.permission.CAMERA)
            add(Manifest.permission.RECORD_AUDIO)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.READ_MEDIA_VIDEO)
            } else {
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }.toTypedArray()
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        hasCameraPermission = result[Manifest.permission.CAMERA] == true ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        hasAudioPermission = result[Manifest.permission.RECORD_AUDIO] == true ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    var detectedScene by remember { mutableStateOf(SceneCategory.STREET) }
    var sceneConfidence by remember { mutableFloatStateOf(0.84f) }
    var meanLuma by remember { mutableFloatStateOf(124f) }
    var highlightClip by remember { mutableFloatStateOf(0.5f) }
    var selectedProfile by remember { mutableStateOf(CinematicProfile.CINEMATIC) }
    var selectedLensRole by remember { mutableStateOf(LensRole.MAIN) }

    val privacy by app.settingsHolder.privacy.collectAsState()

    val selectedReport = remember(selectedLensRole, resolvedLenses, activeReport) {
        when (selectedLensRole) {
            LensRole.ULTRA_WIDE -> resolvedLenses.ultraWide ?: activeReport
            LensRole.MAIN -> resolvedLenses.mainWide ?: activeReport
            LensRole.TELEPHOTO -> resolvedLenses.telephoto ?: activeReport
            LensRole.FRONT -> resolvedLenses.front ?: activeReport
        }
    }

    val mappedSceneParams = remember(detectedScene, sceneConfidence, meanLuma, highlightClip, selectedReport) {
        selectedReport?.let {
            app.sceneOptimizer.resolveHardwareAdjustments(
                scene = detectedScene,
                confidence = sceneConfidence,
                capabilities = it,
                meanLuma = meanLuma,
                highlightClipPct = highlightClip
            )
        }
    }

    val coachAdvice = remember(detectedScene, highlightClip) {
        app.compositionCoach.evaluateFrame(
            scene = detectedScene,
            horizonTiltDeg = 0.6f,
            highlightClipPct = highlightClip,
            subjectOffsetFromCenterX = 0.12f,
            backgroundClutterScore = 0.28f
        )
    }

    Scaffold(
        bottomBar = {
            Box(modifier = Modifier.navigationBarsPadding()) {
                NovaBottomNavigationBar(
                    current = currentRoute,
                    onNavigate = { route ->
                        if (route != currentRoute) {
                            navController.navigate(route) {
                                launchSingleTop = true
                            }
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            NavHost(navController = navController, startDestination = "photo") {
                composable("photo") {
                    CameraWorkspaceScreen(
                        isVideoMode = false,
                        hasCameraPermission = hasCameraPermission,
                        hasAudioPermission = hasAudioPermission,
                        onRequestPermissions = { permissionLauncher.launch(requiredPermissions) },
                        activeReport = selectedReport,
                        resolvedLenses = resolvedLenses,
                        selectedLensRole = selectedLensRole,
                        onSelectLens = { selectedLensRole = it },
                        selectedProfile = selectedProfile,
                        onSelectProfile = { selectedProfile = it },
                        detectedScene = detectedScene,
                        mappedParamsSummary = mappedSceneParams?.let {
                            buildString {
                                append(it.scene.name)
                                it.exposureEvDelta?.let { ev -> append(" · EV ${"%.1f".format(ev)}") }
                                it.whiteBalanceKelvin?.let { wb -> append(" · ${wb}K") }
                                it.targetIso?.let { iso -> append(" · ISO $iso") }
                            }
                        } ?: "Probing Camera2...",
                        coachInstruction = if (privacy.autoLiveCoach) coachAdvice.primaryInstruction else null,
                        autoOptimize = privacy.autoSceneOptimize,
                        onFrameAnalyzed = { scene, conf, luma, clip ->
                            detectedScene = scene
                            sceneConfidence = conf
                            meanLuma = luma
                            highlightClip = clip
                        }
                    )
                }

                composable("video") {
                    CameraWorkspaceScreen(
                        isVideoMode = true,
                        hasCameraPermission = hasCameraPermission,
                        hasAudioPermission = hasAudioPermission,
                        onRequestPermissions = { permissionLauncher.launch(requiredPermissions) },
                        activeReport = selectedReport,
                        resolvedLenses = resolvedLenses,
                        selectedLensRole = selectedLensRole,
                        onSelectLens = { selectedLensRole = it },
                        selectedProfile = selectedProfile,
                        onSelectProfile = { selectedProfile = it },
                        detectedScene = detectedScene,
                        mappedParamsSummary = selectedReport?.let {
                            "HDR: ${HdrProfileDetector.availableModes(it).joinToString { m -> m.name }}"
                        } ?: "Probing Video HDR...",
                        coachInstruction = if (privacy.autoLiveCoach) coachAdvice.primaryInstruction else null,
                        autoOptimize = privacy.autoSceneOptimize,
                        onFrameAnalyzed = { scene, conf, luma, clip ->
                            detectedScene = scene
                            sceneConfidence = conf
                            meanLuma = luma
                            highlightClip = clip
                        }
                    )
                }

                composable("coach") {
                    AiCoachScreen(
                        detectedScene = detectedScene,
                        confidence = sceneConfidence,
                        coachInstruction = coachAdvice.primaryInstruction,
                        secondaryTips = coachAdvice.secondaryTips,
                        recommendedLens = coachAdvice.recommendedLens,
                        optimizer = app.sceneOptimizer,
                        activeReport = selectedReport,
                        onTestScene = { detectedScene = it }
                    )
                }

                composable("gallery") {
                    GalleryScreen()
                }

                composable("settings") {
                    SettingsScreen(
                        app = app,
                        themeConfig = themeConfig,
                        reports = reports
                    )
                }
            }
        }
    }
}

@Composable
private fun CameraWorkspaceScreen(
    isVideoMode: Boolean,
    hasCameraPermission: Boolean,
    hasAudioPermission: Boolean,
    onRequestPermissions: () -> Unit,
    activeReport: CameraCapabilityReport?,
    resolvedLenses: Xiaomi17TCameraProfile.ResolvedLensSet,
    selectedLensRole: LensRole,
    onSelectLens: (LensRole) -> Unit,
    selectedProfile: CinematicProfile,
    onSelectProfile: (CinematicProfile) -> Unit,
    detectedScene: SceneCategory,
    mappedParamsSummary: String,
    coachInstruction: String?,
    autoOptimize: Boolean,
    onFrameAnalyzed: (SceneCategory, Float, Float, Float) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val analysisExecutor = remember { Executors.newSingleThreadExecutor() }
    val latestOnFrameAnalyzed by rememberUpdatedState(onFrameAnalyzed)
    val previewView = remember(context) {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }
    val videoRecorder = remember(context) { VideoRecorderManager(context) }

    var activeImageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var activeVideoCapture by remember { mutableStateOf<VideoCapture<Recorder>?>(null) }
    var isRecording by remember { mutableStateOf(false) }
    var captureStatus by remember { mutableStateOf<String?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            videoRecorder.stopRecording()
            analysisExecutor.shutdown()
        }
    }

    LaunchedEffect(hasCameraPermission, isVideoMode, selectedLensRole, autoOptimize, activeReport) {
        if (!hasCameraPermission) return@LaunchedEffect
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            runCatching {
                val provider = cameraProviderFuture.get()
                val previewBuilder = Preview.Builder()
                if (autoOptimize && activeReport != null) {
                    Camera2ControlsBinder.applySupportedParams(
                        builder = previewBuilder,
                        params = ManualCaptureParams(evSteps = 0),
                        caps = activeReport
                    )
                }
                val preview = previewBuilder.build().also {
                    it.surfaceProvider = previewView.surfaceProvider
                }
                val selector = if (selectedLensRole == LensRole.FRONT) {
                    CameraSelector.DEFAULT_FRONT_CAMERA
                } else {
                    CameraSelector.DEFAULT_BACK_CAMERA
                }

                provider.unbindAll()
                if (isVideoMode) {
                    val vc = videoRecorder.createVideoCapture(
                        prefer4k = activeReport?.supportedVideoFps?.isNotEmpty() == true
                    )
                    activeImageCapture = null
                    activeVideoCapture = vc
                    provider.bindToLifecycle(lifecycleOwner, selector, preview, vc)
                } else {
                    val ic = ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                        .build()
                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also {
                            it.setAnalyzer(
                                analysisExecutor,
                                OfflineVisionAnalyzer { scene, conf, luma, clip ->
                                    latestOnFrameAnalyzed(scene, conf, luma, clip)
                                }
                            )
                        }
                    activeVideoCapture = null
                    activeImageCapture = ic
                    provider.bindToLifecycle(lifecycleOwner, selector, preview, ic, analysis)
                }
            }.onFailure { err ->
                captureStatus = "Camera bind note: ${err.localizedMessage ?: "Unsupported combination"}"
            }
        }, ContextCompat.getMainExecutor(context))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF050507))
    ) {
        if (hasCameraPermission) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { previewView }
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "NOVA CAM AI — Xiaomi 17T",
                            style = MaterialTheme.typography.titleLarge,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Grant Camera, Audio, and Media permissions to probe physical Camera2 lenses and launch live AI scene optimization.",
                            color = Color(0xFFCBD5E1)
                        )
                        Button(onClick = onRequestPermissions) {
                            Text("Enable Camera Access")
                        }
                    }
                }
            }
        }

        // Top Liquid Glass HUD
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = if (isVideoMode) "PRO VIDEO · ${detectedScene.name} · $mappedParamsSummary" else "PRO PHOTO · $mappedParamsSummary",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White
                    )
                    if (coachInstruction != null) {
                        Text(
                            text = "AI Coach: $coachInstruction",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFE2E8F0)
                        )
                    }
                    if (captureStatus != null) {
                        Text(
                            text = captureStatus.orEmpty(),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFA78BFA)
                        )
                    }
                }
            }
        }

        // Bottom Lens, Cinematic Profile & Capture Controls
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val availableLenses = buildList {
                            if (resolvedLenses.ultraWide != null) add(LensRole.ULTRA_WIDE to "0.6×")
                            add(LensRole.MAIN to "1×")
                            if (resolvedLenses.telephoto != null) add(LensRole.TELEPHOTO to "5×")
                            if (resolvedLenses.front != null) add(LensRole.FRONT to "Front")
                        }
                        availableLenses.forEach { (role, label) ->
                            FilterChip(
                                selected = selectedLensRole == role,
                                onClick = { onSelectLens(role) },
                                label = { Text(label) }
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CinematicProfile.entries.forEach { profile ->
                            FilterChip(
                                selected = selectedProfile == profile,
                                onClick = { onSelectProfile(profile) },
                                label = { Text(profile.displayName) }
                            )
                        }
                    }

                    if (hasCameraPermission) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            if (isVideoMode) {
                                Button(
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (isRecording) Color(0xFFEF4444) else MaterialTheme.colorScheme.primary
                                    ),
                                    onClick = {
                                        val vc = activeVideoCapture ?: return@Button
                                        if (isRecording) {
                                            videoRecorder.stopRecording()
                                            isRecording = false
                                            captureStatus = "Saving video to Movies/NovaCamAI..."
                                        } else {
                                            isRecording = true
                                            captureStatus = "Recording video..."
                                            videoRecorder.startRecording(vc, enableAudio = hasAudioPermission) { event ->
                                                if (event is VideoRecordEvent.Finalize) {
                                                    isRecording = false
                                                    captureStatus = if (event.hasError()) {
                                                        "Video error: ${event.error}"
                                                    } else {
                                                        "Saved MP4 to Movies/NovaCamAI"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ) {
                                    Text(if (isRecording) "Stop Recording" else "Record Video")
                                }
                            } else {
                                Button(
                                    onClick = {
                                        val ic = activeImageCapture ?: return@Button
                                        val values = ContentValues().apply {
                                            put(MediaStore.Images.Media.DISPLAY_NAME, "NOVA_${System.currentTimeMillis()}.jpg")
                                            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                                            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/NovaCamAI")
                                        }
                                        val outputOptions = ImageCapture.OutputFileOptions.Builder(
                                            context.contentResolver,
                                            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                                            values
                                        ).build()
                                        captureStatus = "Capturing..."
                                        ic.takePicture(
                                            outputOptions,
                                            ContextCompat.getMainExecutor(context),
                                            object : ImageCapture.OnImageSavedCallback {
                                                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                                                    captureStatus = "Saved JPEG (${selectedProfile.displayName}) to Pictures/NovaCamAI"
                                                }

                                                override fun onError(exception: ImageCaptureException) {
                                                    captureStatus = "Capture failed: ${exception.message}"
                                                }
                                            }
                                        )
                                    }
                                ) {
                                    Text("Capture Photo")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AiCoachScreen(
    detectedScene: SceneCategory,
    confidence: Float,
    coachInstruction: String,
    secondaryTips: List<String>,
    recommendedLens: LensRole,
    optimizer: AiSceneOptimizer,
    activeReport: CameraCapabilityReport?,
    onTestScene: (SceneCategory) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .statusBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "AI Camera Coach & Scene Optimizer",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Detected Scene: ${detectedScene.name} (${(confidence * 100).toInt()}%)",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
                Text(text = "Primary Guidance: $coachInstruction", color = Color(0xFFE2E8F0))
                Text(text = "Suggested Lens: ${recommendedLens.name}", color = Color(0xFFA78BFA))
                secondaryTips.forEach { tip ->
                    Text(text = "• $tip", color = Color(0xFFCBD5E1))
                }
            }
        }

        Text(text = "Registered Scene Profiles", style = MaterialTheme.typography.titleMedium)
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            optimizer.getRegisteredScenes().forEach { scene ->
                FilterChip(
                    selected = detectedScene == scene,
                    onClick = { onTestScene(scene) },
                    label = { Text(scene.name) }
                )
            }
        }

        activeReport?.let { report ->
            val mapped = optimizer.resolveHardwareAdjustments(detectedScene, confidence, report)
            LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(text = "Hardware-Validated Mapping", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(text = mapped.rationale, color = Color(0xFFCBD5E1))
                    Text(text = "EV Delta: ${mapped.exposureEvDelta ?: "Unsupported"}", color = Color.White)
                    Text(text = "WB Kelvin: ${mapped.whiteBalanceKelvin ?: "Auto"}", color = Color.White)
                    Text(text = "Target ISO: ${mapped.targetIso ?: "Auto"}", color = Color.White)
                    if (mapped.skippedUnsupported.isNotEmpty()) {
                        Text(
                            text = "Skipped unsupported: ${mapped.skippedUnsupported.joinToString()}",
                            color = Color(0xFFFBBF24)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GalleryScreen() {
    val context = LocalContext.current
    var items by remember { mutableStateOf<List<MediaItemEntry>>(emptyList()) }

    LaunchedEffect(Unit) {
        items = runCatching { GalleryRepository(context).queryRecentPhotos(30) }.getOrDefault(emptyList())
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .statusBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "Scoped Gallery", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            OutlinedButton(
                onClick = {
                    items = runCatching { GalleryRepository(context).queryRecentPhotos(30) }.getOrDefault(emptyList())
                }
            ) {
                Text("Refresh")
            }
        }

        if (items.isEmpty()) {
            LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "No photos returned yet. Capture a photo or grant media read access to inspect MediaStore originals and graded exports.",
                    modifier = Modifier.padding(16.dp),
                    color = Color(0xFFE2E8F0)
                )
            }
        } else {
            items.forEach { entry ->
                LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(text = entry.displayName, color = Color.White, fontWeight = FontWeight.Medium)
                        Text(text = entry.mimeType, color = Color(0xFF94A3B8), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    app: NovaCamApplication,
    themeConfig: ThemeConfig,
    reports: List<CameraCapabilityReport>
) {
    val scope = rememberCoroutineScope()
    val privacy by app.settingsHolder.privacy.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .statusBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(text = "Settings & Xiaomi 17T Hardware", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(text = "AI & Privacy Controls", color = Color.White, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Auto AI Scene Optimization", color = Color(0xFFE2E8F0))
                    Switch(
                        checked = privacy.autoSceneOptimize,
                        onCheckedChange = { app.settingsHolder.setAutoSceneOptimize(it) }
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Online Gemini Vision Consent", color = Color(0xFFE2E8F0))
                    Switch(
                        checked = privacy.onlineVisionConsent,
                        onCheckedChange = { app.settingsHolder.setOnlineConsent(it) }
                    )
                }
            }
        }

        LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(text = "Custom UI Colour Engine", color = Color.White, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Dark OLED Mode", color = Color(0xFFE2E8F0))
                    Switch(
                        checked = themeConfig.darkMode,
                        onCheckedChange = { dark ->
                            scope.launch { app.themeDataStore.updateTheme(themeConfig.copy(darkMode = dark)) }
                        }
                    )
                }
                Text(text = "Glass Opacity: ${(themeConfig.glassOpacity * 100).toInt()}%", color = Color(0xFFCBD5E1))
                Slider(
                    value = themeConfig.glassOpacity,
                    onValueChange = { next ->
                        scope.launch { app.themeDataStore.updateTheme(themeConfig.copy(glassOpacity = next)) }
                    },
                    valueRange = 0.35f..0.90f
                )
            }
        }

        LiquidGlassPanel(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Probed Camera2 Devices (${reports.size})",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
                if (reports.isEmpty()) {
                    Text(text = "No Camera2 devices exposed in current runtime.", color = Color(0xFFCBD5E1))
                } else {
                    reports.forEachIndexed { idx, r ->
                        if (idx > 0) HorizontalDivider(color = Color.White.copy(alpha = 0.12f))
                        Text(
                            text = "${r.lensRole.name} (ID ${r.physicalId ?: r.cameraId}) · ${r.focalLengthMm}mm · f/${r.aperture}",
                            color = Color.White
                        )
                        Text(
                            text = "RAW: ${r.supportsRawDng} · OIS: ${r.supportsOis} · Manual WB: ${r.supportsManualWb} · HDR: ${r.supportedHdrProfiles.ifEmpty { listOf("SDR") }.joinToString()}",
                            color = Color(0xFF94A3B8),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
    }
}
