import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DataTableCard({
  loading,
  empty,
  emptyMessage = "No records found",
  children,
}: {
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <Card className="border-card-border shadow-sm">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </CardContent>
      </Card>
    );
  }

  if (empty) {
    return (
      <Card className="border-card-border shadow-sm">
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-card-border shadow-sm overflow-hidden">
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
