plugins {
    alias(libs.plugins.android.library)
}

android {
    namespace = "com.novacam.ai.ai.cloud"
    compileSdk = 35
    defaultConfig { minSdk = 31 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(libs.okhttp)
}
