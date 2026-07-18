package com.sky.office.data.repository

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.sky.office.data.api.ApiClientProvider
import com.sky.office.data.api.NetworkResult
import com.sky.office.data.local.TokenManager
import com.sky.office.data.model.LoginRequest
import com.sky.office.data.model.UserDto
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val tokenManager: TokenManager,
    private val gson: Gson
) {
    val tokenFlow: Flow<String> = tokenManager.tokenFlow

    suspend fun login(email: String, password: String): NetworkResult<String> = try {
        val response = apiClientProvider.getApiService().login(LoginRequest(email, password))
        if (response.isSuccessful) {
            val element = response.body()
            val obj = element?.takeIf { it.isJsonObject }?.asJsonObject
            val token = obj?.get("token")?.takeIf { !it.isJsonNull }?.asString
                ?: obj?.get("access_token")?.takeIf { !it.isJsonNull }?.asString
                ?: ""
            if (token.isNotEmpty()) {
                tokenManager.saveToken(token)
                NetworkResult.Success(token)
            } else {
                NetworkResult.Error("No token received. Check API response.")
            }
        } else {
            val errorMsg = try {
                val errBody = response.errorBody()?.string() ?: ""
                gson.fromJson(errBody, JsonObject::class.java)
                    ?.get("message")?.asString ?: errBody
            } catch (_: Exception) { "Login failed (${response.code()})" }
            NetworkResult.Error(errorMsg, response.code())
        }
    } catch (e: Exception) {
        NetworkResult.Error(e.message ?: "Network error")
    }

    suspend fun getMe(): NetworkResult<UserDto> = try {
        val response = apiClientProvider.getApiService().getMe()
        if (response.isSuccessful && response.body() != null) {
            NetworkResult.Success(response.body()!!)
        } else {
            NetworkResult.Error("Failed to fetch profile (${response.code()})", response.code())
        }
    } catch (e: Exception) {
        NetworkResult.Error(e.message ?: "Network error")
    }

    suspend fun logout() {
        tokenManager.clearToken()
    }
}
