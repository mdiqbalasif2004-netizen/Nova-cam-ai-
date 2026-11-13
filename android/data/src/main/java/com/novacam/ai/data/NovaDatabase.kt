package com.novacam.ai.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "ai_analysis_history")
data class AiAnalysisRecord(
    @PrimaryKey val id: String,
    val mediaUri: String,
    val detectedScene: String,
    val summary: String,
    val subjectiveIndicator: Int,
    val createdAtEpochMs: Long
)

@Dao
interface AiAnalysisDao {
    @Query("SELECT * FROM ai_analysis_history ORDER BY createdAtEpochMs DESC")
    suspend fun listAll(): List<AiAnalysisRecord>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(record: AiAnalysisRecord)

    @Query("DELETE FROM ai_analysis_history")
    suspend fun clearAll()
}

@Database(entities = [AiAnalysisRecord::class], version = 1, exportSchema = false)
abstract class NovaDatabase : RoomDatabase() {
    abstract fun aiAnalysisDao(): AiAnalysisDao
}
