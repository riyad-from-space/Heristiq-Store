import { slugify } from "@/lib/utils";

/*
 * Bangladesh addresses: division → district → area.
 *
 * Client-safe on purpose — the checkout cascade needs the whole tree in the
 * browser so changing a division does not cost a round trip on a 3G phone. The
 * data below is ~13KB before compression, which is cheaper than one request.
 *
 * Three decisions worth knowing about:
 *
 *  1. The third level is a SUGGESTION, not a constraint. Areas are upazila and
 *     city-thana names, and no list of them is ever quite current — thanas get
 *     split, city corporations rename wards, and people write "Uttara Sector 7"
 *     rather than "Uttara". So the area field accepts anything the customer
 *     types and offers these as autocomplete. An imperfect list must never be
 *     the reason an order cannot be placed.
 *
 *  2. Division and district ARE constrained. There are 8 and 64 of them, they
 *     do not change, and every courier's own zone lookup keys off them. Phase 4
 *     maps these onto Pathao's city/zone ids.
 *
 *  3. What the courier actually reads is the free-text address line. This tree
 *     exists to produce a delivery fee, a courier zone and a sane form — not to
 *     replace a written address.
 */

/** Compact source of truth: division → district → comma-separated areas. */
const RAW: Record<string, Record<string, string>> = {
  Barishal: {
    Barguna: "Amtali,Bamna,Barguna Sadar,Betagi,Patharghata,Taltali",
    Barishal:
      "Agailjhara,Babuganj,Bakerganj,Banaripara,Barishal Sadar,Gaurnadi,Hizla,Mehendiganj,Muladi,Wazirpur",
    Bhola:
      "Bhola Sadar,Burhanuddin,Char Fasson,Daulatkhan,Lalmohan,Manpura,Tazumuddin",
    Jhalokati: "Jhalokati Sadar,Kathalia,Nalchity,Rajapur",
    Patuakhali:
      "Bauphal,Dashmina,Dumki,Galachipa,Kalapara,Mirzaganj,Patuakhali Sadar,Rangabali",
    Pirojpur:
      "Bhandaria,Kawkhali,Mathbaria,Nazirpur,Nesarabad,Pirojpur Sadar,Indurkani",
  },

  Chattogram: {
    Bandarban:
      "Alikadam,Bandarban Sadar,Lama,Naikhongchhari,Rowangchhari,Ruma,Thanchi",
    Brahmanbaria:
      "Akhaura,Ashuganj,Bancharampur,Bijoynagar,Brahmanbaria Sadar,Kasba,Nabinagar,Nasirnagar,Sarail",
    Chandpur:
      "Chandpur Sadar,Faridganj,Haimchar,Haziganj,Kachua,Matlab Dakshin,Matlab Uttar,Shahrasti",
    Chattogram:
      "Bakalia,Bayazid,Chandgaon,Chawkbazar,Double Mooring,Halishahar,Khulshi,Kotwali,Pahartali,Panchlaish,Patenga,Bandar,Anowara,Banshkhali,Boalkhali,Chandanaish,Fatikchhari,Hathazari,Karnaphuli,Lohagara,Mirsharai,Patiya,Rangunia,Raozan,Sandwip,Satkania,Sitakunda",
    Cumilla:
      "Barura,Brahmanpara,Burichang,Chandina,Chauddagram,Cumilla Adarsha Sadar,Cumilla Sadar Dakshin,Daudkandi,Debidwar,Homna,Laksam,Meghna,Monohorgonj,Muradnagar,Nangalkot,Titas",
    "Cox's Bazar":
      "Chakaria,Cox's Bazar Sadar,Kutubdia,Maheshkhali,Pekua,Ramu,Teknaf,Ukhia",
    Feni: "Chhagalnaiya,Daganbhuiyan,Feni Sadar,Fulgazi,Parshuram,Sonagazi",
    Khagrachhari:
      "Dighinala,Khagrachhari Sadar,Lakshmichhari,Mahalchhari,Manikchhari,Matiranga,Panchhari,Ramgarh",
    Lakshmipur: "Kamalnagar,Lakshmipur Sadar,Raipur,Ramganj,Ramgati",
    Noakhali:
      "Begumganj,Chatkhil,Companiganj,Hatiya,Kabirhat,Noakhali Sadar,Senbagh,Sonaimuri,Subarnachar",
    Rangamati:
      "Bagaichhari,Barkal,Belaichhari,Juraichhari,Kaptai,Kawkhali,Langadu,Naniarchar,Rajasthali,Rangamati Sadar",
  },

  Dhaka: {
    /*
     * Dhaka district leads with the city thanas, because that is where the
     * orders are, and a customer in Mirpur should not have to scroll past
     * Dohar to find it. The five surrounding upazilas follow.
     */
    Dhaka:
      "Adabor,Badda,Banani,Bangshal,Cantonment,Chawkbazar,Dakshinkhan,Darus Salam,Demra,Dhanmondi,Gendaria,Gulshan,Hazaribagh,Jatrabari,Kadamtali,Kafrul,Kalabagan,Kamrangirchar,Khilgaon,Khilkhet,Kotwali,Lalbagh,Mirpur,Mohammadpur,Motijheel,Mugda,New Market,Pallabi,Paltan,Ramna,Rampura,Sabujbagh,Shah Ali,Shahbagh,Sher-e-Bangla Nagar,Shyampur,Sutrapur,Tejgaon,Turag,Uttara,Uttar Khan,Vatara,Wari,Savar,Dhamrai,Keraniganj,Nawabganj,Dohar",
    Faridpur:
      "Alfadanga,Bhanga,Boalmari,Charbhadrasan,Faridpur Sadar,Madhukhali,Nagarkanda,Sadarpur,Saltha",
    Gazipur: "Gazipur Sadar,Kaliakair,Kaliganj,Kapasia,Sreepur,Tongi",
    Gopalganj: "Gopalganj Sadar,Kashiani,Kotalipara,Muksudpur,Tungipara",
    Kishoreganj:
      "Austagram,Bajitpur,Bhairab,Hossainpur,Itna,Karimganj,Katiadi,Kishoreganj Sadar,Kuliarchar,Mithamain,Nikli,Pakundia,Tarail",
    Madaripur: "Dasar,Kalkini,Madaripur Sadar,Rajoir,Shibchar",
    Manikganj:
      "Daulatpur,Ghior,Harirampur,Manikganj Sadar,Saturia,Shibalaya,Singair",
    Munshiganj:
      "Gazaria,Lohajang,Munshiganj Sadar,Sirajdikhan,Srinagar,Tongibari",
    Narayanganj:
      "Araihazar,Bandar,Fatullah,Narayanganj Sadar,Rupganj,Siddhirganj,Sonargaon",
    Narsingdi: "Belabo,Monohardi,Narsingdi Sadar,Palash,Raipura,Shibpur",
    Rajbari: "Baliakandi,Goalanda,Kalukhali,Pangsha,Rajbari Sadar",
    Shariatpur:
      "Bhedarganj,Damudya,Gosairhat,Naria,Shariatpur Sadar,Zanjira",
    Tangail:
      "Basail,Bhuapur,Delduar,Dhanbari,Ghatail,Gopalpur,Kalihati,Madhupur,Mirzapur,Nagarpur,Sakhipur,Tangail Sadar",
  },

  Khulna: {
    Bagerhat:
      "Bagerhat Sadar,Chitalmari,Fakirhat,Kachua,Mollahat,Mongla,Morrelganj,Rampal,Sarankhola",
    Chuadanga: "Alamdanga,Chuadanga Sadar,Damurhuda,Jibannagar",
    Jashore:
      "Abhaynagar,Bagherpara,Chaugachha,Jashore Sadar,Jhikargachha,Keshabpur,Manirampur,Sharsha",
    Jhenaidah:
      "Harinakunda,Jhenaidah Sadar,Kaliganj,Kotchandpur,Maheshpur,Shailkupa",
    Khulna:
      "Daulatpur,Khalishpur,Khan Jahan Ali,Kotwali,Sonadanga,Batiaghata,Dacope,Dighalia,Dumuria,Koyra,Paikgachha,Phultala,Rupsha,Terokhada",
    Kushtia: "Bheramara,Daulatpur,Khoksa,Kumarkhali,Kushtia Sadar,Mirpur",
    Magura: "Magura Sadar,Mohammadpur,Shalikha,Sreepur",
    Meherpur: "Gangni,Meherpur Sadar,Mujibnagar",
    Narail: "Kalia,Lohagara,Narail Sadar",
    Satkhira:
      "Assasuni,Debhata,Kalaroa,Kaliganj,Satkhira Sadar,Shyamnagar,Tala",
  },

  Mymensingh: {
    Jamalpur:
      "Baksiganj,Dewanganj,Islampur,Jamalpur Sadar,Madarganj,Melandaha,Sarishabari",
    Mymensingh:
      "Bhaluka,Dhobaura,Fulbaria,Gaffargaon,Gauripur,Haluaghat,Ishwarganj,Muktagachha,Mymensingh Sadar,Nandail,Phulpur,Tarakanda,Trishal",
    Netrokona:
      "Atpara,Barhatta,Durgapur,Kalmakanda,Kendua,Khaliajuri,Madan,Mohanganj,Netrokona Sadar,Purbadhala",
    Sherpur: "Jhenaigati,Nakla,Nalitabari,Sherpur Sadar,Sreebardi",
  },

  Rajshahi: {
    Bogura:
      "Adamdighi,Bogura Sadar,Dhunat,Dhupchanchia,Gabtali,Kahaloo,Nandigram,Sariakandi,Shajahanpur,Sherpur,Shibganj,Sonatala",
    "Chapai Nawabganj":
      "Bholahat,Chapai Nawabganj Sadar,Gomastapur,Nachole,Shibganj",
    Joypurhat: "Akkelpur,Joypurhat Sadar,Kalai,Khetlal,Panchbibi",
    Naogaon:
      "Atrai,Badalgachhi,Dhamoirhat,Manda,Mohadevpur,Naogaon Sadar,Niamatpur,Patnitala,Porsha,Raninagar,Sapahar",
    Natore:
      "Bagatipara,Baraigram,Gurudaspur,Lalpur,Naldanga,Natore Sadar,Singra",
    Pabna:
      "Atgharia,Bera,Bhangura,Chatmohar,Faridpur,Ishwardi,Pabna Sadar,Santhia,Sujanagar",
    Rajshahi:
      "Boalia,Motihar,Rajpara,Shah Makhdum,Bagha,Bagmara,Charghat,Durgapur,Godagari,Mohanpur,Paba,Puthia,Tanore",
    Sirajganj:
      "Belkuchi,Chauhali,Kamarkhanda,Kazipur,Raiganj,Shahjadpur,Sirajganj Sadar,Tarash,Ullapara",
  },

  Rangpur: {
    Dinajpur:
      "Birampur,Birganj,Biral,Bochaganj,Chirirbandar,Dinajpur Sadar,Ghoraghat,Hakimpur,Kaharole,Khansama,Nawabganj,Parbatipur,Phulbari",
    Gaibandha:
      "Fulchhari,Gaibandha Sadar,Gobindaganj,Palashbari,Sadullapur,Saghata,Sundarganj",
    Kurigram:
      "Bhurungamari,Char Rajibpur,Chilmari,Kurigram Sadar,Nageshwari,Phulbari,Rajarhat,Raomari,Ulipur",
    Lalmonirhat:
      "Aditmari,Hatibandha,Kaliganj,Lalmonirhat Sadar,Patgram",
    Nilphamari:
      "Dimla,Domar,Jaldhaka,Kishoreganj,Nilphamari Sadar,Saidpur",
    Panchagarh: "Atwari,Boda,Debiganj,Panchagarh Sadar,Tetulia",
    Rangpur:
      "Badarganj,Gangachhara,Kaunia,Mithapukur,Pirgachha,Pirganj,Rangpur Sadar,Taraganj",
    Thakurgaon: "Baliadangi,Haripur,Pirganj,Ranisankail,Thakurgaon Sadar",
  },

  Sylhet: {
    Habiganj:
      "Ajmiriganj,Bahubal,Baniachang,Chunarughat,Habiganj Sadar,Lakhai,Madhabpur,Nabiganj,Shayestaganj",
    Moulvibazar:
      "Barlekha,Juri,Kamalganj,Kulaura,Moulvibazar Sadar,Rajnagar,Sreemangal",
    Sunamganj:
      "Bishwambharpur,Chhatak,Derai,Dharampasha,Dowarabazar,Jagannathpur,Jamalganj,Shantiganj,Sulla,Sunamganj Sadar,Tahirpur",
    Sylhet:
      "Balaganj,Beanibazar,Bishwanath,Companiganj,Dakshin Surma,Fenchuganj,Golapganj,Gowainghat,Jaintiapur,Kanaighat,Osmani Nagar,Sylhet Sadar,Zakiganj",
  },
};

export type District = {
  /** Slug, e.g. "cox-s-bazar". Stable, and what a form field submits. */
  id: string;
  name: string;
  divisionId: string;
  areas: string[];
};

export type Division = {
  id: string;
  name: string;
  districts: District[];
};

export const DIVISIONS: Division[] = Object.entries(RAW).map(
  ([divisionName, districts]) => {
    const divisionId = slugify(divisionName);
    return {
      id: divisionId,
      name: divisionName,
      districts: Object.entries(districts).map(([districtName, areas]) => ({
        id: slugify(districtName),
        name: districtName,
        divisionId,
        areas: areas.split(","),
      })),
    };
  },
);

const DIVISION_BY_ID = new Map(DIVISIONS.map((d) => [d.id, d]));

const DISTRICT_BY_ID = new Map(
  DIVISIONS.flatMap((division) =>
    division.districts.map((district) => [district.id, district] as const),
  ),
);

export function findDivision(id: string | null | undefined) {
  return id ? (DIVISION_BY_ID.get(id) ?? null) : null;
}

export function findDistrict(id: string | null | undefined) {
  return id ? (DISTRICT_BY_ID.get(id) ?? null) : null;
}

/** Districts of a division, for the second select. Empty for an unknown id. */
export function districtsOf(divisionId: string | null | undefined): District[] {
  return findDivision(divisionId)?.districts ?? [];
}

/** Area suggestions for a district. Never a constraint — see the note above. */
export function areasOf(districtId: string | null | undefined): string[] {
  return findDistrict(districtId)?.areas ?? [];
}

/**
 * Which delivery tier an address falls in.
 *
 * Two tiers, because that is how the fee is configured and how the owner
 * quotes it: inside Dhaka, and everywhere else. Note that the couriers
 * themselves bill a third "sub-Dhaka" tier for Savar, Keraniganj and Dhamrai,
 * which this deliberately charges as inside-Dhaka — a customer in Savar quoted
 * ৳130 when Instagram said ৳70 does not read the footnote, they just leave.
 * The few taka of margin is cheaper than the abandoned cart.
 */
export function isInsideDhaka(districtId: string | null | undefined): boolean {
  return districtId === "dhaka";
}

/** How an address reads on a parcel, and back to the customer at checkout. */
export function formatAddress(parts: {
  addressLine: string;
  area?: string | null;
  district: string;
  division: string;
  landmark?: string | null;
}): string {
  return [
    parts.addressLine.trim(),
    parts.landmark?.trim() ? `(${parts.landmark.trim()})` : null,
    parts.area?.trim() || null,
    parts.district,
    /* Four districts share their division's name — Dhaka, Barishal, Khulna,
       Sylhet, Rangpur — and "Dhaka, Dhaka" on a confirmation page reads like a
       bug even though it is correct. */
    parts.division === parts.district ? null : parts.division,
  ]
    .filter(Boolean)
    .join(", ");
}
