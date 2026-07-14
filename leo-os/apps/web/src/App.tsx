import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApplySystemSettings } from "@/hooks/use-system-settings";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";
import { ProtectedRoute, RoleRoute } from "@/components/protected-route";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaProvider } from "@/components/pwa-provider";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { DashboardPage } from "@/pages/dashboard";
import { CompaniesPage } from "@/pages/companies";
import { ClientsPage } from "@/pages/clients";
import { ExpensesPage } from "@/pages/expenses";
import { BillingPage } from "@/pages/billing";
import { BillingFormPage } from "@/pages/billing-form";
import { BillingViewPage } from "@/pages/billing-view";
import { BillingPrintPage } from "@/pages/billing-print";
import { LoaPage } from "@/pages/loa";
import { LoaPrintPage } from "@/pages/loa-print";
import { PasswordsPage } from "@/pages/passwords";
import { SalaryPage } from "@/pages/salary";
import { UploadPage } from "@/pages/upload";
import { MasterListPage } from "@/pages/master-list";
import { EmployeeProfilePage } from "@/pages/employee-profile";
import { SettingsPage } from "@/pages/settings";
import { AboutSystemPage } from "@/pages/about-system";
import { SmsGatewayPage } from "@/pages/sms-gateways";
import { UsersPage } from "@/pages/users";
import { PermissionsPage } from "@/pages/permissions";
import { ProfilePage } from "@/pages/profile";
import { UserProfilePage } from "@/pages/user-profile";
import { NotFoundPage } from "@/pages/not-found";
import { ExpenseVoucherPrintPage } from "@/pages/expense-voucher-print";
import { SalarySheetViewPage } from "@/pages/salary-sheet-view";
import { SalaryPayslipPage } from "@/pages/salary-payslip-page";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/u/:userId" component={UserProfilePage} />
      <Route path="/billing/:id/print" component={BillingPrintPage} />
      <Route path="/loa/:id/print" component={LoaPrintPage} />
      <Route path="/expenses/:id/print" component={ExpenseVoucherPrintPage} />
      <Route path="/salary/sheet" component={SalarySheetViewPage} />
      <Route path="/salary/:id/payslip" component={SalaryPayslipPage} />
      <Route>
        <ProtectedRoute>
          <Switch>
            <Route path="/billing/new/:kind">
              <RoleRoute roles={["admin", "superuser"]}>
                <BillingFormPage />
              </RoleRoute>
            </Route>
            <Route path="/billing/:id/edit">
              <RoleRoute roles={["admin", "superuser"]}>
                <BillingFormPage />
              </RoleRoute>
            </Route>
            <Route path="/billing/:id">
              <RoleRoute roles={["admin", "superuser", "company", "client"]}>
                <BillingViewPage />
              </RoleRoute>
            </Route>
            <Route>
              <AppLayout>
                <Switch>
                  <Route path="/" component={DashboardPage} />
                  <Route path="/upload">
                    <RoleRoute roles={["admin", "superuser", "company"]}>
                      <UploadPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/master-list">
                    <RoleRoute roles={["admin", "superuser", "company", "client", "agent"]}>
                      <MasterListPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/passports">
                    <RoleRoute roles={["admin", "superuser", "company", "client", "agent"]}>
                      <MasterListPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/employees/:id">
                    <RoleRoute roles={["admin", "superuser", "company", "client", "agent", "employee"]}>
                      <EmployeeProfilePage />
                    </RoleRoute>
                  </Route>
                  <Route path="/companies">
                    <RoleRoute roles={["admin", "superuser", "company"]}>
                      <CompaniesPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/clients">
                    <RoleRoute roles={["admin", "superuser"]}>
                      <ClientsPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/loa">
                    <RoleRoute roles={["admin", "superuser", "company"]}>
                      <LoaPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/passwords">
                    <RoleRoute roles={["admin", "superuser"]}>
                      <PasswordsPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/billing">
                    <RoleRoute roles={["admin", "superuser", "company", "client"]}>
                      <BillingPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/expenses">
                    <RoleRoute roles={["admin", "superuser"]}>
                      <ExpensesPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/salary">
                    <RoleRoute roles={["admin", "superuser", "employee"]}>
                      <SalaryPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/users">
                    <RoleRoute roles={["admin", "superuser"]}>
                      <UsersPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/permissions">
                    <RoleRoute roles={["superuser"]}>
                      <PermissionsPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/settings">
                    <RoleRoute roles={["superuser"]}>
                      <SettingsPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/sms-gateways">
                    <RoleRoute roles={["superuser"]}>
                      <SmsGatewayPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/about-system">
                    <RoleRoute roles={["superuser"]}>
                      <AboutSystemPage />
                    </RoleRoute>
                  </Route>
                  <Route path="/profile" component={ProfilePage} />
                  <Route component={NotFoundPage} />
                </Switch>
              </AppLayout>
            </Route>
          </Switch>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

export default function App() {
  useApplySystemSettings();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PwaProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster />
          </AuthProvider>
        </PwaProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
