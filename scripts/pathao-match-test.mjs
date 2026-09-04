/*
 * Exercises the Pathao address matcher against fixtures. Not part of the app.
 *
 *   node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON scripts/pathao-match-test.mjs
 *
 * Pathao takes a city id, a zone id and an area id — not an address — so
 * something has to map our division/district/area onto their taxonomy, and
 * that mapping is the part of the integration most likely to be quietly wrong.
 * It also cannot be checked against the live API without a merchant account.
 *
 * So the city and zone names below are realistic Pathao names, including the
 * cases that actually break naive matching: districts they still list under
 * pre-2019 spellings, and busy thanas they split into numbered zones.
 */
import {
  matchByName,
  normaliseName,
  resolveLocation,
} from "../src/lib/courier/pathao-locations.ts";

const cities = [
  { city_id: 1, city_name: "Dhaka" },
  { city_id: 2, city_name: "Chittagong" },      // we say Chattogram
  { city_id: 3, city_name: "Comilla" },          // we say Cumilla
  { city_id: 4, city_name: "Bogra" },            // we say Bogura
  { city_id: 5, city_name: "Jessore" },          // we say Jashore
  { city_id: 6, city_name: "Barisal" },          // we say Barishal
  { city_id: 7, city_name: "Sylhet" },
  { city_id: 8, city_name: "Cox's Bazar" },
  { city_id: 9, city_name: "Narayanganj" },
  { city_id: 10, city_name: "Nawabganj" },       // we say Chapai Nawabganj
  { city_id: 11, city_name: "Jhalakathi" },      // we say Jhalokati
];

const zones = {
  1: [
    { zone_id: 100, zone_name: "Mirpur 1" },
    { zone_id: 101, zone_name: "Mirpur 10" },
    { zone_id: 102, zone_name: "Mirpur 11" },
    { zone_id: 103, zone_name: "Gulshan 1" },
    { zone_id: 104, zone_name: "Gulshan 2" },
    { zone_id: 105, zone_name: "Dhanmondi" },
    { zone_id: 106, zone_name: "Uttara Sector 7" },
    { zone_id: 107, zone_name: "Bashundhara R/A" },
    { zone_id: 108, zone_name: "Savar" },
    { zone_id: 109, zone_name: "Keraniganj" },
    { zone_id: 110, zone_name: "Tejgaon" },
  ],
  3: [
    { zone_id: 300, zone_name: "Comilla Sadar" },
    { zone_id: 301, zone_name: "Laksam" },
    { zone_id: 302, zone_name: "Chandina" },
  ],
  7: [
    { zone_id: 700, zone_name: "Sylhet Sadar" },
    { zone_id: 701, zone_name: "Beanibazar" },
    { zone_id: 702, zone_name: "Golapganj" },
  ],
};

const areas = {
  100: [
    { area_id: 1000, area_name: "Mirpur 1 Bus Stand" },
    { area_id: 1001, area_name: "Shah Ali Market" },
  ],
  105: [{ area_id: 1050, area_name: "Dhanmondi 27" }],
};

const zonesFor = (id) => zones[id] ?? [];
const areasFor = (id) => areas[id] ?? [];

let pass = 0;
let fail = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `  got ${actual}, want ${expected}`}`);
  if (ok) pass += 1;
  else fail += 1;
};

console.log("\nnormalisation");
check("Cox's Bazar → coxsbazar", normaliseName("Cox's Bazar"), "coxsbazar");
check("Chapai Nawabganj", normaliseName("Chapai Nawabganj"), "chapainawabganj");
check("Bashundhara R/A", normaliseName("Bashundhara R/A"), "bashundharara");

console.log("\ncity matching — the renamed districts");
const city = (name) => {
  const hit = matchByName(name, cities.map((item) => ({ item, name: item.city_name })));
  return hit ? `${hit.item.city_name}:${hit.match}` : "none";
};
check("Dhaka", city("Dhaka"), "Dhaka:exact");
check("Chattogram → Chittagong", city("Chattogram"), "Chittagong:alias");
check("Cumilla → Comilla", city("Cumilla"), "Comilla:alias");
check("Bogura → Bogra", city("Bogura"), "Bogra:alias");
check("Jashore → Jessore", city("Jashore"), "Jessore:alias");
check("Barishal → Barisal", city("Barishal"), "Barisal:alias");
check("Cox's Bazar (punctuation)", city("Cox's Bazar"), "Cox's Bazar:exact");
check("Chapai Nawabganj → Nawabganj", city("Chapai Nawabganj"), "Nawabganj:alias");
check("Jhalokati → Jhalakathi", city("Jhalokati"), "Jhalakathi:alias");
check("Sylhet", city("Sylhet"), "Sylhet:exact");
check("a district Pathao does not serve", city("Bandarban"), "none");

console.log("\nzone matching — numbered splits and genuine ambiguity");
const zone = (cityId, name) => {
  const hit = matchByName(name, zonesFor(cityId).map((item) => ({ item, name: item.zone_name })));
  return hit ? `${hit.item.zone_name}:${hit.match}` : "none";
};
check("Mirpur → shortest numbered zone", zone(1, "Mirpur"), "Mirpur 1:fuzzy");
check("Mirpur 10 exactly", zone(1, "Mirpur 10"), "Mirpur 10:exact");
check("Mirpur-11 with a dash", zone(1, "Mirpur-11"), "Mirpur 11:exact");
check("Dhanmondi", zone(1, "Dhanmondi"), "Dhanmondi:exact");
check("Uttara Sector 7", zone(1, "Uttara Sector 7"), "Uttara Sector 7:exact");
check("Uttara (no sector given)", zone(1, "Uttara"), "Uttara Sector 7:fuzzy");
check("Bashundhara", zone(1, "Bashundhara"), "Bashundhara R/A:fuzzy");
check("a Dhaka upazila", zone(1, "Savar"), "Savar:exact");
check("nothing like it", zone(1, "Chattogram"), "none");
check("Sadar in Comilla", zone(3, "Comilla Sadar"), "Comilla Sadar:exact");
check("bare 'Sadar' resolves via containment", zone(3, "Sadar"), "Comilla Sadar:fuzzy");

console.log("\nfull resolution");
const resolve = (districtName, areaName) =>
  resolveLocation({ districtName, areaName, cities, zonesFor, areasFor });

const dhakaMirpur = resolve("Dhaka", "Mirpur");
check("Dhaka/Mirpur resolves", dhakaMirpur.ok, true);
if (dhakaMirpur.ok) {
  check("  city id", dhakaMirpur.location.cityId, 1);
  check("  zone id", dhakaMirpur.location.zoneId, 100);
  check("  area id (from the zone's list)", dhakaMirpur.location.areaId, 1000);
  check("  confidence", dhakaMirpur.location.match, "fuzzy");
}

const dhanmondi = resolve("Dhaka", "Dhanmondi");
check("Dhaka/Dhanmondi is exact", dhanmondi.ok && dhanmondi.location.match, "exact");
check("  zone id", dhanmondi.ok && dhanmondi.location.zoneId, 105);

const cumilla = resolve("Cumilla", "Laksam");
check("Cumilla/Laksam resolves through the alias", cumilla.ok, true);
check("  city id", cumilla.ok && cumilla.location.cityId, 3);
check("  no area list for that zone", cumilla.ok && cumilla.location.areaId, null);
check("  confidence is alias, not exact", cumilla.ok && cumilla.location.match, "alias");

const noArea = resolve("Dhaka", "");
check("no area given → refused", noArea.ok, false);
check("  and says why", noArea.ok === false && /no area/.test(noArea.reason), true);

const unknownCity = resolve("Bandarban", "Ruma");
check("unserved district → refused", unknownCity.ok, false);

const unknownZone = resolve("Sylhet", "Nowhere Bazar");
check("unmatched area → refused", unknownZone.ok, false);
check("  and names the area", unknownZone.ok === false && /Nowhere Bazar/.test(unknownZone.reason), true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
