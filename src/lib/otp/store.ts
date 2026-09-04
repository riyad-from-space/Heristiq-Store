import "server-only";
import { erpEnv } from "@/lib/env";
import { erpDb } from "@/lib/erp/supabase";
import { devStore } from "@/lib/dev-store";
import type { OtpChannel } from "@/lib/otp/sender";

/*
 * Where issued codes are kept.
 *
 * Behind an interface for the same reason the catalogue is: this site has to
 * run, and be developable, with no credentials at all. Without this the whole
 * checkout — the one flow most worth clicking through while building it — would
 * need a Supabase project.
 *
 * The two implementations are not equivalent, and the difference is deliberate:
 * the Postgres one enforces rate limits across every server instance and
 * survives a restart, while the in-memory one only holds for one process. That
 * is fine for development and unacceptable in production, which is why the
 * choice is made from whether ERP credentials exist rather than from a flag
 * anyone could set.
 */
export type OtpRecord = {
  id: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
};

export type NewOtp = {
  phone: string;
  codeHash: string;
  channel: OtpChannel;
  expiresAt: Date;
};

export interface OtpStore {
  /** Codes issued to this phone since `since`, newest first. */
  recentFor(phone: string, since: Date): Promise<{ createdAt: string }[]>;
  create(record: NewOtp): Promise<void>;
  /** The only redeemable code for this phone: newest, not yet consumed. */
  newestUnconsumed(phone: string): Promise<OtpRecord | null>;
  bumpAttempts(id: string, attempts: number): Promise<void>;
  consume(id: string): Promise<void>;
  readonly source: "erp" | "memory";
}

const TABLE = "storefront_phone_otp";

class SupabaseOtpStore implements OtpStore {
  readonly source = "erp" as const;

  async recentFor(phone: string, since: Date) {
    const { data, error } = await erpDb()
      .from(TABLE)
      .select("created_at")
      .eq("phone", phone)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new Error(`OTP history read failed: ${error.message}`);
    return (data ?? []).map((row) => ({ createdAt: row.created_at as string }));
  }

  async create(record: NewOtp) {
    const { error } = await erpDb().from(TABLE).insert({
      phone: record.phone,
      code_hash: record.codeHash,
      purpose: "order",
      channel: record.channel,
      expires_at: record.expiresAt.toISOString(),
    });
    if (error) throw new Error(`OTP write failed: ${error.message}`);
  }

  async newestUnconsumed(phone: string) {
    const { data, error } = await erpDb()
      .from(TABLE)
      .select("id, code_hash, expires_at, attempts")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`OTP read failed: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id as string,
      codeHash: data.code_hash as string,
      expiresAt: data.expires_at as string,
      attempts: data.attempts as number,
    };
  }

  async bumpAttempts(id: string, attempts: number) {
    await erpDb().from(TABLE).update({ attempts }).eq("id", id);
  }

  async consume(id: string) {
    await erpDb()
      .from(TABLE)
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", id);
  }
}

type MemoryRow = OtpRecord & {
  phone: string;
  createdAt: string;
  consumedAt: string | null;
};

/**
 * Development only.
 *
 * On globalThis rather than in module scope, so the action that sends a code
 * and the one that verifies it share a store even when they are bundled
 * separately. Capped, so a long-running dev server cannot grow it without
 * bound. See lib/dev-store.ts.
 */
const rows = devStore("otp:rows", () => [] as MemoryRow[]);
const MEMORY_LIMIT = 200;

class MemoryOtpStore implements OtpStore {
  readonly source = "memory" as const;

  async recentFor(phone: string, since: Date) {
    return rows
      .filter(
        (row) =>
          row.phone === phone && new Date(row.createdAt).getTime() >= since.getTime(),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => ({ createdAt: row.createdAt }));
  }

  async create(record: NewOtp) {
    rows.push({
      id: crypto.randomUUID(),
      phone: record.phone,
      codeHash: record.codeHash,
      expiresAt: record.expiresAt.toISOString(),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date().toISOString(),
    });
    if (rows.length > MEMORY_LIMIT) rows.splice(0, rows.length - MEMORY_LIMIT);
  }

  async newestUnconsumed(phone: string) {
    const row = rows
      .filter((candidate) => candidate.phone === phone && candidate.consumedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    return row
      ? {
          id: row.id,
          codeHash: row.codeHash,
          expiresAt: row.expiresAt,
          attempts: row.attempts,
        }
      : null;
  }

  async bumpAttempts(id: string, attempts: number) {
    const row = rows.find((candidate) => candidate.id === id);
    if (row) row.attempts = attempts;
  }

  async consume(id: string) {
    const row = rows.find((candidate) => candidate.id === id);
    if (row) row.consumedAt = new Date().toISOString();
  }
}

let cached: OtpStore | null = null;

export function otpStore(): OtpStore {
  if (cached) return cached;
  cached =
    erpEnv.configured && !erpEnv.forceMock
      ? new SupabaseOtpStore()
      : new MemoryOtpStore();
  return cached;
}
