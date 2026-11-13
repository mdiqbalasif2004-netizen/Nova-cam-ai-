plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.novacam.ai.ai.offline"
    compileSdk = 35
    defaultConfig { minSdk = 31 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":domain"))
    implementation(libs.androidx.camera.core)
    implementation(libs.mlkit.image.labeling)
    implementation(libs.mlkit.face.detection)
}
