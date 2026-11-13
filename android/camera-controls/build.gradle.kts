plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.novacam.ai.controls"
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
    implementation(libs.androidx.camera.camera2)
}
