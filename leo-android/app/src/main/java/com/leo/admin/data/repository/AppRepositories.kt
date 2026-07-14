package com.leo.admin.data.repository

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.reflect.TypeToken
import com.leo.admin.data.api.ApiClientProvider
import com.leo.admin.data.api.NetworkResult
import com.leo.admin.data.model.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

// ─── JSON helpers ─────────────────────────────────────────────────────────────

private inline fun <reified T> Gson.parseList(element: JsonElement?): List<T> {
    if (element == null || element.isJsonNull) return emptyList()
    val type = object : TypeToken<List<T>>() {}.type
    return try {
        when {
            element.isJsonArray -> fromJson(element, type) ?: emptyList()
            element.isJsonObject -> {
                val data = element.asJsonObject["data"]
                if (data?.isJsonArray == true) fromJson(data, type) ?: emptyList()
                else emptyList()
            }
            else -> emptyList()
        }
    } catch (_: Exception) { emptyList() }
}

private inline fun <reified T> Gson.parseObject(element: JsonElement?): T? {
    if (element == null || element.isJsonNull) return null
    return try {
        if (element.isJsonObject) {
            val obj = element.asJsonObject
            val data = obj["data"]
            if (data != null && !data.isJsonNull) fromJson(data, T::class.java)
            else fromJson(obj, T::class.java)
        } else null
    } catch (_: Exception) { null }
}

private suspend fun <T> safeCall(block: suspend () -> NetworkResult<T>): NetworkResult<T> = try {
    block()
} catch (e: Exception) {
    NetworkResult.Error(e.message ?: "Network error")
}

// ─── Passport Repository ──────────────────────────────────────────────────────

@Singleton
class PassportRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getPassports(): NetworkResult<List<PassportDto>> = safeCall {
        val r = apiClientProvider.getApiService().getPassports()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }

    suspend fun getStats(): NetworkResult<PassportStats> = safeCall {
        val r = apiClientProvider.getApiService().getPassportStats()
        if (r.isSuccessful) {
            val stats = gson.parseObject<PassportStats>(r.body())
                ?: PassportStats()
            NetworkResult.Success(stats)
        } else NetworkResult.Error("Error ${r.code()}", r.code())
    }

    suspend fun getPassport(id: Int): NetworkResult<PassportDto> = safeCall {
        val r = apiClientProvider.getApiService().getPassport(id)
        if (r.isSuccessful) {
            val dto = gson.parseObject<PassportDto>(r.body())
                ?: return@safeCall NetworkResult.Error("Not found")
            NetworkResult.Success(dto)
        } else NetworkResult.Error("Error ${r.code()}", r.code())
    }

    suspend fun uploadPassport(
        file: File,
        fields: Map<String, String> = emptyMap()
    ): NetworkResult<String> = safeCall {
        val reqBody = file.asRequestBody("image/*".toMediaType())
        val part = MultipartBody.Part.createFormData("image", file.name, reqBody)
        val fieldMap = fields.mapValues { it.value.toRequestBody("text/plain".toMediaType()) }
        val r = apiClientProvider.getApiService().uploadPassport(part, fieldMap)
        if (r.isSuccessful) NetworkResult.Success("Upload successful")
        else NetworkResult.Error("Upload failed (${r.code()})", r.code())
    }
}

// ─── LOA Repository ──────────────────────────────────────────────────────────

@Singleton
class LoaRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getLoa(): NetworkResult<List<LoaDto>> = safeCall {
        val r = apiClientProvider.getApiService().getLoa()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Company Repository ───────────────────────────────────────────────────────

@Singleton
class CompanyRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getCompanies(): NetworkResult<List<CompanyDto>> = safeCall {
        val r = apiClientProvider.getApiService().getCompanies()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Client Repository ────────────────────────────────────────────────────────

@Singleton
class ClientRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getClients(): NetworkResult<List<ClientDto>> = safeCall {
        val r = apiClientProvider.getApiService().getClients()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Password Repository ──────────────────────────────────────────────────────

@Singleton
class PasswordRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getPasswords(): NetworkResult<List<PasswordDto>> = safeCall {
        val r = apiClientProvider.getApiService().getPasswords()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Billing Repository ───────────────────────────────────────────────────────

@Singleton
class BillingRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getBillingDocuments(): NetworkResult<List<BillingDto>> = safeCall {
        val r = apiClientProvider.getApiService().getBillingDocuments()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Expense Repository ───────────────────────────────────────────────────────

@Singleton
class ExpenseRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getExpenses(): NetworkResult<List<ExpenseDto>> = safeCall {
        val r = apiClientProvider.getApiService().getExpenses()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Salary Repository ────────────────────────────────────────────────────────

@Singleton
class SalaryRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getSalaryRecords(): NetworkResult<List<SalaryDto>> = safeCall {
        val r = apiClientProvider.getApiService().getSalaryRecords()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Admin Repository ─────────────────────────────────────────────────────────

@Singleton
class AdminRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getAdminUsers(): NetworkResult<List<AdminUserDto>> = safeCall {
        val r = apiClientProvider.getApiService().getAdminUsers()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}

// ─── Task Repository ──────────────────────────────────────────────────────────

@Singleton
class TaskRepository @Inject constructor(
    private val apiClientProvider: ApiClientProvider,
    private val gson: Gson
) {
    suspend fun getTasks(): NetworkResult<List<TaskDto>> = safeCall {
        val r = apiClientProvider.getApiService().getTasks()
        if (r.isSuccessful) NetworkResult.Success(gson.parseList(r.body()))
        else NetworkResult.Error("Error ${r.code()}", r.code())
    }
}
