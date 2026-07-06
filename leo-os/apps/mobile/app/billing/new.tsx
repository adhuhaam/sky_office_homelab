import {
  type BillingDocumentInput,
  getListBillingDocumentsQueryKey,
  getListSalaryRecordsQueryKey,
  useCreateBillingDocument,
  useListSalaryRecords,
  useUpdateSalaryRecord,
  type SalaryRecord,
} from "@leo/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import BillingDocumentForm, {
  type BillingFormState,
} from "@/components/BillingDocumentForm";
import { useColors } from "@/hooks/useColors";
import { salaryRecordsToBillingInitial } from "@/lib/salary-invoice";

function parseSalaryIds(raw: string | string[] | undefined): number[] {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return [];
  return s
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export default function NewBillingDocumentScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const createMutation = useCreateBillingDocument();
  const updateSalaryMutation = useUpdateSalaryRecord();
  const { salaryIds: salaryIdsRaw } = useLocalSearchParams<{ salaryIds?: string }>();

  const salaryIds = useMemo(() => parseSalaryIds(salaryIdsRaw), [salaryIdsRaw]);

  const { data: salaryData, isLoading: salariesLoading } = useListSalaryRecords(
    salaryIds.length > 0 ? { status: "confirmed" } : undefined,
    {
      query: {
        queryKey: getListSalaryRecordsQueryKey({ status: "confirmed" }),
        enabled: salaryIds.length > 0,
      },
    },
  );

  const initialValues = useMemo(() => {
    if (salaryIds.length === 0) return undefined;
    const records = ((salaryData ?? []) as SalaryRecord[]).filter((r) => salaryIds.includes(r.id));
    return salaryRecordsToBillingInitial(records);
  }, [salaryData, salaryIds]);

  const handleSubmit = async (form: BillingFormState) => {
    const payload: BillingDocumentInput = {
      kind: form.kind,
      companyId: form.companyId!,
      ...(form.clientId != null && { clientId: form.clientId }),
      customerName: form.customerName.trim(),
      issueDate: form.issueDate.trim(),
      items: form.items.map((it) => ({
        description: it.description.trim(),
        detail: it.detail.trim() || undefined,
        qty: it.qty || "1",
        rate: it.rate || "0",
      })),
      ...(form.customerAddress.trim() && { customerAddress: form.customerAddress.trim() }),
      ...(form.customerTin.trim() && { customerTin: form.customerTin.trim() }),
      ...(form.dueDate.trim() && { dueDate: form.dueDate.trim() }),
      ...(form.terms.trim() && { terms: form.terms.trim() }),
      gstRate: form.gstRate || "0",
      gstInclusive: form.gstInclusive,
      ...(form.notes.trim() && { notes: form.notes.trim() }),
      status: form.status,
      ...(form.linkedSalaryIds?.length ? { linkedSalaryIds: form.linkedSalaryIds } : {}),
    };

    const result = await createMutation.mutateAsync({ data: payload });

    if (form.linkedSalaryIds?.length) {
      await Promise.all(
        form.linkedSalaryIds.map((sid) =>
          updateSalaryMutation.mutateAsync({ id: sid, data: { invoiceId: result.id } }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
    }

    await queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
    router.replace(`/billing/${result.id}` as never);
  };

  if (salaryIds.length > 0 && salariesLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "New Invoice" }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: salaryIds.length > 0 ? "New Invoice from Salary" : "New Document" }} />
      <BillingDocumentForm
        key={salaryIds.join(",") || "new"}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending}
        submitLabel="Create Document"
      />
    </>
  );
}
