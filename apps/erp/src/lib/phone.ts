/*
 * Re-export only.
 *
 * The implementation moved to packages/shared so this, the storefront's copy
 * and the database's normalise_bd_phone() (migration 0015) cannot drift.
 * Shared by the client form (so the user is told before a round trip) and the
 * server action (which is what actually decides).
 */
export { normalisePhone, isValidPhone } from "@heristiq/shared/phone";
