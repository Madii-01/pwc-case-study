"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, listContracts } from "@/lib/api";
import type { Contract } from "@/lib/types";
import { ContractLookup } from "@/components/ContractLookup";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, Spinner } from "@/components/StateMessage";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await listContracts();
        if (!cancelled) {
          setContracts(data);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ApiError ? caught : new ApiError("Failed to load.", 0, "UNKNOWN"),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retry() {
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Processed contracts"
          subtitle="Every lease that passed extraction and validation."
          className=""
        />
        <ContractLookup />
      </div>

      {isLoading ? <Spinner label="Loading contracts..." /> : null}

      {error ? (
        <ErrorState title="Could not load contracts">
          <p>{error.message}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 rounded-md border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:border-muted"
          >
            Retry
          </button>
        </ErrorState>
      ) : null}

      {!isLoading && !error && contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description="Extract a lease from the Extract page and it will appear here."
        />
      ) : null}

      {!isLoading && !error && contracts.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Lessor</th>
                <th className="px-4 py-3 font-medium">Lessee</th>
                <th className="px-4 py-3 font-medium">Commencement</th>
                <th className="px-4 py-3 font-medium">Expiration</th>
                <th className="px-4 py-3 text-right font-medium">Monthly rent</th>
                <th className="px-4 py-3 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id} className="border-b border-line last:border-b-0 hover:bg-surface">
                  <td className="px-4 py-3 font-mono text-muted">
                    <Link href={`/contracts/${contract.id}`} className="hover:text-accent">
                      #{contract.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${contract.id}`} className="hover:text-accent">
                      {contract.lessor}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{contract.lessee}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-muted">{contract.commencement_date}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-muted">{contract.expiration_date}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                    {contract.monthly_rent.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                    <span className="text-muted">{contract.currency}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-muted">
                    {contract.contract_duration_days.toLocaleString()} d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
