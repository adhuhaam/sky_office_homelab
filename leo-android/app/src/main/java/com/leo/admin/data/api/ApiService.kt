package com.leo.admin.data.api

import com.google.gson.JsonElement
import com.leo.admin.data.model.LoginRequest
import com.leo.admin.data.model.UserDto
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── Auth ──────────────────────────────────────────────────────────────

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<JsonElement>

    @GET("api/auth/me")
    suspend fun getMe(): Response<UserDto>

    // ── Passports ─────────────────────────────────────────────────────────

    @GET("api/passports")
    suspend fun getPassports(): Response<JsonElement>

    @GET("api/passports/stats")
    suspend fun getPassportStats(): Response<JsonElement>

    @GET("api/passports/{id}")
    suspend fun getPassport(@Path("id") id: Int): Response<JsonElement>

    @Multipart
    @POST("api/passports/upload")
    suspend fun uploadPassport(
        @Part image: MultipartBody.Part,
        @PartMap fields: Map<String, @JvmSuppressWildcards RequestBody>
    ): Response<JsonElement>

    // ── LOA ───────────────────────────────────────────────────────────────

    @GET("api/loa")
    suspend fun getLoa(): Response<JsonElement>

    // ── Companies ─────────────────────────────────────────────────────────

    @GET("api/companies")
    suspend fun getCompanies(): Response<JsonElement>

    // ── Clients ───────────────────────────────────────────────────────────

    @GET("api/clients")
    suspend fun getClients(): Response<JsonElement>

    // ── Passwords ─────────────────────────────────────────────────────────

    @GET("api/passwords")
    suspend fun getPasswords(): Response<JsonElement>

    // ── Billing ───────────────────────────────────────────────────────────

    @GET("api/billing/documents")
    suspend fun getBillingDocuments(): Response<JsonElement>

    // ── Expenses ──────────────────────────────────────────────────────────

    @GET("api/expenses")
    suspend fun getExpenses(): Response<JsonElement>

    // ── Salary ────────────────────────────────────────────────────────────

    @GET("api/salary-records")
    suspend fun getSalaryRecords(): Response<JsonElement>

    // ── Admin ─────────────────────────────────────────────────────────────

    @GET("api/admin/users")
    suspend fun getAdminUsers(): Response<JsonElement>

    // ── Tasks ─────────────────────────────────────────────────────────────

    @GET("api/tasks")
    suspend fun getTasks(): Response<JsonElement>
}
