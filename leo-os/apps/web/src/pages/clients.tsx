import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Eye,
} from "lucide-react";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { ClientDetailDialog } from "@/components/client-detail-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
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
import { apiFetch, type Client, ApiError } from "@/lib/api";

interface ClientFormState {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  tin: string;
  notes: string;
}

const EMPTY_FORM: ClientFormState = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  tin: "",
  notes: "",
};

function clientToForm(c: Client): ClientFormState {
  return {
    name: c.name,
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    tin: c.tin ?? "",
    notes: c.notes ?? "",
  };
}

export function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await apiFetch<Client[]>("/clients");
      setClients(rows);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load clients";
      setLoadError(message);
      toast({
        title: "Failed to load clients",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building className="h-6 w-6 text-primary" />
            Clients
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Companies and sites where candidates get placed. Use the &ldquo;Allocation&rdquo; field
            on a candidate to link them here.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add client
        </Button>
      </div>

      {loadError && (
        <LoadErrorBanner message={loadError} onRetry={() => void load()} retrying={loading} />
      )}

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact, email, phone..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              <strong className="text-foreground">{filtered.length}</strong> of{" "}
              <strong className="text-foreground">{clients.length}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Contact Person</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Phone</TableHead>
                  <TableHead className="hidden xl:table-cell">TIN</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-5 w-24 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {clients.length === 0
                        ? "No clients yet — click Add client to create your first one."
                        : "No clients match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {c.contactPerson || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground font-mono">
                        {c.tin || <span className="font-sans">—</span>}
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
                            <DropdownMenuItem onClick={() => setViewClient(c)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditClient(c)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteClient(c)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewClient && (
        <ClientDetailDialog
          client={viewClient}
          open={!!viewClient}
          onOpenChange={(o) => !o && setViewClient(null)}
        />
      )}

      <ClientFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      {editClient && (
        <ClientFormDialog
          mode="edit"
          client={editClient}
          open={!!editClient}
          onOpenChange={(o) => !o && setEditClient(null)}
          onSaved={load}
        />
      )}
      {deleteClient && (
        <DeleteClientDialog
          client={deleteClient}
          open={!!deleteClient}
          onOpenChange={(o) => !o && setDeleteClient(null)}
          onDeleted={load}
        />
      )}
    </div>
  );
}

function ClientFormDialog(
  props:
    | {
        mode: "create";
        open: boolean;
        onOpenChange: (o: boolean) => void;
        onSaved: () => Promise<void>;
      }
    | {
        mode: "edit";
        client: Client;
        open: boolean;
        onOpenChange: (o: boolean) => void;
        onSaved: () => Promise<void>;
      },
) {
  const { mode, open, onOpenChange, onSaved } = props;
  const { toast } = useToast();
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit") {
      setForm(clientToForm(props.client));
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, mode, mode === "edit" ? props.client.id : 0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const body: Record<string, string> = { name };
        (["contactPerson", "phone", "email", "address", "tin", "notes"] as const).forEach((k) => {
          const v = form[k].trim();
          if (v) body[k] = v;
        });
        await apiFetch("/clients", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Client added" });
      } else {
        const body: Record<string, string | null> = { name };
        (["contactPerson", "phone", "email", "address", "tin", "notes"] as const).forEach((k) => {
          const v = form[k].trim();
          body[k] = v === "" ? null : v;
        });
        await apiFetch(`/clients/${props.client.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast({ title: "Client updated" });
      }
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast({
        title: mode === "create" ? "Failed to add client" : "Failed to update",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add client" : "Edit client"}</DialogTitle>
          <DialogDescription>
            Clients are the companies, sites, or sponsors a candidate is allocated to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact person</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm((s) => ({ ...s, contactPerson: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>TIN (Tax Identification Number)</Label>
              <Input
                placeholder="e.g. 1009905GST001"
                value={form.tin}
                onChange={(e) => setForm((s) => ({ ...s, tin: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add client" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientDialog({
  client,
  open,
  onOpenChange,
  onDeleted,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function onConfirm() {
    setDeleting(true);
    try {
      await apiFetch(`/clients/${client.id}`, { method: "DELETE" });
      toast({ title: `${client.name} deleted` });
      onOpenChange(false);
      await onDeleted();
    } catch (err) {
      toast({
        title: "Failed to delete",
        description: err instanceof ApiError ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{client.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Any candidate currently allocated to this client will be unlinked (their other details
            are kept). This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
