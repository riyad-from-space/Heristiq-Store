/*
 * Re-export only. The implementations live in packages/shared, shared with the
 * storefront so the same number renders the same way on both.
 *
 * `money` rather than the storefront's `taka`: the ERP renders ledger figures,
 * which have sub-taka costs and negative roundings in them. See the note in
 * packages/shared/src/format.ts.
 */
export {
  money,
  num,
  date,
  dateTime,
  firstOfNextMonth,
  daysAgoDhaka,
  todayDhaka,
} from "@heristiq/shared/format";
