import type { Contract } from "@/lib/types";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}`;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-line py-3 last:border-b-0 sm:flex sm:items-baseline sm:gap-4">
      <dt className="text-sm text-muted sm:w-52 sm:shrink-0">{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export function ContractFields({ contract }: { contract: Contract }) {
  return (
    <dl>
      <Field label="Lessor (Landlord)" value={contract.lessor} />
      <Field label="Lessee (Tenant)" value={contract.lessee} />
      <Field label="Commencement date" value={formatDate(contract.commencement_date)} mono />
      <Field label="Expiration date" value={formatDate(contract.expiration_date)} mono />
      <Field label="Monthly rent" value={formatMoney(contract.monthly_rent, contract.currency)} mono />
      <Field label="Currency" value={contract.currency} mono />
      <Field
        label="Termination notice"
        value={`${contract.termination_notice_days} days`}
        mono
      />
      <Field
        label="Contract duration"
        value={`${contract.contract_duration_days.toLocaleString()} days`}
        mono
      />
    </dl>
  );
}
