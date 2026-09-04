/*
 * Our address → Pathao's city / zone / area ids.
 *
 * Deliberately free of `server-only` and of every import: this is pure
 * matching logic, it is the part of the Pathao integration with all the
 * judgement in it, and keeping it importable means it can be exercised against
 * fixtures with no Pathao account. See scripts/pathao-match-test.mjs.
 *
 * The one genuinely hard part of the Pathao integration. Pathao's create-order
 * does not accept an address; it accepts three integers from its own taxonomy,
 * and the storefront collects a division/district/area because that is what a
 * customer knows and what any courier can be mapped from.
 *
 * The matching is name-based, and the reason it needs care rather than a
 * `===`:
 *
 *  - Districts were officially renamed and couriers adopted the new spellings
 *    at their own pace. bd-geo.ts uses the current names (Jashore, Bogura,
 *    Chattogram, Cumilla); Pathao may still say Jessore, Bogra, Chittagong,
 *    Comilla. That is what ALIASES is for.
 *  - Zone names are local usage nobody standardised, so an exact match is a
 *    lucky one. Hence the ladder: exact, then alias, then prefix, then
 *    containment — and a refusal if none of those is confident.
 *
 * A refusal is the important behaviour. Guessing a zone means a parcel sent to
 * the wrong thana: a real delivery failure, paid for twice, that looks like a
 * successful push. So an unresolved zone fails the push with a message naming
 * what to do about it, and the fix is one row in storefront_courier_zones.
 */

export type PathaoCity = { city_id: number; city_name: string };
export type PathaoZone = { zone_id: number; zone_name: string };
export type PathaoArea = { area_id: number; area_name: string };

export type ResolvedLocation = {
  cityId: number;
  cityName: string;
  zoneId: number;
  zoneName: string;
  areaId: number | null;
  areaName: string | null;
  /** How confident the match was, for the audit trail. */
  match: "exact" | "alias" | "fuzzy" | "manual";
};

/**
 * Compare names with the punctuation and spacing removed.
 *
 * This alone resolves most of the variance: "Cox's Bazar" and "Coxs Bazar"
 * both become "coxsbazar", "Chapai Nawabganj" matches "Chapainawabganj", and
 * "Sadar Upazila" stops differing from "sadar upazila".
 */
export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/*
 * Names that normalisation cannot bridge, because they are different words.
 *
 * Keyed by our name (from lib/bd-geo.ts), listing what a courier might call
 * the same place. Both directions are tried, so this also covers a courier
 * using the new name while an older mapping row has the old one.
 */
const ALIASES: Record<string, string[]> = {
  // Districts renamed between 2018 and 2019.
  chattogram: ["chittagong"],
  cumilla: ["comilla"],
  bogura: ["bogra"],
  jashore: ["jessore"],
  barishal: ["barisal"],
  chapainawabganj: ["nawabganj", "chapainababganj", "chapainawabgonj"],
  // Spellings that simply differ.
  coxsbazar: ["coxbazar", "coxsbazaar"],
  netrokona: ["netrakona"],
  jhalokati: ["jhalokathi", "jhalakathi"],
  moulvibazar: ["maulvibazar", "moulavibazar"],
  munshiganj: ["munshigonj", "munshiganj"],
  sirajganj: ["sirajgonj"],
  panchagarh: ["panchagar"],
  nesarabad: ["swarupkathi", "shorupkathi"],
  sreemangal: ["srimangal", "sreemongol"],
  brahmanbaria: ["bbaria", "brahmanbariya"],
  // Dhaka's own naming, where the district and the city are the same word but
  // Pathao splits the metro into its own city.
  dhaka: ["dhakacity", "dhakametro"],
};

function aliasesFor(name: string): string[] {
  const key = normaliseName(name);
  const direct = ALIASES[key] ?? [];
  /* The reverse direction: our name may be what someone listed as an alias. */
  const reverse = Object.entries(ALIASES)
    .filter(([, values]) => values.includes(key))
    .map(([canonical]) => canonical);
  return [...direct, ...reverse];
}

type Named<T> = { item: T; name: string };

/**
 * Pick the entry whose name best matches `wanted`, or null.
 *
 * The ladder is deliberately ordered by confidence and stops at the first
 * level that produces exactly one candidate. A level that produces several is
 * ambiguous, and ambiguity is treated as no match — "Sadar" matching four
 * zones is not a result worth shipping a parcel on.
 */
export function matchByName<T>(
  wanted: string,
  candidates: Named<T>[],
): { item: T; match: "exact" | "alias" | "fuzzy" } | null {
  const target = normaliseName(wanted);
  if (!target) return null;

  const normalised = candidates.map((candidate) => ({
    ...candidate,
    key: normaliseName(candidate.name),
  }));

  const exact = normalised.filter((candidate) => candidate.key === target);
  if (exact.length === 1) return { item: exact[0].item, match: "exact" };
  /* Several exact matches means the courier lists the name twice; the first is
     as good an answer as exists, and it is still an exact one. */
  if (exact.length > 1) return { item: exact[0].item, match: "exact" };

  const alternates = aliasesFor(wanted);
  const aliased = normalised.filter((candidate) =>
    alternates.includes(candidate.key),
  );
  if (aliased.length >= 1) return { item: aliased[0].item, match: "alias" };

  /*
   * Prefix next, and here one candidate is NOT required — which is the single
   * most consequential decision in this file.
   *
   * Pathao splits busy thanas into numbered zones: someone who types "Mirpur"
   * matches Mirpur 1, Mirpur 10, Mirpur 11, Mirpur 12… Requiring a unique
   * candidate would refuse the most common area in Dhaka, and refusing is not
   * the safer choice here — every one of those zones IS in Mirpur, the rider
   * navigates by the written address regardless, and the zone is a routing
   * hint rather than the address itself.
   *
   * So when every candidate begins with what the customer wrote, they are
   * treated as the same locality and the shortest name wins (the least
   * qualified, so "Mirpur 1" over "Mirpur 10"). Recorded as `fuzzy`, which is
   * what puts it in the shipment's audit trail.
   */
  const startsWithTarget = normalised.filter((candidate) =>
    candidate.key.startsWith(target),
  );
  if (startsWithTarget.length > 0) {
    const shortest = startsWithTarget.reduce((best, candidate) =>
      candidate.key.length < best.key.length ? candidate : best,
    );
    return { item: shortest.item, match: "fuzzy" };
  }

  /*
   * The other direction — the customer wrote more than the courier lists, as
   * in "Nesarabad (Swarupkathi)" against "Nesarabad". Unique only, because
   * these are not variants of one locality the way numbered zones are.
   */
  const targetStartsWith = normalised.filter((candidate) =>
    target.startsWith(candidate.key),
  );
  if (targetStartsWith.length === 1) {
    return { item: targetStartsWith[0].item, match: "fuzzy" };
  }

  /*
   * Containment last, and unique only. This is where "Sadar" against four
   * different Sadar zones correctly gives up: a wrong district's Sadar is a
   * parcel on the wrong side of the country, not a slightly imprecise hint.
   */
  const contains = normalised.filter(
    (candidate) =>
      candidate.key.includes(target) || target.includes(candidate.key),
  );
  if (contains.length === 1) return { item: contains[0].item, match: "fuzzy" };

  return null;
}

/**
 * Match a district onto one of Pathao's cities.
 *
 * Separate from resolveLocation because the provider has to know the city
 * BEFORE it can fetch that city's zone list — resolving in one pass would mean
 * either downloading every city's zones or, worse, probing them one at a time.
 */
export function matchCity(districtName: string, cities: PathaoCity[]) {
  return matchByName(
    districtName,
    cities.map((item) => ({ item, name: item.city_name })),
  );
}

/** Match a customer's free-text area onto one of a city's zones. */
export function matchZone(areaName: string, zones: PathaoZone[]) {
  return matchByName(
    areaName,
    zones.map((item) => ({ item, name: item.zone_name })),
  );
}

/** Match it onto one of a zone's areas. Optional to Pathao, so a miss is fine. */
export function matchArea(areaName: string, areas: PathaoArea[]) {
  return matchByName(
    areaName,
    areas.map((item) => ({ item, name: item.area_name })),
  );
}

/**
 * Everything needed to resolve one address, given the courier's lists.
 *
 * Pure, and separate from the provider on purpose: the API calls and the
 * caching live in pathao.ts, and this is the part with all the judgement in it,
 * so it can be tested against fixtures without a Pathao account. See
 * scripts/pathao-match-test.mjs.
 */
export function resolveLocation({
  districtName,
  areaName,
  cities,
  zonesFor,
  areasFor,
}: {
  districtName: string;
  areaName: string | null;
  cities: PathaoCity[];
  zonesFor: (cityId: number) => PathaoZone[];
  areasFor: (zoneId: number) => PathaoArea[];
}): { ok: true; location: ResolvedLocation } | { ok: false; reason: string } {
  const city = matchCity(districtName, cities);

  if (!city) {
    return {
      ok: false,
      reason: `Pathao has no city matching the district "${districtName}".`,
    };
  }

  const zones = zonesFor(city.item.city_id);
  if (zones.length === 0) {
    return {
      ok: false,
      reason: `Pathao lists no zones for ${city.item.city_name}.`,
    };
  }

  /*
   * With no area given there is nothing to match a zone on, and picking one
   * would be picking a thana at random. Refuse, and say what would fix it —
   * the checkout treats the area as optional because most couriers only need
   * the written address, and Pathao is the one that does not.
   */
  if (!areaName?.trim()) {
    return {
      ok: false,
      reason:
        `${city.item.city_name} has ${zones.length} Pathao zones and this order has no area, ` +
        `so the thana cannot be determined. Ask the customer which area, or set a default zone ` +
        `for this district in storefront_courier_zones.`,
    };
  }

  const zone = matchZone(areaName, zones);

  if (!zone) {
    return {
      ok: false,
      reason:
        `No Pathao zone in ${city.item.city_name} matches the area "${areaName}". ` +
        `Pick one from their list and add it to storefront_courier_zones.`,
    };
  }

  /*
   * Area is the finest level and the least reliable, and Pathao accepts an
   * order without it. So a miss here is not a failure — it costs the rider a
   * slightly less precise hint, and the written address still carries the
   * detail.
   */
  const areas = areasFor(zone.item.zone_id);
  const area = areas.length > 0 ? matchArea(areaName, areas) : null;

  return {
    ok: true,
    location: {
      cityId: city.item.city_id,
      cityName: city.item.city_name,
      zoneId: zone.item.zone_id,
      zoneName: zone.item.zone_name,
      areaId: area?.item.area_id ?? null,
      areaName: area?.item.area_name ?? null,
      /* The weakest link decides how much to trust the whole resolution. */
      match:
        city.match === "fuzzy" || zone.match === "fuzzy"
          ? "fuzzy"
          : city.match === "alias" || zone.match === "alias"
            ? "alias"
            : "exact",
    },
  };
}
