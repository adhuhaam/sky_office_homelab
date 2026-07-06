import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Building,
  Calendar,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Receipt,
  Trash2,
  UserMinus,
  Users,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError, type BillingDocument, type Client, type Passport } from "@/lib/api";
import {
  billingDocTotal,
  billingPrintPath,
  fmtBillingDate,
  formatBillingStatus,
  BILLING_STATUS_STYLES,
} from "@/lib/billing";

export interface ClientDetailDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtMvr(n: string | number | null | undefined): string {
  if (n == null) return "MVR 0.00";
  const v = typeof n === "string" ? Number(n) : n;
  return `MVR ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ClientDetailDialog({ client, open, onOpenChange }: ClientDetailDialogProps) {
  const [tab, setTab] = useState("candidates");
  const [candidates, setCandidates] = useState<Passport[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [billingDocs, setBillingDocs] = useState<BillingDocument[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [unlinkId, setUnlinkId] = useState<number | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<number | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const { toast } = useToast();

  const loadCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    try {
      const rows = await apiFetch<Passport[]>(`/passports?clientId=${client.id}`);
      setCandidates(rows);
    } catch (err) {
      toast({
        title: "Failed to load candidates",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setCandidatesLoading(false);
    }
  }, [client.id, toast]);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const [invoices, quotations] = await Promise.all([
        apiFetch<BillingDocument[]>("/billing/documents?kind=invoice"),
        apiFetch<BillingDocument[]>("/billing/documents?kind=quotation"),
      ]);
      const byId = new Map<number, BillingDocument>();
      for (const d of [...invoices, ...quotations]) {
        if (d.clientId === client.id) byId.set(d.id, d);
      }
      setBillingDocs(
        [...byId.values()].sort(
          (a, b) =>
            new Date((b as BillingDocument & { createdAt?: string }).createdAt ?? 0).getTime() -
            new Date((a as BillingDocument & { createdAt?: string }).createdAt ?? 0).getTime(),
        ),
      );
    } catch (err) {
      toast({
        title: "Failed to load billing documents",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  }, [client.id, toast]);

  useEffect(() => {
    if (open) {
      void loadCandidates();
      void loadBilling();
    }
  }, [open, loadCandidates, loadBilling]);

  const handleUnlink = async (id: number) => {
    setActionPending(true);
    try {
      await apiFetch(`/passports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ clientId: null }),
      });
      toast({ title: "Candidate removed from client" });
      setUnlinkId(null);
      await loadCandidates();
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Failed to remove",
        variant: "destructive",
      });
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteCandidate = async (id: number) => {
    setActionPending(true);
    try {
      await apiFetch(`/passports/${id}`, { method: "DELETE" });
      toast({ title: "Candidate deleted" });
      setDeleteCandidateId(null);
      await loadCandidates();
    } catch (err) {
      toast({
        title: err instanceof ApiError ? err.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setActionPending(false);
    }
  };

  const pendingUnlink = candidates.find((p) => p.id === unlinkId);
  const pendingDeleteCandidate = candidates.find((p) => p.id === deleteCandidateId);

  const docsInvoiceCount = useMemo(
    () => billingDocs.filter((d) => d.kind === "invoice").length,
    [billingDocs],
  );
  const docsQuoteCount = useMemo(
    () => billingDocs.filter((d) => d.kind === "quotation").length,
    [billingDocs],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building className="h-5 w-5 text-primary" />
              {client.name}
            </DialogTitle>
            <DialogDescription className="mt-1">
              {[client.contactPerson, client.email, client.phone].filter(Boolean).join(" · ") ||
                "No contact details on file"}
              {client.tin && (
                <span className="ml-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  TIN {client.tin}
                </span>
              )}
            </DialogDescription>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 pt-3 pb-0 flex-shrink-0 border-b">
              <TabsList className="h-9">
                <TabsTrigger value="candidates" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Candidates
                  <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {candidates.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  Invoices &amp; Quotes
                  <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                    {billingDocs.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="candidates"
              className="flex-1 overflow-y-auto m-0 focus-visible:outline-none"
            >
              <div className="p-4">
                {candidatesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No candidates allocated to this client.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Open a candidate record and set its Allocation field to this client.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Passport #</TableHead>
                        <TableHead className="hidden md:table-cell">Nationality</TableHead>
                        <TableHead className="hidden lg:table-cell">Work Permit #</TableHead>
                        <TableHead className="hidden sm:table-cell">Expiry</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium uppercase">
                            {p.fullName || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.passportNumber || "—"}
                          </TableCell>
                          <TableCell className="capitalize hidden md:table-cell">
                            {p.nationality || "—"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell font-mono text-xs">
                            {p.workPermitNumber || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {p.dateOfExpiry || "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/employees/${p.id}`} onClick={() => onOpenChange(false)}>
                                    <UserCircle className="mr-2 h-4 w-4" /> View employee profile
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setUnlinkId(p.id)}>
                                  <UserMinus className="mr-2 h-4 w-4" /> Remove from client
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteCandidateId(p.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete candidate
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent
              value="billing"
              className="flex-1 overflow-y-auto m-0 focus-visible:outline-none"
            >
              <div className="p-4 space-y-3">
                {billingLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : billingDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No invoices or quotations for this client yet.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1">
                      <span>
                        <span className="font-semibold text-foreground">{docsInvoiceCount}</span>{" "}
                        invoice{docsInvoiceCount !== 1 ? "s" : ""}
                      </span>
                      <span>·</span>
                      <span>
                        <span className="font-semibold text-foreground">{docsQuoteCount}</span>{" "}
                        quotation{docsQuoteCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {billingDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                              d.kind === "invoice"
                                ? "bg-gradient-to-br from-indigo-500 to-violet-500"
                                : "bg-gradient-to-br from-amber-500 to-orange-500"
                            }`}
                          >
                            {d.kind === "invoice" ? (
                              <Receipt className="h-4 w-4 text-white" />
                            ) : (
                              <FileText className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold">{d.number}</span>
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                                  BILLING_STATUS_STYLES[d.status] ?? BILLING_STATUS_STYLES.draft
                                }`}
                              >
                                {formatBillingStatus(d.status)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {fmtBillingDate(d.issueDate)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="font-mono font-semibold text-sm tabular-nums">
                            {fmtMvr(billingDocTotal(d))}
                          </span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link
                              href={billingPrintPath(d.id)}
                              title="View / Print"
                              onClick={() => onOpenChange(false)}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unlinkId != null} onOpenChange={(o) => !o && setUnlinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUnlink?.fullName || "This candidate"} will be unlinked from{" "}
              <strong>{client.name}</strong>. Their passport data is kept. You can re-allocate them
              at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkId != null && void handleUnlink(unlinkId)}
              disabled={actionPending}
            >
              {actionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteCandidateId != null}
        onOpenChange={(o) => !o && setDeleteCandidateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong>{pendingDeleteCandidate?.fullName || "this candidate"}</strong> and all their
              data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCandidateId != null && void handleDeleteCandidate(deleteCandidateId)}
              disabled={actionPending}
            >
              {actionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
