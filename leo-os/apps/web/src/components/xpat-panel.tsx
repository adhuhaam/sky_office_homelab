import { ExternalLink, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildXpatCardSrc,
  buildXpatPhotoSrc,
  formatXpatDate,
  isWpInvalid,
  isWpValid,
  type XpatWorkPermit,
} from "@/lib/xpat";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}

export function WpStatusBadge({ xpat }: { xpat: XpatWorkPermit }) {
  if (isWpValid(xpat.isValid)) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 gap-1">
        <ShieldCheck className="h-3 w-3" />
        {xpat.workPermitStateName ?? "Valid"}
      </Badge>
    );
  }
  if (isWpInvalid(xpat.isValid)) {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldX className="h-3 w-3" />
        {xpat.workPermitStateName ?? "Invalid"}
      </Badge>
    );
  }
  return <Badge variant="secondary">{xpat.workPermitStateName ?? "Unknown"}</Badge>;
}

export function XpatPhoto({
  xpat,
  name,
  size = "md",
}: {
  xpat?: XpatWorkPermit | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const sizeCls =
    size === "sm" ? "h-9 w-9 text-[10px]" : size === "lg" ? "h-20 w-20 text-lg" : "h-12 w-12 text-sm";
  const photoSrc = buildXpatPhotoSrc(xpat?.photoUrl);

  if (!photoSrc) {
    return (
      <div
        className={`${sizeCls} rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`${sizeCls} relative shrink-0`}>
      <img
        src={photoSrc}
        alt={name ?? "Employee"}
        className={`${sizeCls} rounded-full object-cover border`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          (target.nextElementSibling as HTMLElement | null)?.classList.remove("hidden");
        }}
      />
      <div
        className={`${sizeCls} hidden absolute inset-0 rounded-full bg-muted items-center justify-center font-semibold text-muted-foreground`}
      >
        {initials}
      </div>
    </div>
  );
}

export function XpatLoadingSkeleton({ fields = 9 }: { fields?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export function XpatInfoPanel({
  xpat,
  workPermitNumber,
  passportNumber,
  showCard = true,
}: {
  xpat: XpatWorkPermit;
  workPermitNumber: string;
  passportNumber: string;
  showCard?: boolean;
}) {
  const cardSrc = buildXpatCardSrc(workPermitNumber, passportNumber);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <XpatPhoto xpat={xpat} name={xpat.fullName} size="lg" />
        <div className="space-y-2">
          <p className="font-semibold text-lg">{xpat.fullName ?? "—"}</p>
          <div className="flex flex-wrap items-center gap-2">
            <WpStatusBadge xpat={xpat} />
            {xpat.workPermitExpiry && (
              <span className="text-xs text-muted-foreground">
                Expires: {formatXpatDate(xpat.workPermitExpiry)}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {xpat.occupationName ?? "—"} · {xpat.employerName ?? "—"}
          </p>
          {xpat.verifyUrl && (
            <a
              href={xpat.verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Verify on eGov Xpat MV
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="First name" value={xpat.firstName} />
        <Field label="Middle name" value={xpat.middleName} />
        <Field label="Last name" value={xpat.lastName} />
        <Field label="Gender" value={xpat.gender} />
        <Field label="Date of birth" value={formatXpatDate(xpat.dateOfBirth)} />
        <Field label="Nationality" value={xpat.nationality} />
        <Field label="ISO code" value={xpat.isoAlpha3CountryCode} />
        <Field label="Contact" value={xpat.contactNumber} />
        <Field label="Occupation" value={xpat.occupationName} />
        <Field label="WP status" value={xpat.workPermitStateName} />
        <Field label="WP issued" value={formatXpatDate(xpat.workPermitIssuedDate)} />
        <Field label="WP expiry" value={formatXpatDate(xpat.workPermitExpiry)} />
        <Field label="Employer" value={xpat.employerName} />
        <Field label="Employer #" value={xpat.employerNumber} />
        <Field label="Employer contact" value={xpat.employerContactNumber} />
      </div>

      {showCard && cardSrc && (
        <div>
          <p className="text-sm font-semibold mb-2">Work permit card</p>
          <img
            src={cardSrc}
            alt="Work permit card"
            className="max-w-sm rounded-lg border shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
    </div>
  );
}
