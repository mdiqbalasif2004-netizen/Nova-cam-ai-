pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "NovaCamAI"

include(
    ":app",
    ":domain",
    ":data",
    ":camera-core",
    ":camera-xiaomi",
    ":camera-controls",
    ":photo-processing",
    ":cinematic-engine",
    ":video-engine",
    ":video-hdr",
    ":ai-core",
    ":ai-offline",
    ":ai-cloud",
    ":composition-engine",
    ":gallery",
    ":liquid-glass-ui",
    ":theme-customizer",
    ":update-manager",
    ":settings"
)
