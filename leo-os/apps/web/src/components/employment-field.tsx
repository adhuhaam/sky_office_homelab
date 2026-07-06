import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EmploymentField({
  label,
  value,
  onChange,
  options,
  testId,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId: string;
  className?: string;
}) {
  const isCustom = value !== "" && !options.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  if (options.length === 0) {
    return (
      <div className={`space-y-1.5 ${className ?? ""}`}>
        <Label>{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          data-testid={`input-${testId}`}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Select
        value={showCustom ? "__custom__" : value || "__none__"}
        onValueChange={(v) => {
          if (v === "__none__") {
            setShowCustom(false);
            onChange("");
          } else if (v === "__custom__") {
            setShowCustom(true);
            onChange(value);
          } else {
            setShowCustom(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger data-testid={`select-${testId}`}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
          {isCustom && !showCustom && <SelectItem value={value}>{value}</SelectItem>}
          <SelectItem value="__custom__">— Custom… —</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter custom ${label.toLowerCase()}`}
          autoFocus
          data-testid={`input-${testId}-custom`}
        />
      )}
    </div>
  );
}
