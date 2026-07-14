package com.leo.admin.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "leo_prefs")

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("auth_token")
        private val BASE_URL_KEY = stringPreferencesKey("base_url")
        const val DEFAULT_BASE_URL = "http://100.126.222.96"
    }

    val tokenFlow: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[TOKEN_KEY] ?: ""
    }

    val baseUrlFlow: Flow<String> = context.dataStore.data.map { prefs ->
        val stored = prefs[BASE_URL_KEY] ?: ""
        stored.ifEmpty { DEFAULT_BASE_URL }
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }

    suspend fun clearToken() {
        context.dataStore.edit { it.remove(TOKEN_KEY) }
    }

    suspend fun saveBaseUrl(url: String) {
        context.dataStore.edit { it[BASE_URL_KEY] = url }
    }

    suspend fun getToken(): String = tokenFlow.first()

    suspend fun getBaseUrl(): String = baseUrlFlow.first()
}
