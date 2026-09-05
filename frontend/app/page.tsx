"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiError, extractContract } from "@/lib/api";
import type { Contract } from "@/lib/types";
import { Card } from "@/components/Card";
import { ContractFields } from "@/components/ContractFields";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState, Spinner } from "@/components/StateMessage";

const SAMPLE = `MEMORANDUM OF LEASE
This agreement is entered into this 12th day of May, 2024, by and between Apex Holdings LLC (hereafter the Landlord) and Vertex Tech Solutions Corp (hereafter the Tenant). The property located at Suite 404, Dubai Sports City, is leased for a term starting on June 1st, 2024, and ending exactly two years later on May 31st, 2026. The agreed monthly consideration is 12500.00 AED, payable on the first of each month. Either party may terminate this agreement early by providing at least 90 days written notice to the other party.`;

export default function ExtractPage() {
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Contract | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      setResult(await extractContract(rawText));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError("Something went wrong.", 0, "UNKNOWN"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Extract a lease"
        subtitle="Paste raw contract text. The backend calls the model, validates the result, and stores it."
      />

      <form onSubmit={handleSubmit}>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder="Paste the lease agreement text here..."
          rows={12}
          className="w-full resize-y rounded-lg border border-line bg-surface p-4 font-mono text-sm leading-relaxed placeholder:text-muted focus:border-accent focus:outline-none"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading || rawText.trim().length === 0}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Extracting..." : "Extract"}
          </button>
          <button
            type="button"
            onClick={() => setRawText(SAMPLE)}
            disabled={isLoading}
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            Load sample
          </button>
        </div>
      </form>

      <div className="mt-8">
        {isLoading ? <Spinner label="Calling the extraction pipeline..." /> : null}

        {error ? (
          <ErrorState title={errorTitle(error)}>
            <p>{error.message}</p>
            {error.fieldErrors.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {error.fieldErrors.map((fieldError, index) => (
                  <li key={index} className="font-mono text-xs">
                    {fieldError.field ? `${fieldError.field}: ` : ""}
                    {fieldError.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </ErrorState>
        ) : null}

        {result ? (
          <Card>
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-sm font-medium text-success">Extracted and stored</p>
              <Link
                href={`/contracts/${result.id}`}
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                Contract #{result.id} &rarr;
              </Link>
            </div>
            <ContractFields contract={result} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

function errorTitle(error: ApiError) {
  switch (error.code) {
    case "INVALID_CONTRACT":
    case "VALIDATION_ERROR":
      return "Record flagged INVALID (422)";
    case "LLM_UNAVAILABLE":
      return "Extraction provider unavailable (503)";
    case "LLM_INVALID_RESPONSE":
      return "Model returned an unusable response (502)";
    case "TIMEOUT":
      return "Request timed out";
    case "NETWORK_ERROR":
      return "Backend unreachable";
    default:
      return `Request failed (${error.status})`;
  }
}
