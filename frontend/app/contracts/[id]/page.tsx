"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, getContract } from "@/lib/api";
import type { Contract } from "@/lib/types";
import { Card } from "@/components/Card";
import { ContractFields } from "@/components/ContractFields";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState, Spinner } from "@/components/StateMessage";

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await getContract(params.id);
        if (!cancelled) {
          setContract(data);
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
  }, [params.id]);

  return (
    <>
      <Link
        href="/contracts"
        className="mb-4 inline-block text-sm text-muted transition-colors hover:text-ink"
      >
        &larr; All contracts
      </Link>

      <PageHeader
        title={`Contract #${params.id}`}
        subtitle={contract ? `Stored ${new Date(contract.created_at).toLocaleString()}` : undefined}
      />

      {isLoading ? <Spinner label="Loading contract..." /> : null}

      {error ? (
        <ErrorState
          title={error.status === 404 ? "Contract not found (404)" : "Could not load contract"}
        >
          <p>{error.message}</p>
        </ErrorState>
      ) : null}

      {contract ? (
        <Card>
          <ContractFields contract={contract} />
        </Card>
      ) : null}
    </>
  );
}
