/*
 * Re-export only.
 *
 * The implementation moved to packages/shared so the storefront, the ERP and
 * the database's own normalise_bd_phone() cannot drift — a number stored two
 * ways never matches on search. This file stays so that every existing
 * `@/lib/phone` import keeps working.
 */
export {
  normalisePhone,
  isValidPhone,
  displayPhone,
  whatsappNumber,
} from "@heristiq/shared/phone";
