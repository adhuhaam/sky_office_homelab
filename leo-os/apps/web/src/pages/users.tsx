import { useCallback, useEffect, useRef, useState } from "react";
import {
  UserCog,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  Loader2,
  Shield,
  Ban,
  ShieldOff,
  Pencil,
  Check,
  X,
  UserPlus,
} from "lucide-react";
import { DataTableCard } from "@/components/data-table-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, type AdminUser, type Company, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ROLES = ["superuser", "admin", "client", "company", "employee", "agent"] as const;
type Role = (typeof ROLES)[number];

const ROLE_VARIANT: Record<Role, string> = {
  superuser: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
  client: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300",
  company: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300",
  employee: "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/40 dark:text-lime-300",
  agent: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
};

type AddForm = {
  email: string;
  name: string;
  role: Role;
  password: string;
  linkedEntityId: string;
  isApproved: boolean;
};

const ADD_DEFAULTS: AddForm = {
  email: "",
  name: "",
  role: "agent",
  password: "",
  linkedEntityId: "",
  isApproved: true,
};

type EditForm = {
  email: string;
  name: string;
  role: Role;
  linkedEntityId: string;
  phone: string;
  designation: string;
  companyId: string;
  isApproved: boolean;
  isBlocked: boolean;
  newPassword: string;
};

export function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const myRole = me?.role ?? null;
  const myId = me?.userId ?? null;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);

  const [editingLinked, setEditingLinked] = useState<number | null>(null);
  const [linkedValue, setLinkedValue] = useState("");
  const linkedInputRef = useRef<HTMLInputElement>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(ADD_DEFAULTS);
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    email: "",
    name: "",
    role: "agent",
    linkedEntityId: "",
    phone: "",
    designation: "",
    companyId: "",
    isApproved: true,
    isBlocked: false,
    newPassword: "",
  });
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const allowedRoles =
    myRole === "superuser" ? ROLES : ROLES.filter((r) => r !== "superuser");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [userRows, companyRows] = await Promise.all([
        apiFetch<AdminUser[]>("/admin/users"),
        apiFetch<Company[]>("/companies"),
      ]);
      setUsers(userRows);
      setCompanies(companyRows);
    } catch (err) {
      toast({
        title: "Failed to load users",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function mutate(id: number, patch: Record<string, unknown>) {
    setBusy(id);
    try {
      await apiFetch(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadUsers();
      toast({ title: "User updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser(id: number) {
    setBusy(id);
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
      await loadUsers();
      toast({ title: "User deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
      setPendingDelete(null);
    }
  }

  function startEditLinked(id: number, current: string | null | undefined) {
    setEditingLinked(id);
    setLinkedValue(current ?? "");
    setTimeout(() => linkedInputRef.current?.focus(), 0);
  }

  async function saveLinked(id: number) {
    await mutate(id, { linkedEntityId: linkedValue.trim() || null });
    setEditingLinked(null);
  }

  function openAdd() {
    setAddForm(ADD_DEFAULTS);
    setAddError("");
    setShowAdd(true);
  }

  async function submitAdd() {
    if (!addForm.email.trim() || !addForm.name.trim() || !addForm.password) {
      setAddError("Email, name and password are required.");
      return;
    }
    if (addForm.password.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }
    setAddBusy(true);
    setAddError("");
    try {
      await apiFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          role: addForm.role,
          password: addForm.password,
          isApproved: addForm.isApproved,
          linkedEntityId: addForm.linkedEntityId.trim() || null,
        }),
      });
      await loadUsers();
      setShowAdd(false);
      toast({ title: "User created", description: addForm.email.trim() });
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setAddBusy(false);
    }
  }

  function openEdit(u: AdminUser) {
    setEditTarget(u);
    setEditForm({
      email: u.email ?? "",
      name: u.name ?? "",
      role: (u.role as Role) ?? "agent",
      linkedEntityId: u.linkedEntityId ?? "",
      phone: u.phone ?? "",
      designation: u.designation ?? "",
      companyId: u.companyId != null ? String(u.companyId) : "",
      isApproved: u.isApproved,
      isBlocked: u.isBlocked ?? false,
      newPassword: "",
    });
    setEditError("");
  }

  async function submitEdit() {
    if (!editTarget) return;
    if (!editForm.email.trim() || !editForm.name.trim()) {
      setEditError("Email and name are required.");
      return;
    }
    if (editForm.newPassword && editForm.newPassword.length < 6) {
      setEditError("Password must be at least 6 characters.");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      await apiFetch(`/admin/users/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          email: editForm.email.trim(),
          name: editForm.name.trim(),
          role: editForm.role,
          linkedEntityId: editForm.linkedEntityId.trim() || null,
          phone: editForm.phone.trim() || null,
          designation: editForm.designation.trim() || null,
          companyId: editForm.companyId ? Number(editForm.companyId) : null,
          isApproved: editForm.isApproved,
          isBlocked: editForm.isBlocked,
          newPassword: editForm.newPassword || null,
        }),
      });
      await loadUsers();
      setEditTarget(null);
      toast({ title: "User updated" });
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to update user");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground">
              Create, approve, block, and manage roles
            </p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add User
        </Button>
      </div>

      <DataTableCard loading={loading} empty={!loading && users.length === 0} emptyMessage="No users yet">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4 py-3 uppercase text-[11px] tracking-wider">User</TableHead>
              <TableHead className="px-4 py-3 uppercase text-[11px] tracking-wider">Role</TableHead>
              <TableHead className="px-4 py-3 uppercase text-[11px] tracking-wider">Status</TableHead>
              <TableHead className="px-4 py-3 uppercase text-[11px] tracking-wider">Entity ID</TableHead>
              <TableHead className="px-4 py-3 text-right uppercase text-[11px] tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
                const isMe = u.id === myId;
                const isBusy = busy === u.id;
                const isBlocked = u.isBlocked ?? false;
                const isLockedForAdmin = u.role === "superuser" && myRole !== "superuser";

                return (
                  <TableRow key={u.id}>
                    <TableCell className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {!u.hasPassword && (
                        <div className="text-[10px] text-amber-600 mt-0.5">No password set</div>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={isMe || isBusy || isLockedForAdmin}>
                          <button
                            type="button"
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                              ROLE_VARIANT[u.role as Role] ?? "bg-secondary text-secondary-foreground border-secondary"
                            } ${isMe || isLockedForAdmin ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 transition-opacity"}`}
                          >
                            {u.role}
                            {!isMe && !isLockedForAdmin && <ChevronDown className="h-3 w-3 opacity-60" />}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {allowedRoles.map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => mutate(u.id, { role: r })}
                              className={r === u.role ? "font-semibold capitalize" : "capitalize"}
                            >
                              {r === u.role ? "✓ " : ""}
                              {r}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                          <Ban className="h-3.5 w-3.5" /> Blocked
                        </span>
                      ) : u.isApproved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <XCircle className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3 max-w-[160px]">
                      {editingLinked === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            ref={linkedInputRef}
                            value={linkedValue}
                            onChange={(e) => setLinkedValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveLinked(u.id);
                              if (e.key === "Escape") setEditingLinked(null);
                            }}
                            className="h-7 w-28 text-xs border border-border rounded px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="entity id"
                          />
                          <button type="button" onClick={() => saveLinked(u.id)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-emerald-50 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditingLinked(null)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {u.linkedEntityId || <span className="opacity-40">—</span>}
                          </span>
                          {!isMe && !isLockedForAdmin && (
                            <button
                              type="button"
                              onClick={() => startEditLinked(u.id, u.linkedEntityId)}
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : isLockedForAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-60">
                            <Shield className="h-3 w-3" /> Superuser only
                          </span>
                        ) : (
                          <>
                            {!isMe && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(u)}>
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            {!u.isApproved && !isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => mutate(u.id, { isApproved: true })}
                              >
                                Approve
                              </Button>
                            )}
                            {u.isApproved && !isBlocked && !isMe && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => mutate(u.id, { isApproved: false })}
                              >
                                Revoke
                              </Button>
                            )}
                            {!isMe && !isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                                onClick={() => mutate(u.id, { isBlocked: true })}
                              >
                                <Ban className="h-3 w-3 mr-1" />
                                Block
                              </Button>
                            )}
                            {!isMe && isBlocked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => mutate(u.id, { isBlocked: false })}
                              >
                                <ShieldOff className="h-3 w-3 mr-1" />
                                Unblock
                              </Button>
                            )}
                            {!isMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => setPendingDelete({ id: u.id, name: u.name || u.email })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </DataTableCard>

      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) setShowAdd(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-email">Email</Label>
                <Input id="add-email" type="email" placeholder="user@example.com" value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-name">Full Name</Label>
                <Input id="add-name" placeholder="John Doe" value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-role">Role</Label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as Role }))}>
                  <SelectTrigger id="add-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-linked">Entity ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="add-linked" placeholder="company / client / passport id" value={addForm.linkedEntityId}
                  onChange={(e) => setAddForm((f) => ({ ...f, linkedEntityId: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-password">Password</Label>
                <Input id="add-password" type="password" placeholder="Min 6 characters" value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox
                  id="add-approved"
                  checked={addForm.isApproved}
                  onCheckedChange={(checked) => setAddForm((f) => ({ ...f, isApproved: checked === true }))}
                />
                <Label htmlFor="add-approved" className="cursor-pointer font-normal">
                  Approve account immediately
                </Label>
              </div>
            </div>
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={addBusy}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addBusy}>
              {addBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  disabled={editTarget?.role === "superuser" && myRole !== "superuser"}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as Role }))}
                  disabled={editTarget?.role === "superuser" && myRole !== "superuser"}
                >
                  <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-company">Company</Label>
                <Select
                  value={editForm.companyId || "none"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, companyId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="edit-company"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-designation">Designation</Label>
                <Input
                  id="edit-designation"
                  value={editForm.designation}
                  onChange={(e) => setEditForm((f) => ({ ...f, designation: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-linked">Linked entity ID</Label>
                <Input
                  id="edit-linked"
                  placeholder="company / client / passport id"
                  value={editForm.linkedEntityId}
                  onChange={(e) => setEditForm((f) => ({ ...f, linkedEntityId: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-password">
                  New password{" "}
                  <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                />
              </div>
              <div className="col-span-2 flex flex-wrap gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-approved"
                    checked={editForm.isApproved}
                    disabled={editTarget?.id === myId}
                    onCheckedChange={(checked) =>
                      setEditForm((f) => ({ ...f, isApproved: checked === true }))
                    }
                  />
                  <Label htmlFor="edit-approved" className="cursor-pointer font-normal">
                    Approved
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-blocked"
                    checked={editForm.isBlocked}
                    disabled={editTarget?.id === myId}
                    onCheckedChange={(checked) =>
                      setEditForm((f) => ({ ...f, isBlocked: checked === true }))
                    }
                  />
                  <Label htmlFor="edit-blocked" className="cursor-pointer font-normal">
                    Blocked
                  </Label>
                </div>
              </div>
            </div>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editBusy}>Cancel</Button>
            <Button onClick={submitEdit} disabled={editBusy}>
              {editBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {pendingDelete?.name}&apos;s account and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteUser(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
