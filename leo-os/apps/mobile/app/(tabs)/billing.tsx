import { Feather } from "@expo/vector-icons";
import type { BillingDocument, BillingDocumentSummary, Client, SalaryRecord } from "@leo/api-client-react";
import {
  getBillingDocument,
  getGetBillingDocumentQueryKey,
  getListBillingDocumentsQueryKey,
  getListClientsQueryKey,
  getListCompaniesQueryKey,
  getListSalaryRecordsQueryKey,
  useCreateBillingDocument,
  useDeleteBillingDocument,
  useGetBillingDocument,
  useListBillingDocuments,
  useListClients,
  useListCompanies,
  useListSalaryRecords,
  useUpdateBillingDocument,
} from "@leo/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { BillingPreviewSheet } from "@/components/BillingPreviewSheet";
import { PageHeader } from "@/components/PageHeader";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Field, Input } from "@/components/ui/Input";
import { KeyboardSheet } from "@/components/KeyboardAvoid";
import { useTheme } from "@/hooks/useTheme";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAuth } from "@/lib/auth";
import { getBillingPrintPageUrl } from "@/lib/billing-preview";
import { fmtMVR } from "@/lib/currency";
import { pageLayoutStyles } from "@/lib/page-layout-styles";
import { computeClientBillTotal, formatSalaryImportLabel, salaryRecordToSimpleLineItem } from "@/lib/salary-invoice";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DocKind = "invoice" | "quotation";

type LineItem = { description: string; qty: string; rate: string };

type CreateForm = {
  clientId: string;
  customerName: string;
  customerAddress: string;
  customerTin: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  items: LineItem[];
  linkedSalaryIds: number[];
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
  sent: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  payment_received: { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  completed: { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" },
  voided: { bg: "#ffe4e6", text: "#be123c", border: "#fecdd3" },
};

const STATUS_OPTIONS = ["draft", "sent", "payment_received", "completed", "voided"] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDocDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? m} ${Number(d)}, ${y}`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function docTotalAmount(doc: BillingDocument | BillingDocumentSummary): number {
  const fromItems = "items" in doc && doc.items ? doc.items.reduce((sum, item) => sum + Number(item.amount || 0), 0) : 0;
  const subtotal = Number(doc.subtotal ?? 0);
  return subtotal > 0 ? subtotal : fromItems;
}

function gstLabel(doc: { gstRate?: string | null; gstInclusive?: boolean | null }): string | null {
  const rate = Number(doc.gstRate ?? 0);
  if (rate <= 0) return null;
  return doc.gstInclusive ? `GST ${rate}% incl` : `GST ${rate}% excl`;
}

function DetailActionButton({
  label,
  icon,
  onPress,
  backgroundColor,
  textColor = "#ffffff",
}: {
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  backgroundColor: string;
  textColor?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailActionBtn,
        { backgroundColor, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Feather name={icon} size={17} color={textColor} />
      <Text style={[styles.detailActionBtnText, { color: textColor, fontFamily: theme.fonts.sansSemibold }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DetailActionFooter({
  isAdmin,
  onPreview,
  onEdit,
  onStatus,
  onDelete,
}: {
  isAdmin: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onStatus: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.detailFooter}>
      <View style={styles.detailFooterRow}>
        <DetailActionButton
          label="Preview"
          icon="eye"
          onPress={onPreview}
          backgroundColor={theme.colors.primary}
        />
        {isAdmin ? (
          <DetailActionButton label="Edit" icon="edit-2" onPress={onEdit} backgroundColor="#1d4ed8" />
        ) : null}
      </View>
      {isAdmin ? (
        <View style={styles.detailFooterRow}>
          <DetailActionButton label="Status" icon="flag" onPress={onStatus} backgroundColor="#d97706" />
          <DetailActionButton label="Delete" icon="trash-2" onPress={onDelete} backgroundColor="#be123c" />
        </View>
      ) : null}
    </View>
  );
}

function defaultForm(): CreateForm {
  return {
    clientId: "",
    customerName: "",
    customerAddress: "",
    customerTin: "",
    issueDate: todayIso(),
    dueDate: "",
    notes: "",
    items: [{ description: "", qty: "1", rate: "0" }],
    linkedSalaryIds: [],
  };
}

function formFromDoc(doc: BillingDocument): CreateForm {
  return {
    clientId: doc.clientId ? String(doc.clientId) : "",
    customerName: doc.customerName ?? "",
    customerAddress: doc.customerAddress ?? "",
    customerTin: doc.customerTin ?? "",
    issueDate: doc.issueDate ?? todayIso(),
    dueDate: doc.dueDate ?? "",
    notes: doc.notes ?? "",
    items:
      doc.items && doc.items.length > 0
        ? doc.items.map((item) => ({
            description: item.description,
            qty: item.qty ?? "1",
            rate: item.rate ?? "0",
          }))
        : [{ description: "", qty: "1", rate: "0" }],
    linkedSalaryIds: [],
  };
}

function SalaryImportModal({
  visible,
  clientId,
  clientName,
  linkedSalaryIds,
  onClose,
  onImport,
}: {
  visible: boolean;
  clientId: number | null;
  clientName?: string;
  linkedSalaryIds: number[];
  onClose: () => void;
  onImport: (items: LineItem[], salaryIds: number[]) => void;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const queryParams = useMemo(
    () =>
      clientId != null
        ? { status: "confirmed" as const, clientId, unlinked: true }
        : undefined,
    [clientId],
  );

  const { data: salaryRecordsRaw = [], isLoading } = useListSalaryRecords(queryParams, {
    query: {
      queryKey: getListSalaryRecordsQueryKey(queryParams),
      enabled: visible && clientId != null,
    },
  });

  const available = useMemo(() => {
    const linked = new Set(linkedSalaryIds);
    return (salaryRecordsRaw as SalaryRecord[]).filter(
      (r) => !r.invoiceId && !linked.has(r.id),
    );
  }, [salaryRecordsRaw, linkedSalaryIds]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    const chosen = available.filter((r) => selected.has(r.id));
    if (chosen.length === 0) return;
    onImport(
      chosen.map(salaryRecordToSimpleLineItem),
      chosen.map((r) => r.id),
    );
    setSelected(new Set());
    onClose();
  }

  const allSelected = available.length > 0 && selected.size === available.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setSelected(new Set());
        onClose();
      }}
    >
      <View style={[salaryModalStyles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[salaryModalStyles.nav, { borderColor: theme.colors.border }]}>
          <Text style={[salaryModalStyles.title, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
            Import salaries
          </Text>
          <Pressable
            onPress={() => {
              setSelected(new Set());
              onClose();
            }}
            hitSlop={12}
          >
            <Feather name="x" size={22} color={theme.colors.foreground} />
          </Pressable>
        </View>

        {clientId == null ? (
          <View style={salaryModalStyles.empty}>
            <Feather name="users" size={32} color={theme.colors.mutedForeground} />
            <Text style={[salaryModalStyles.emptyText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              Select a client on the invoice first, then import confirmed salary records for that client&apos;s employees.
            </Text>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : available.length === 0 ? (
          <View style={salaryModalStyles.empty}>
            <Feather name="dollar-sign" size={32} color={theme.colors.mutedForeground} />
            <Text style={[salaryModalStyles.emptyText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
              No confirmed, un-invoiced salary records for {clientName ?? "this client"}.
              {"\n"}Generate and confirm salaries first, or they may already be on an invoice.
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={() =>
                setSelected(allSelected ? new Set() : new Set(available.map((r) => r.id)))
              }
              style={[salaryModalStyles.selectAll, { borderBottomColor: theme.colors.border }]}
            >
              <View
                style={[
                  salaryModalStyles.checkbox,
                  {
                    borderColor: allSelected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: allSelected ? theme.colors.primary : "transparent",
                  },
                ]}
              >
                {allSelected ? <Feather name="check" size={12} color={theme.colors.primaryForeground} /> : null}
              </View>
              <Text style={{ color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium, flex: 1 }}>
                Select all ({available.length})
              </Text>
            </Pressable>
            <FlatList
              data={available}
              keyExtractor={(r) => String(r.id)}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              renderItem={({ item: r }) => {
                const checked = selected.has(r.id);
                return (
                  <Pressable
                    onPress={() => toggle(r.id)}
                    style={[
                      salaryModalStyles.row,
                      {
                        backgroundColor: checked ? theme.colors.primary + "18" : theme.colors.card,
                        borderColor: checked ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        salaryModalStyles.checkbox,
                        {
                          borderColor: checked ? theme.colors.primary : theme.colors.border,
                          backgroundColor: checked ? theme.colors.primary : "transparent",
                        },
                      ]}
                    >
                      {checked ? <Feather name="check" size={12} color={theme.colors.primaryForeground} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: theme.colors.foreground }} numberOfLines={1}>
                        {r.employeeName ?? "Unknown employee"}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.mutedForeground }} numberOfLines={1}>
                        {MONTHS_LONG[(r.month - 1) % 12]} {r.year}
                        {r.passportNumber ? ` · ${r.passportNumber}` : ""}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.colors.mutedForeground }} numberOfLines={1}>
                        {formatSalaryImportLabel(r)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#059669" }}>
                      MVR {computeClientBillTotal(r).toFixed(2)}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </>
        )}

        <View style={[salaryModalStyles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
          <Pressable
            onPress={apply}
            disabled={selected.size === 0}
            style={[
              salaryModalStyles.footerBtn,
              { backgroundColor: selected.size > 0 ? theme.colors.primary : theme.colors.muted },
            ]}
          >
            <Text
              style={{
                color: selected.size > 0 ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                fontFamily: theme.fonts.sansSemibold,
              }}
            >
              {selected.size > 0
                ? `Add ${selected.size} salary record${selected.size > 1 ? "s" : ""}`
                : "Select records above"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function KindChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.kindChip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.card,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.kindChipText,
          { color: active ? theme.colors.primaryForeground : theme.colors.foreground, fontFamily: theme.fonts.sansSemibold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.statusBadgeText, { color: colors.text }]}>{formatStatus(status).toUpperCase()}</Text>
    </View>
  );
}

function SummaryBanner({
  kind,
  count,
  total,
}: {
  kind: DocKind;
  count: number;
  total: number;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.summaryBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Text style={[styles.summaryLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansMedium }]}>
        {kind === "invoice" ? "Invoices" : "Quotations"}
      </Text>
      <Text style={[styles.summaryAmount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
        {fmtMVR(total)}
      </Text>
      <Text style={[styles.summaryMeta, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
        {count} document{count !== 1 ? "s" : ""}
      </Text>
    </View>
  );
}

function BillingRecordRow({
  doc,
  onPress,
}: {
  doc: BillingDocumentSummary;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.recordRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.recordTop}>
        <View style={styles.recordTitleBlock}>
          <Text style={[styles.recordNumber, { color: theme.colors.foreground, fontFamily: theme.fonts.mono }]}>
            {doc.number}
          </Text>
          <Text numberOfLines={1} style={[styles.recordCustomer, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
            {doc.customerName}
          </Text>
          <Text style={[styles.recordMeta, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
            {formatDocDate(doc.issueDate)}
            {doc.clientName ? ` · ${doc.clientName}` : ""}
          </Text>
        </View>
        <View style={styles.recordRight}>
          <Text style={[styles.recordAmount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
            {fmtMVR(Number(doc.subtotal ?? 0))}
          </Text>
          <StatusBadge status={doc.status} />
        </View>
      </View>
    </Pressable>
  );
}

function DetailSheet({
  visible,
  docId,
  isAdmin,
  onClose,
  onEdit,
  onPreview,
  onStatusChange,
  onDelete,
}: {
  visible: boolean;
  docId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const detailQuery = useGetBillingDocument(docId ?? 0, {
    query: {
      queryKey: getGetBillingDocumentQueryKey(docId ?? 0),
      enabled: visible && docId != null,
    },
  });

  const doc = detailQuery.data;

  function pickStatus() {
    if (!doc) return;
    Alert.alert(
      "Update status",
      doc.number,
      [
        ...STATUS_OPTIONS.map((status) => ({
          text: formatStatus(status),
          onPress: () => onStatusChange(status),
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert("Delete document?", doc?.number ?? "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  }

  return (
    <KeyboardSheet
      visible={visible}
      onClose={onClose}
      title={doc?.number ?? "Document"}
      footer={
        doc ? (
          <DetailActionFooter
            isAdmin={isAdmin}
            onPreview={onPreview}
            onEdit={onEdit}
            onStatus={pickStatus}
            onDelete={confirmDelete}
          />
        ) : null
      }
    >
      {detailQuery.isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={styles.detailLoader} />
      ) : !doc ? (
        <Text style={[styles.emptyText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
          Could not load document
        </Text>
      ) : (
        <>
          <View style={[styles.detailHero, { backgroundColor: theme.colors.primary + "12", borderColor: theme.colors.primary + "25" }]}>
            <View style={styles.detailHeroTop}>
              <View style={[styles.detailKindPill, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.detailKindPillText, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
                  {doc.kind === "quotation" ? "QUOTATION" : "INVOICE"}
                </Text>
              </View>
              <StatusBadge status={doc.status} />
            </View>
            <Text style={[styles.detailHeroAmount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
              {fmtMVR(docTotalAmount(doc))}
            </Text>
            {gstLabel(doc) ? (
              <Text style={[styles.detailHeroGst, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                {gstLabel(doc)}
              </Text>
            ) : null}
            <Text style={[styles.detailHeroCustomer, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
              {doc.customerName}
            </Text>
          </View>

          <View style={styles.detailMetaGrid}>
            <View style={[styles.detailMetaCell, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
              <Text style={[styles.detailMetaLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>Issued</Text>
              <Text style={[styles.detailMetaValue, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>
                {formatDocDate(doc.issueDate)}
              </Text>
            </View>
            <View style={[styles.detailMetaCell, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
              <Text style={[styles.detailMetaLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>Due</Text>
              <Text style={[styles.detailMetaValue, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>
                {formatDocDate(doc.dueDate)}
              </Text>
            </View>
          </View>

          <View style={[styles.detailBlock, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <DetailLine label="Client" value={doc.clientName} />
            <DetailLine label="Company" value={doc.companyName} />
            {doc.customerTin ? <DetailLine label="TIN" value={doc.customerTin} /> : null}
          </View>

          {doc.customerAddress ? (
            <View style={[styles.detailAddressCard, { backgroundColor: theme.colors.muted, borderColor: theme.colors.border }]}>
              <Text style={[styles.detailAddressLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sansSemibold }]}>
                Address
              </Text>
              <Text style={[styles.detailAddressText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
                {doc.customerAddress}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.itemsTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
            Line items
          </Text>
          <View style={[styles.itemsCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            {(doc.items ?? []).map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  index > 0 && { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={[styles.itemIndex, { backgroundColor: theme.colors.primary + "18" }]}>
                  <Text style={[styles.itemIndexText, { color: theme.colors.primary, fontFamily: theme.fonts.sansSemibold }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemDesc, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                    {Number(item.qty)} × {fmtMVR(Number(item.rate))}
                  </Text>
                </View>
                <Text style={[styles.itemAmount, { color: theme.colors.foreground, fontFamily: theme.fonts.sansBold }]}>
                  {fmtMVR(Number(item.amount))}
                </Text>
              </View>
            ))}
          </View>

          {doc.notes ? (
            <View style={[styles.detailNotesCard, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
              <Text style={[styles.detailNotesLabel, { color: "#92400e", fontFamily: theme.fonts.sansSemibold }]}>Notes</Text>
              <Text style={[styles.detailNotesText, { color: "#92400e", fontFamily: theme.fonts.sans }]}>{doc.notes}</Text>
            </View>
          ) : null}
        </>
      )}
    </KeyboardSheet>
  );
}

function DetailLine({ label, value }: { label: string; value?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }]}>
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

function BillingFormSheet({
  visible,
  kind,
  mode,
  clients,
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  kind: DocKind;
  mode: "create" | "edit";
  clients: Client[];
  form: CreateForm;
  saving: boolean;
  onChange: (next: CreateForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const [salaryImportOpen, setSalaryImportOpen] = useState(false);

  function pickClient() {
    Alert.alert("Client", undefined, [
      { text: "None", onPress: () => onChange({ ...form, clientId: "" }) },
      ...clients.map((c) => ({
        text: c.name,
        onPress: () =>
          onChange({
            ...form,
            clientId: String(c.id),
            customerName: c.name,
            customerAddress: c.address ?? form.customerAddress,
            customerTin: c.tin ?? form.customerTin,
          }),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    const items = form.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...form, items });
  }

  const selectedClient = clients.find((c) => String(c.id) === form.clientId);
  const clientIdNum = form.clientId ? Number(form.clientId) : null;

  function openSalaryImport() {
    if (!form.clientId) {
      Alert.alert("Select a client", "Choose a client before importing salary records.");
      return;
    }
    setSalaryImportOpen(true);
  }

  function importSalaries(items: LineItem[], salaryIds: number[]) {
    const existing = form.items.filter((i) => i.description.trim());
    onChange({
      ...form,
      items: [...existing, ...items],
      linkedSalaryIds: [...form.linkedSalaryIds, ...salaryIds],
    });
  }

  return (
    <>
    <KeyboardSheet
      visible={visible}
      onClose={onClose}
      title={mode === "edit" ? `Edit ${kind === "invoice" ? "invoice" : "quotation"}` : `New ${kind === "invoice" ? "invoice" : "quotation"}`}
      footer={
        <>
          <Button variant="outline" onPress={onClose} style={styles.footerBtn}>
            Cancel
          </Button>
          <Button onPress={onSave} disabled={saving} style={styles.footerBtn}>
            {saving ? "Saving…" : mode === "edit" ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      {clients.length > 0 ? (
        <Field label="Client">
          <Pressable onPress={pickClient} style={[styles.pickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
            <Text style={[styles.pickerText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
              {selectedClient?.name ?? "Select client (optional)"}
            </Text>
            <Feather name="chevron-down" size={16} color={theme.colors.mutedForeground} />
          </Pressable>
        </Field>
      ) : null}

      <Field label="Customer name">
        <Input value={form.customerName} onChangeText={(customerName) => onChange({ ...form, customerName })} placeholder="Required" />
      </Field>

      <Field label="Address">
        <Input
          value={form.customerAddress}
          onChangeText={(customerAddress) => onChange({ ...form, customerAddress })}
          placeholder="Optional"
          multiline
          style={styles.textArea}
        />
      </Field>

      <Field label="TIN">
        <Input value={form.customerTin} onChangeText={(customerTin) => onChange({ ...form, customerTin })} placeholder="Optional" />
      </Field>

      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Field label="Issue date">
            <DatePickerField value={form.issueDate} onChange={(issueDate) => onChange({ ...form, issueDate })} />
          </Field>
        </View>
        <View style={styles.dateField}>
          <Field label="Due date">
            <DatePickerField value={form.dueDate || todayIso()} onChange={(dueDate) => onChange({ ...form, dueDate })} />
          </Field>
        </View>
      </View>

      <View style={styles.itemsHeader}>
        <Text style={[styles.itemsTitle, { color: theme.colors.foreground, fontFamily: theme.fonts.sansSemibold }]}>
          Line items
        </Text>
        <View style={styles.itemsHeaderActions}>
          {kind === "invoice" ? (
            <Pressable
              onPress={openSalaryImport}
              style={[
                styles.addLineBtn,
                { borderColor: "#05966955", backgroundColor: "#05966912", opacity: form.clientId ? 1 : 0.55 },
              ]}
            >
              <Feather name="download" size={14} color="#059669" />
              <Text style={[styles.addLineText, { color: "#059669", fontFamily: theme.fonts.sansMedium }]}>
                Import salaries
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onChange({ ...form, items: [...form.items, { description: "", qty: "1", rate: "0" }] })}
            style={[styles.addLineBtn, { borderColor: theme.colors.border }]}
          >
            <Feather name="plus" size={14} color={theme.colors.primary} />
            <Text style={[styles.addLineText, { color: theme.colors.primary, fontFamily: theme.fonts.sansMedium }]}>Add</Text>
          </Pressable>
        </View>
      </View>

      {form.items.map((item, index) => (
        <View key={index} style={[styles.createItemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.muted }]}>
          <Field label="Description">
            <Input
              value={item.description}
              onChangeText={(description) => updateItem(index, { description })}
              placeholder="Service or product"
            />
          </Field>
          <View style={styles.qtyRateRow}>
            <View style={styles.qtyField}>
              <Field label="Qty">
                <Input value={item.qty} onChangeText={(qty) => updateItem(index, { qty })} keyboardType="decimal-pad" />
              </Field>
            </View>
            <View style={styles.qtyField}>
              <Field label="Rate (MVR)">
                <Input value={item.rate} onChangeText={(rate) => updateItem(index, { rate })} keyboardType="decimal-pad" />
              </Field>
            </View>
            {form.items.length > 1 ? (
              <Pressable onPress={() => onChange({ ...form, items: form.items.filter((_, i) => i !== index) })} style={styles.removeLineBtn}>
                <Feather name="trash-2" size={16} color="#be123c" />
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}

      <Field label="Notes">
        <Input
          value={form.notes}
          onChangeText={(notes) => onChange({ ...form, notes })}
          placeholder="Optional"
          multiline
          style={styles.textArea}
        />
      </Field>
    </KeyboardSheet>

    {kind === "invoice" ? (
      <SalaryImportModal
        visible={salaryImportOpen}
        clientId={clientIdNum}
        clientName={selectedClient?.name}
        linkedSalaryIds={form.linkedSalaryIds}
        onClose={() => setSalaryImportOpen(false)}
        onImport={importSalaries}
      />
    ) : null}
    </>
  );
}

export default function BillingScreen() {
  const theme = useTheme();
  const tabBarInset = useTabBarInset();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isAdmin = role === "admin" || role === "superuser";

  const [kind, setKind] = useState<DocKind>("invoice");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [form, setForm] = useState<CreateForm>(defaultForm);

  const listParams = useMemo(() => ({ kind }), [kind]);

  const docsQuery = useListBillingDocuments(listParams, {
    query: { queryKey: getListBillingDocumentsQueryKey(listParams), staleTime: 30_000 },
  });
  const clientsQuery = useListClients(undefined, {
    query: { queryKey: getListClientsQueryKey(), enabled: isAdmin, staleTime: 60_000 },
  });
  const companiesQuery = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey(), enabled: isAdmin, staleTime: 60_000 },
  });

  const docs = docsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const defaultCompanyId = companiesQuery.data?.[0]?.id;
  const loading = docsQuery.isLoading || (isAdmin && clientsQuery.isLoading);
  const refreshing = docsQuery.isRefetching;

  const total = useMemo(() => docs.reduce((sum, d) => sum + Number(d.subtotal ?? 0), 0), [docs]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.number.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        (d.clientName?.toLowerCase().includes(q) ?? false) ||
        d.status.toLowerCase().includes(q),
    );
  }, [docs, search]);

  const createMutation = useCreateBillingDocument({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey(listParams) });
        await queryClient.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
        setCreateOpen(false);
        setForm(defaultForm());
      },
      onError: (err) => {
        Alert.alert("Create failed", err.message);
      },
    },
  });

  const updateMutation = useUpdateBillingDocument({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey(listParams) });
        await queryClient.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
        if (detailId) {
          await queryClient.invalidateQueries({ queryKey: getGetBillingDocumentQueryKey(detailId) });
        }
        setEditOpen(false);
      },
      onError: (err) => {
        Alert.alert("Update failed", err.message);
      },
    },
  });

  const deleteMutation = useDeleteBillingDocument({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey(listParams) });
        setDetailOpen(false);
        setDetailId(null);
      },
      onError: (err) => {
        Alert.alert("Delete failed", err.message);
      },
    },
  });

  function openDetail(id: number) {
    setDetailId(id);
    setDetailOpen(true);
  }

  function openCreate() {
    setForm(defaultForm());
    setCreateOpen(true);
  }

  function saveCreate() {
    const name = form.customerName.trim();
    if (!name) {
      Alert.alert("Customer name is required");
      return;
    }
    const items = form.items.filter((i) => i.description.trim());
    if (items.length === 0) {
      Alert.alert("Add at least one line item");
      return;
    }
    if (!defaultCompanyId) {
      Alert.alert("No company configured", "Add a company in settings before creating billing documents.");
      return;
    }
    createMutation.mutate({
      data: {
        kind,
        companyId: defaultCompanyId,
        clientId: form.clientId ? Number(form.clientId) : null,
        customerName: name,
        customerAddress: form.customerAddress.trim() || undefined,
        customerTin: form.customerTin.trim() || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate || undefined,
        notes: form.notes.trim() || undefined,
        items: items.map((i) => ({
          description: i.description.trim(),
          qty: i.qty || "1",
          rate: i.rate || "0",
        })),
        ...(form.linkedSalaryIds.length ? { linkedSalaryIds: form.linkedSalaryIds } : {}),
      },
    });
  }

  function saveEdit() {
    if (!detailId) return;
    const name = form.customerName.trim();
    if (!name) {
      Alert.alert("Customer name is required");
      return;
    }
    const items = form.items.filter((i) => i.description.trim());
    if (items.length === 0) {
      Alert.alert("Add at least one line item");
      return;
    }
    updateMutation.mutate({
      id: detailId,
      data: {
        clientId: form.clientId ? Number(form.clientId) : null,
        customerName: name,
        customerAddress: form.customerAddress.trim() || null,
        customerTin: form.customerTin.trim() || null,
        issueDate: form.issueDate,
        dueDate: form.dueDate || null,
        notes: form.notes.trim() || null,
        items: items.map((i) => ({
          description: i.description.trim(),
          qty: i.qty || "1",
          rate: i.rate || "0",
        })),
        ...(form.linkedSalaryIds.length ? { linkedSalaryIds: form.linkedSalaryIds } : {}),
      },
    });
  }

  function openEditFromDetail() {
    if (!detailId) return;
    setDetailOpen(false);
    getBillingDocument(detailId)
      .then((full) => {
        setForm(formFromDoc(full));
        setEditOpen(true);
      })
      .catch(() => {
        Alert.alert("Could not load document for editing");
      });
  }

  function openPreviewFromDetail() {
    if (!detailId) return;
    const doc = docs.find((d) => d.id === detailId);
    const number = doc?.number ?? "Document";
    setDetailOpen(false);

    const previewUrl = getBillingPrintPageUrl(detailId);
    if (!previewUrl) {
      setPreviewTitle(number);
      setPreviewOpen(true);
      return;
    }

    const printUrl = getBillingPrintPageUrl(detailId, { print: true });

    Alert.alert("Open preview", number, [
      {
        text: "In-app browser",
        onPress: () => {
          void WebBrowser.openBrowserAsync(previewUrl);
        },
      },
      {
        text: "External browser",
        onPress: () => {
          void Linking.openURL(previewUrl);
        },
      },
      ...(printUrl
        ? [
            {
              text: "Print",
              onPress: () => {
                void WebBrowser.openBrowserAsync(printUrl);
              },
            },
          ]
        : []),
      {
        text: "Quick preview",
        onPress: () => {
          setPreviewTitle(number);
          setPreviewOpen(true);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const listHeader = (
    <View style={pageLayoutStyles.headerBlock}>
      <PageHeader
        brandIcon="file-text"
        brandLabel="BILLING"
        title="Invoices & quotes"
        subtitle={isAdmin ? "Create and manage billing documents" : "View your billing documents"}
        action={
          isAdmin ? (
            <Button onPress={openCreate} style={pageLayoutStyles.addBtn}>
              <Feather name="plus" size={16} color={theme.colors.primaryForeground} />
            </Button>
          ) : undefined
        }
      />

      <View style={styles.kindRow}>
        <KindChip label="Invoices" active={kind === "invoice"} onPress={() => setKind("invoice")} />
        <KindChip label="Quotations" active={kind === "quotation"} onPress={() => setKind("quotation")} />
      </View>

      <SummaryBanner kind={kind} count={docs.length} total={total} />

      <View style={[pageLayoutStyles.searchBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <Feather name="search" size={16} color={theme.colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search number, customer, client…"
          placeholderTextColor={theme.colors.mutedForeground}
          style={[pageLayoutStyles.searchInput, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[pageLayoutStyles.safe, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      {loading && docs.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[pageLayoutStyles.list, { paddingBottom: tabBarInset, gap: 10 }]}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => docsQuery.refetch()} tintColor={theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={[pageLayoutStyles.tableEmpty, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
              <Feather name="file-text" size={24} color={theme.colors.mutedForeground} />
              <Text style={[pageLayoutStyles.emptyText, { color: theme.colors.mutedForeground, fontFamily: theme.fonts.sans }]}>
                No {kind === "invoice" ? "invoices" : "quotations"} yet
              </Text>
            </View>
          }
          renderItem={({ item }) => <BillingRecordRow doc={item} onPress={() => openDetail(item.id)} />}
        />
      )}

      <DetailSheet
        visible={detailOpen}
        docId={detailId}
        isAdmin={isAdmin}
        onClose={() => setDetailOpen(false)}
        onEdit={openEditFromDetail}
        onPreview={openPreviewFromDetail}
        onStatusChange={(status) => {
          if (!detailId) return;
          updateMutation.mutate({ id: detailId, data: { status } });
        }}
        onDelete={() => {
          if (!detailId) return;
          deleteMutation.mutate({ id: detailId });
        }}
      />

      <BillingPreviewSheet
        visible={previewOpen}
        documentId={detailId}
        title={previewTitle}
        onClose={() => setPreviewOpen(false)}
      />

      {isAdmin ? (
        <>
          <BillingFormSheet
            visible={createOpen}
            kind={kind}
            mode="create"
            clients={clients}
            form={form}
            saving={createMutation.isPending}
            onChange={setForm}
            onClose={() => setCreateOpen(false)}
            onSave={saveCreate}
          />
          <BillingFormSheet
            visible={editOpen}
            kind={kind}
            mode="edit"
            clients={clients}
            form={form}
            saving={updateMutation.isPending}
            onChange={setForm}
            onClose={() => setEditOpen(false)}
            onSave={saveEdit}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  kindRow: { flexDirection: "row", gap: 8 },
  kindChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
  },
  kindChipText: { fontSize: 13 },
  summaryBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  summaryLabel: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.35 },
  summaryAmount: { fontSize: 26, letterSpacing: -0.4 },
  summaryMeta: { fontSize: 12 },
  recordRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recordTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  recordTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  recordNumber: { fontSize: 12 },
  recordCustomer: { fontSize: 15 },
  recordMeta: { fontSize: 12 },
  recordRight: { alignItems: "flex-end", gap: 8 },
  recordAmount: { fontSize: 15 },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 8, fontWeight: "700", letterSpacing: 0.25 },
  footerBtn: { flex: 1 },
  detailFooter: { width: "100%", gap: 10 },
  detailFooterRow: { flexDirection: "row", gap: 10 },
  detailActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  detailActionBtnText: { fontSize: 14 },
  detailLoader: { paddingVertical: 24 },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 16 },
  detailHero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 4,
  },
  detailHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  detailKindPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailKindPillText: { fontSize: 10, letterSpacing: 0.4 },
  detailHeroAmount: { fontSize: 30, letterSpacing: -0.5, marginTop: 4 },
  detailHeroGst: { fontSize: 12 },
  detailHeroCustomer: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  detailMetaGrid: {
    flexDirection: "row",
    gap: 10,
  },
  detailMetaCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  detailMetaLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.35 },
  detailMetaValue: { fontSize: 14 },
  detailBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  detailAddressCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  detailAddressLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.35 },
  detailAddressText: { fontSize: 13, lineHeight: 18 },
  detailNotesCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  detailNotesLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.35 },
  detailNotesText: { fontSize: 13, lineHeight: 18 },
  detailLine: { flexDirection: "row", gap: 10 },
  detailLabel: { width: 72, fontSize: 12 },
  detailValue: { flex: 1, fontSize: 13 },
  itemsTitle: { fontSize: 14, marginBottom: 8 },
  itemsCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 12 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIndexText: { fontSize: 12 },
  itemCopy: { flex: 1, gap: 2 },
  itemDesc: { fontSize: 14 },
  itemMeta: { fontSize: 12 },
  itemAmount: { fontSize: 13 },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  pickerText: { fontSize: 14, flex: 1 },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1 },
  itemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemsHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  addLineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addLineText: { fontSize: 12 },
  createItemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  qtyRateRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  qtyField: { flex: 1 },
  removeLineBtn: { padding: 10, marginBottom: 4 },
});

const salaryModalStyles = StyleSheet.create({
  container: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  selectAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  footerBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
});
