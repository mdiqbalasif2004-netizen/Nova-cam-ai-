plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.novacam.ai"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.novacam.ai"
        minSdk = 31
        targetSdk = 35
        versionCode = 140
        versionName = "1.4.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        getByName("debug") {
            val ks = rootProject.file("debug.keystore")
            if (ks.exists()) {
                storeFile = ks
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":data"))
    implementation(project(":camera-core"))
    implementation(project(":camera-xiaomi"))
    implementation(project(":camera-controls"))
    implementation(project(":photo-processing"))
    implementation(project(":cinematic-engine"))
    implementation(project(":video-engine"))
    implementation(project(":video-hdr"))
    implementation(project(":ai-core"))
    implementation(project(":ai-offline"))
    implementation(project(":ai-cloud"))
    implementation(project(":composition-engine"))
    implementation(project(":gallery"))
    implementation(project(":liquid-glass-ui"))
    implementation(project(":theme-customizer"))
    implementation(project(":update-manager"))
    implementation(project(":settings"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.navigation.compose)
}
