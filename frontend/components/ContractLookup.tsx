"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ContractLookup() {
  const router = useRouter();
  const [contractId, setContractId] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = contractId.trim();
    if (trimmed.length > 0) {
      router.push(`/contracts/${trimmed}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={contractId}
        onChange={(event) => setContractId(event.target.value)}
        placeholder="Contract ID"
        aria-label="Contract ID"
        className="w-32 rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm placeholder:font-sans placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={contractId.trim().length === 0}
        className="rounded-md border border-line px-3 py-2 text-sm whitespace-nowrap transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Fetch by ID
      </button>
    </form>
  );
}
