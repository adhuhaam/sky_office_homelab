package com.leo.admin.data.api

import com.google.gson.Gson
import com.leo.admin.data.local.TokenManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Dynamic retrofit client. Reads base URL and auth token from DataStore before every
 * request via interceptors, so changes made in Profile/Settings take effect immediately.
 */
@Singleton
class ApiClientProvider @Inject constructor(
    private val tokenManager: TokenManager,
    private val gson: Gson
) {
    @Volatile private var retrofit: Retrofit? = null
    @Volatile private var cachedBaseUrl: String = ""

    @Synchronized
    fun getApiService(): ApiService {
        val baseUrl = runBlocking { tokenManager.baseUrlFlow.first() }
            .trimEnd('/') + "/"

        if (retrofit == null || baseUrl != cachedBaseUrl) {
            cachedBaseUrl = baseUrl
            retrofit = buildRetrofit(baseUrl)
        }
        return retrofit!!.create(ApiService::class.java)
    }

    private fun buildRetrofit(baseUrl: String): Retrofit {
        val authInterceptor = okhttp3.Interceptor { chain ->
            val token = runBlocking { tokenManager.tokenFlow.first() }
            val request = if (token.isNotEmpty()) {
                chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }

        // Dynamic host replacement — lets the user switch base URL without restarting
        val dynamicHostInterceptor = okhttp3.Interceptor { chain ->
            val liveUrl = runBlocking { tokenManager.baseUrlFlow.first() }
                .trimEnd('/') + "/"
            val parsedBase = liveUrl.toHttpUrlOrNull()
            if (parsedBase != null && liveUrl != cachedBaseUrl) {
                val newUrl = chain.request().url.newBuilder()
                    .scheme(parsedBase.scheme)
                    .host(parsedBase.host)
                    .port(parsedBase.port)
                    .build()
                chain.proceed(chain.request().newBuilder().url(newUrl).build())
            } else {
                chain.proceed(chain.request())
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(dynamicHostInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }
}
