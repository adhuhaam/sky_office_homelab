import { Feather } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "@/hooks/useTheme";

function parseIsoDate(iso: string): Date {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  }
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Select date";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? m} ${Number(d)}, ${y}`;
}

type DatePickerFieldProps = {
  value: string;
  onChange: (isoDate: string) => void;
};

export function DatePickerField({ value, onChange }: DatePickerFieldProps) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const date = parseIsoDate(value);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(toIsoDate(selected));
    if (Platform.OS === "ios") setShowPicker(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.input,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: theme.colors.foreground, fontFamily: theme.fonts.sans }]}>
          {formatDisplay(value)}
        </Text>
        <Feather name="calendar" size={16} color={theme.colors.mutedForeground} />
      </Pressable>

      {showPicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 36,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    fontSize: 16,
  },
});
