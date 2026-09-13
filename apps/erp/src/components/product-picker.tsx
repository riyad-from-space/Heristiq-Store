"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui";

/**
 * Anything this picker can choose between. Every product query in the ERP
 * returns at least this much; `category` comes from v_product_stock's join, and
 * is null for a product nobody has filed yet.
 */
export type PickableProduct = {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
};

/** Products with no category, gathered under one honest heading. */
const UNFILED = "Not in a category";

export function categoryOf(product: PickableProduct): string {
  return product.category?.trim() || UNFILED;
}

/**
 * Choose a category, then choose a product in it.
 *
 * ONE COMPONENT FOR ALL FOUR FORMS — sales, purchases, pre-orders and stock
 * adjustments each had their own bare product dropdown listing every SKU in
 * one flat run. That is fine at fifteen products and unusable at eighty, and
 * eighty is the point of the categories: a waist chain and a bracelet are not
 * the same aisle, and scrolling past thirty bracelets to reach a ring is how
 * the wrong line gets picked on a phone.
 *
 * THE PRODUCT SELECT IS INERT UNTIL A CATEGORY IS CHOSEN, which is the owner's
 * ask: "first show me the categories, after choosing category it should show me
 * products". "All products" is there as the last option for anyone who already
 * knows what they want and does not care which aisle it is in — the two-step is
 * the default, not a cage.
 *
 * The category is LOCAL STATE and deliberately not lifted. Each line of a sale
 * picks its own, so the second line does not inherit the first line's aisle —
 * and nothing outside needs to know, because the only thing that leaves this
 * component is a product id.
 */
export function ProductPicker({
  products,
  value,
  onChange,
  label = "Product",
  describe,
  disabled,
  noneOption,
}: {
  products: PickableProduct[];
  value: string;
  onChange: (productId: string) => void;
  label?: string;
  /** The line after the name — stock, price, whatever that form cares about. */
  describe?: (product: PickableProduct) => string;
  disabled?: boolean;
  /**
   * Label for a deliberate "no product" choice, offered AS A CATEGORY.
   *
   * Pre-orders need it: a customer can ask for something not in the catalogue,
   * and that is a real answer rather than an unfinished one. Putting it beside
   * the categories keeps the two-step intact — you still choose an aisle first,
   * and "not in the catalogue" is simply one of the aisles — where hiding it in
   * the product list would have meant picking a category to reach the option
   * that says you do not want one.
   */
  noneOption?: string;
}) {
  /*
   * Seeded from the product already chosen, so reopening a saved line shows
   * the aisle it came from rather than resetting to "choose a category" beside
   * a product that is plainly already picked.
   */
  const chosen = products.find((p) => p.id === value);
  const [category, setCategory] = useState<string>(
    chosen ? categoryOf(chosen) : "",
  );

  const categories = [...new Set(products.map(categoryOf))].sort((a, b) =>
    /* Unfiled last: it is a tidying job, not a department. */
    a === UNFILED ? 1 : b === UNFILED ? -1 : a.localeCompare(b),
  );

  /* Leading spaces, so neither sentinel can collide with a real category
     name — a category called "all" would otherwise silently become the
     show-everything option. */
  const ALL = " all";
  const NONE = " none";
  const visible =
    category === ALL
      ? products
      : category
        ? products.filter((p) => categoryOf(p) === category)
        : [];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Category">
        <Select
          value={category}
          disabled={disabled}
          onChange={(e) => {
            setCategory(e.target.value);
            /*
             * Clear the product when the aisle changes, unless it happens to
             * live in the new one. Leaving a bracelet selected under "Waist
             * chains" would submit the bracelet while the screen implies
             * otherwise — the form would be right and the reader deceived.
             */
            const still = products.find(
              (p) =>
                p.id === value &&
                (e.target.value === ALL || categoryOf(p) === e.target.value),
            );
            if (!still) onChange("");
          }}
        >
          <option value="">— choose a category —</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c} ({products.filter((p) => categoryOf(p) === c).length})
            </option>
          ))}
          <option value={ALL}>All products ({products.length})</option>
          {noneOption && <option value={NONE}>{noneOption}</option>}
        </Select>
      </Field>

      <Field label={label}>
        <Select
          value={value}
          /* Also inert once "not in the catalogue" is chosen — there is
             nothing to pick, and a live dropdown beside that choice invites
             picking one and wondering why the free-text box vanished. */
          disabled={disabled || category === "" || category === NONE}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {category === NONE
              ? (noneOption ?? "—")
              : category === ""
                ? "Choose a category first"
                : "— choose —"}
          </option>
          {visible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}){describe ? ` · ${describe(p)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
