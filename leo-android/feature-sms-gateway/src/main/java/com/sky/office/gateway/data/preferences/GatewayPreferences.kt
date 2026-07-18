package com.sky.office.gateway.data.preferences

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "gateway_prefs")

@Singleton
class GatewayPreferences @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val SERVER_URL = stringPreferencesKey("server_url")
        val GATEWAY_ID = stringPreferencesKey("gateway_id")
        val GATEWAY_KEY = stringPreferencesKey("gateway_key")
        val GATEWAY_NAME = stringPreferencesKey("gateway_name")
        val IS_REGISTERED = booleanPreferencesKey("is_registered")
    }

    val serverUrl: Flow<String> = context.dataStore.data.map { it[Keys.SERVER_URL] ?: "" }
    val gatewayId: Flow<String> = context.dataStore.data.map { it[Keys.GATEWAY_ID] ?: "" }
    val gatewayKey: Flow<String> = context.dataStore.data.map { it[Keys.GATEWAY_KEY] ?: "" }
    val gatewayName: Flow<String> = context.dataStore.data.map { it[Keys.GATEWAY_NAME] ?: "" }
    val isRegistered: Flow<Boolean> = context.dataStore.data.map { it[Keys.IS_REGISTERED] ?: false }

    val allPrefs: Flow<GatewayPrefs> = context.dataStore.data.map { p ->
        GatewayPrefs(
            serverUrl = p[Keys.SERVER_URL] ?: "",
            gatewayId = p[Keys.GATEWAY_ID] ?: "",
            gatewayKey = p[Keys.GATEWAY_KEY] ?: "",
            gatewayName = p[Keys.GATEWAY_NAME] ?: "",
            isRegistered = p[Keys.IS_REGISTERED] ?: false,
        )
    }

    suspend fun getPrefsSnapshot(): GatewayPrefs = allPrefs.first()

    suspend fun saveRegistration(
        serverUrl: String,
        gatewayId: String,
        gatewayKey: String,
        name: String,
    ) {
        context.dataStore.edit { p ->
            p[Keys.SERVER_URL] = serverUrl.trimEnd('/')
            p[Keys.GATEWAY_ID] = gatewayId
            p[Keys.GATEWAY_KEY] = gatewayKey
            p[Keys.GATEWAY_NAME] = name
            p[Keys.IS_REGISTERED] = true
        }
    }

    suspend fun updateServerUrl(url: String) {
        context.dataStore.edit { it[Keys.SERVER_URL] = url.trimEnd('/') }
    }

    suspend fun clearRegistration() {
        context.dataStore.edit { p ->
            p[Keys.GATEWAY_ID] = ""
            p[Keys.GATEWAY_KEY] = ""
            p[Keys.IS_REGISTERED] = false
        }
    }

    data class GatewayPrefs(
        val serverUrl: String,
        val gatewayId: String,
        val gatewayKey: String,
        val gatewayName: String,
        val isRegistered: Boolean,
    )
}
