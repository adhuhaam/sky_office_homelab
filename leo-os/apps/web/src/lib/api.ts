const API_BASE = "/api";

type AuthRecoveryHandler = () => Promise<boolean>;
let authRecoveryHandler: AuthRecoveryHandler | null = null;

/** Called from AuthProvider — retries module fetches once after session refresh on 401. */
export function registerAuthRecoveryHandler(handler: AuthRecoveryHandler | null): void {
  authRecoveryHandler = handler;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }

    if (
      !retried &&
      res.status === 401 &&
      !path.startsWith("/auth/") &&
      authRecoveryHandler
    ) {
      const recovered = await authRecoveryHandler();
      if (recovered) {
        return apiFetch<T>(path, options, true);
      }
    }

    throw new ApiError(message, res.status);
  }

  if (res.status === 204 || res.status === 304) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export function passportQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface AuthUser {
  authenticated: boolean;
  userId: number | null;
  email: string | null;
  name: string | null;
  role: string | null;
  phone: string | null;
  designation: string | null;
  companyId: number | null;
  linkedEntityId: string | null;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  isBlocked: boolean;
  linkedEntityId: string | null;
  phone: string | null;
  designation: string | null;
  companyId: number | null;
  hasPassword: boolean;
  createdAt: string;
}

export interface RolePermission {
  role: string;
  module: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface Company {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  registrationNumber: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  bankSwiftCode: string | null;
  letterheadImage?: string | null;
  signatureImage?: string | null;
  invoiceLogoImage?: string | null;
}

export interface Client {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tin: string | null;
  notes: string | null;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  color: string | null;
}

export interface Expense {
  id: number;
  categoryId: number;
  categoryName?: string;
  categoryColor?: string | null;
  amount: string;
  expenseDate: string | null;
  remarks: string | null;
}

export interface BillingItem {
  id: number;
  description: string;
  detail?: string | null;
  qty: string;
  rate: string;
  amount: string;
}

export interface BillingDocument {
  id: number;
  kind: string;
  number: string;
  companyId: number;
  companyName?: string;
  companyAddress?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyRegistrationNumber?: string | null;
  companyBankName?: string | null;
  companyBankAccountNumber?: string | null;
  companyBankAccountHolder?: string | null;
  companyBankSwiftCode?: string | null;
  clientId: number | null;
  clientName?: string | null;
  customerName: string;
  customerAddress: string | null;
  customerTin: string | null;
  issueDate: string;
  dueDate: string | null;
  terms?: string | null;
  gstRate?: string;
  gstInclusive?: boolean;
  notes: string | null;
  status: string;
  subtotal?: string;
  employeeCost?: string;
  profit?: string;
  items?: BillingItem[];
  letterheadImage?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
  signatureImage?: string | null;
  invoiceLogoImage?: string | null;
  systemLogoImage?: string | null;
  systemAddress?: string | null;
  systemPhone?: string | null;
  systemEmail?: string | null;
}

export interface SalaryRecord {
  id: number;
  employeeName: string;
  passportId: number | null;
  month: number;
  year: number;
  basicSalary: string;
  foodAllowance: string;
  transportAllowance: string;
  otherAllowances: string;
  deductions: string;
  otherExpenses: string;
  netSalary: string;
  clientSalary: string;
  invoiceId: number | null;
  daysWorked: number;
  notes: string | null;
  status: string;
  passportNumber?: string | null;
  employeeType?: string | null;
  jobTitle?: string | null;
}

export interface SystemSettings {
  appName: string;
  accentHue: number;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  companyRegistrationNumber: string | null;
  logoImage: string | null;
  logoImageDark: string | null;
  hasCustomPassword: boolean;
  hasOpenaiApiKey: boolean;
  openaiOcrBaseUrl: string | null;
  openaiOcrModel: string | null;
}

export interface Passport {
  id: number;
  fullName: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  nationality: string | null;
  status: string;
  submitted: boolean;
  errorMessage: string | null;
  originalFilename: string | null;
  companyId: number | null;
  companyName?: string | null;
  clientId: number | null;
  clientName?: string | null;
  workPermitNumber: string | null;
  agent: string | null;
  agencySalary: string | null;
  clientSalary: string | null;
  agentRate: string | null;
  employeeType: string;
  jobTitle?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PassportStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  bangladeshi: number;
  indian: number;
  recentUploads: Passport[];
}

export interface WorkPermitAlert {
  passportId: number;
  employeeName: string;
  employerName: string | null;
  workPermitNumber: string;
  passportNumber: string;
  expiryDate: string;
  photoUrl: string | null;
  status: "expired" | "expiring_soon";
}

export interface WorkPermitAlerts {
  expired: WorkPermitAlert[];
  expiringSoon: WorkPermitAlert[];
}

export interface LoaEntry {
  id: number;
  companyId: number | null;
  passportId: number | null;
  companyName: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyCountry: string | null;
  companyRegistrationNumber: string | null;
  candidateName: string | null;
  candidateAddress: string | null;
  candidateNationality: string | null;
  candidateDateOfBirth: string | null;
  candidatePassportNumber: string | null;
  candidateEmergencyContact: string | null;
  jobTitle: string | null;
  workType: string | null;
  basicSalary: string | null;
  salaryPaymentDate: string | null;
  workSite: string | null;
  dateOfCommence: string | null;
  jobDescription: string | null;
  workingHours: string | null;
  workStatus: string | null;
  contractDuration: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
  signatureDate: string | null;
  letterheadImage?: string | null;
  signatureImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoaOption {
  id: number;
  companyId: number;
  category: string;
  value: string;
  createdAt: string;
}

export interface PasswordEntry {
  id: number;
  companyId: number;
  companyName: string;
  efaasUsername: string;
  efaasPassword: string;
  gmailUsername: string;
  gmailPassword: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  id: number;
  name: string;
  role: string;
  designation?: string | null;
  phone?: string | null;
  companyName?: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  notes?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date (YYYY-MM-DD) */
  dueDate?: string | null;
  parentId?: number | null;
  position: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  parentId?: number | null;
}

export interface TaskUpdate {
  title?: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  parentId?: number | null;
  position?: number;
}
