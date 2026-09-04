"use client";

import { Field, Input, Select, Textarea } from "@/components/checkout/fields";
import { CHECKOUT_LIMITS } from "@/lib/orders/schema";
import { DIVISIONS, areasOf, districtsOf } from "@/lib/bd-geo";

/*
 * Division → District → Area, then the address the rider actually reads.
 *
 * The whole tree is already in the bundle (see lib/bd-geo.ts), so changing a
 * division repopulates districts with no round trip — which matters, because
 * this is the screen a customer is on when their 3G drops.
 *
 * The third level is a text input with a <datalist>, not a select, and that is
 * the considered choice: no list of upazilas and city thanas is ever quite
 * current, and people write "Uttara Sector 7" rather than "Uttara". So it
 * suggests and accepts anything. An imperfect list must never be the reason an
 * order cannot be placed.
 */
export function AddressFields({
  divisionId,
  districtId,
  area,
  addressLine,
  landmark,
  onChange,
  errors,
}: {
  divisionId: string;
  districtId: string;
  area: string;
  addressLine: string;
  landmark: string;
  onChange: (
    patch: Partial<{
      divisionId: string;
      districtId: string;
      area: string;
      addressLine: string;
      landmark: string;
    }>,
  ) => void;
  errors: Record<string, string>;
}) {
  const districts = districtsOf(divisionId);
  const areas = areasOf(districtId);

  return (
    <section aria-labelledby="address-heading">
      <h2 id="address-heading" className="font-display text-display-s">
        Where it goes
      </h2>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Division" htmlFor="division" error={errors.divisionId}>
            <Select
              id="division"
              name="division"
              value={divisionId}
              onChange={(event) =>
                /* A district from the previous division would be a real address
                   that does not exist, and the server rejects the combination.
                   Clearing it here is what stops that being a submit-time
                   error the customer has to decode. */
                onChange({
                  divisionId: event.target.value,
                  districtId: "",
                  area: "",
                })
              }
              required
            >
              <option value="">Choose a division</option>
              {DIVISIONS.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="District" htmlFor="district" error={errors.districtId}>
            <Select
              id="district"
              name="district"
              value={districtId}
              onChange={(event) =>
                onChange({ districtId: event.target.value, area: "" })
              }
              disabled={districts.length === 0}
              required
            >
              <option value="">
                {districts.length === 0 ? "Pick a division first" : "Choose a district"}
              </option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Area or thana"
          htmlFor="area"
          error={errors.area}
          optional
          hint="Start typing — or write it however you know it."
        >
          <Input
            id="area"
            name="area"
            value={area}
            onChange={(event) => onChange({ area: event.target.value })}
            list="area-options"
            autoComplete="address-level3"
            maxLength={CHECKOUT_LIMITS.area}
            placeholder={areas[0] ? `e.g. ${areas[0]}` : "Area"}
            disabled={!districtId}
          />
          <datalist id="area-options">
            {areas.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <Field
          label="Full address"
          htmlFor="addressLine"
          error={errors.addressLine}
          hint="House and flat, road, block. The more exact, the fewer calls from the rider."
        >
          <Textarea
            id="addressLine"
            name="addressLine"
            value={addressLine}
            onChange={(event) => onChange({ addressLine: event.target.value })}
            autoComplete="street-address"
            maxLength={CHECKOUT_LIMITS.addressLine}
            placeholder="House 12 (3rd floor), Road 5, Block C"
            required
          />
        </Field>

        <Field
          label="Nearby landmark"
          htmlFor="landmark"
          optional
          error={errors.landmark}
          hint="A mosque, school or shop the rider will know."
        >
          <Input
            id="landmark"
            name="landmark"
            value={landmark}
            onChange={(event) => onChange({ landmark: event.target.value })}
            maxLength={CHECKOUT_LIMITS.landmark}
            placeholder="Beside Banani Bidyaniketan"
          />
        </Field>
      </div>
    </section>
  );
}
