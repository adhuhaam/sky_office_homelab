import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { useSystemSettings } from "@/hooks/use-system-settings";

export function AuthLayout({
  title,
  description,
  icon,
  children,
  footer,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { appName } = useSystemSettings();

  return (
    <div className="min-h-screen w-full bg-app-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="px-6 py-2 mb-6 flex items-center justify-center">
          <BrandLogo context="light" size="auth" />
        </div>

        <Card className="border-card-border shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
              </div>
            </div>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer}

        <p className="mt-4 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          {appName}
        </p>
      </div>
    </div>
  );
}
