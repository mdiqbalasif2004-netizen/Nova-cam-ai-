plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.novacam.ai.video"
    compileSdk = 35
    defaultConfig { minSdk = 31 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":domain"))
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.video)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.transformer)
}
