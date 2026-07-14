package com.leo.admin.di

import com.leo.admin.data.api.ApiClientProvider
import com.leo.admin.data.api.ApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    /**
     * Convenience binding — repositories can inject ApiService directly; the provider
     * ensures it always reflects the current base URL and auth token.
     */
    @Provides
    @Singleton
    fun provideApiService(provider: ApiClientProvider): ApiService =
        provider.getApiService()
}
