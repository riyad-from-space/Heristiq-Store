/*
 * Re-export only. The implementations live in packages/shared, shared with the
 * ERP so a customer never sees ৳1,250 on the site and ৳1,250.00 on an invoice.
 *
 * `taka` rather than the ERP's `money`: the storefront renders prices, which
 * are whole taka by construction. See the note in packages/shared/src/format.ts.
 */
export {
  taka,
  todayDhaka,
  dateTimeDhaka,
  dateDhaka,
  dayRange,
} from "@heristiq/shared/format";
