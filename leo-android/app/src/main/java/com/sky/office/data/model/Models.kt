package com.sky.office.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(val email: String, val password: String)

data class UserDto(
    val id: Int? = null,
    val name: String? = null,
    val email: String? = null,
    val role: String? = null,
    val avatar: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class PassportDto(
    val id: Int? = null,
    @SerializedName("fullName") val fullName: String? = null,
    @SerializedName("passportNumber") val passportNumber: String? = null,
    val nationality: String? = null,
    val status: String? = null,
    @SerializedName("dateOfExpiry") val dateOfExpiry: String? = null,
    @SerializedName("dateOfBirth") val dateOfBirth: String? = null,
    @SerializedName("dateOfIssue") val dateOfIssue: String? = null,
    val address: String? = null,
    @SerializedName("emergencyContactPhone") val emergencyContactPhone: String? = null,
    @SerializedName("companyId") val companyId: Int? = null,
    @SerializedName("clientId") val clientId: Int? = null,
    @SerializedName("workPermitNumber") val workPermitNumber: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null
) {
    val name: String? get() = fullName
    val expiryDate: String? get() = dateOfExpiry
    val issueDate: String? get() = dateOfIssue
    val phone: String? get() = emergencyContactPhone
    val gender: String? get() = null
    val placeOfBirth: String? get() = null
    val company: String? get() = companyId?.toString()
    val client: String? get() = clientId?.toString()
    val notes: String? get() = null
}

data class PassportStats(
    val total: Int? = null,
    val processing: Int? = null,
    val completed: Int? = null,
    val bangladeshi: Int? = null,
    val indian: Int? = null
) {
    val active: Int? get() = completed
    val expired: Int? get() = null
    val expiringSoon: Int? get() = null
    val pending: Int? get() = processing
}

data class LoaDto(
    val id: Int? = null,
    @SerializedName("candidateName") val candidateName: String? = null,
    @SerializedName("companyName") val companyName: String? = null,
    @SerializedName("jobTitle") val jobTitle: String? = null,
    @SerializedName("candidatePassportNumber") val candidatePassportNumber: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
) {
    val title: String? get() = candidateName
    val documentNumber: String? get() = candidatePassportNumber
    val company: String? get() = companyName
    val client: String? get() = jobTitle
    val status: String? get() = null
}

data class CompanyDto(
    val id: Int? = null,
    val name: String? = null,
    @SerializedName("registrationNumber") val registrationNumber: String? = null,
    val address: String? = null,
    val phone: String? = null,
    val email: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class ClientDto(
    val id: Int? = null,
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class PasswordDto(
    val id: Int? = null,
    val title: String? = null,
    val username: String? = null,
    val password: String? = null,
    val url: String? = null,
    val notes: String? = null,
    val category: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class BillingDto(
    val id: Int? = null,
    @SerializedName("documentNumber") val documentNumber: String? = null,
    @SerializedName("billToName") val billToName: String? = null,
    val total: Double? = null,
    val status: String? = null,
    val kind: String? = null,
    val currency: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
) {
    val client: String? get() = billToName
    val amount: Double? get() = total
    val type: String? get() = kind
}

data class ExpenseDto(
    val id: Int? = null,
    val title: String? = null,
    val amount: Double? = null,
    val category: String? = null,
    val date: String? = null,
    val status: String? = null,
    val notes: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class SalaryDto(
    val id: Int? = null,
    @SerializedName("employeeName") val employeeName: String? = null,
    val amount: Double? = null,
    val month: String? = null,
    val status: String? = null,
    @SerializedName("paidDate") val paidDate: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class AdminUserDto(
    val id: Int? = null,
    val name: String? = null,
    val email: String? = null,
    val role: String? = null,
    val status: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

data class TaskDto(
    val id: Int? = null,
    val title: String? = null,
    val status: String? = null,
    val priority: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)
