package com.leo.smsgateway.data.remote

import com.leo.smsgateway.data.remote.dto.HeartbeatRequest
import com.leo.smsgateway.data.remote.dto.RegisterRequest
import com.leo.smsgateway.data.remote.dto.RegisterResponse
import com.leo.smsgateway.data.remote.dto.SmsResultRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Url
import com.leo.smsgateway.data.remote.dto.GatewayConfigResponse

/**
 * All endpoints use full @Url so that the base URL can change
 * at runtime without recreating Retrofit.
 */
interface ApiService {

    @POST
    suspend fun register(
        @Url url: String,
        @Body request: RegisterRequest,
    ): Response<RegisterResponse>

    @GET
    suspend fun getConfig(
        @Url url: String,
    ): Response<GatewayConfigResponse>

    @POST
    suspend fun reportResult(
        @Url url: String,
        @Body request: SmsResultRequest,
    ): Response<Unit>

    @POST
    suspend fun heartbeat(
        @Url url: String,
        @Body request: HeartbeatRequest,
    ): Response<Unit>
}
