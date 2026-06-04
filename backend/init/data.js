// Seed listings, generated per city. Each listing's `location` is kept equal to a
// city offered by the search bar's DestinationPicker
// (frontend/src/components/search/DestinationPicker.tsx) so every "Where" suggestion
// returns results — listingService.findAll regex-matches ?where= against
// location/title/country. Keep the city names in sync if either side changes.
//
// We generate PER_CITY listings for each of the 12 cities (PER_CITY * 12 total),
// rotating neighbourhoods, property types, and vibe-matched photos so the grid
// stays varied without maintaining a huge hand-written array.

const PER_CITY = 9;

// Photo URLs grouped by vibe so each listing's image suits its setting. The nine
// originals (already verified to load) seed the pools; the rest are themed
// Unsplash photos. Any URL that fails to load is replaced, per listing, by a
// unique picsum image on the frontend (handleListingImageError), so the grid
// never shows a broken tile even for an unverified link.
const img = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=60`;

const IMAGES = {
  beach: [
    "1552733407-5d5c46c3bb3b",
    "1571003123894-1f0594d2b5d9",
    "1507525428034-b723cf961d3e",
    "1473116763249-2faaef81ccda",
    "1505228395891-9a51e7e86bf6",
    "1540541338287-41700207dee6",
    "1519046904884-53103b34b206",
  ].map(img),
  backwater: [
    "1566073771259-6a8506099945",
    "1582719478250-c89cae4dc85b",
    "1597211833712-5e41faa202ea",
    "1571003123894-1f0594d2b5d9",
    "1505693416388-ac5ce068fe85",
    "1540202404-a2f29016b523",
  ].map(img),
  metro: [
    "1622396481328-9b1b78cdd9fd",
    "1501785888041-af3ef285b470",
    "1502672260266-1c1ef2d93688",
    "1560448204-e02f11c3d0e2",
    "1502005229762-cf1b2da7c5d6",
    "1512917774080-9991f1c4c750",
    "1545324418-cc1a3fa10c00",
    "1554995207-c18c203602cb",
    "1484154218962-a197022b5858",
    "1522708323590-d24dbb6b0267",
    "1493809842364-78817add7ffb",
  ].map(img),
  heritage: [
    "1566073771259-6a8506099945",
    "1564013799919-ab600027ffc6",
    "1580587771525-78b9dba3b914",
    "1613490493576-7fde63acd811",
    "1568605114967-8130f3a36994",
    "1600585154340-be6161a56a0c",
    "1600596542815-ffad4c1539a9",
    "1571896349842-33c89424de2d",
    "1505691938895-1758d7feb511",
  ].map(img),
  lake: [
    "1464822759023-fed622ff2c3b",
    "1439066615861-d1af74d74000",
    "1470770841072-f978cf4d019e",
    "1455587734955-081b22074882",
    "1505765050516-f72dcac9c60e",
  ].map(img),
  mountain: [
    "1571896349842-33c89424de2d",
    "1520250497591-112f2f40a3f4",
    "1502784444187-359ac186c5bb",
    "1449158743715-0a90ebb6d2d8",
    "1502920917128-1aa500764cbd",
    "1506905925346-21bda4d32df4",
  ].map(img),
  river: [
    "1464822759023-fed622ff2c3b",
    "1520250497591-112f2f40a3f4",
    "1535827841776-24afc1e255ac",
    "1506905925346-21bda4d32df4",
    "1432405972618-c60b0225b8f9",
  ].map(img),
};

const TYPES = [
  "Villa",
  "Apartment",
  "Cottage",
  "Studio",
  "Bungalow",
  "Loft",
  "Homestay",
  "Penthouse",
  "Guesthouse",
];

const ADJECTIVES = [
  "Sunny",
  "Cosy",
  "Modern",
  "Charming",
  "Serene",
  "Spacious",
  "Boutique",
  "Rustic",
  "Elegant",
];

// Two description templates per vibe so listings within a city read differently.
// Placeholders: {type} (lowercased property type) and {area} (neighbourhood).
const DESCRIPTIONS = {
  beach: [
    "Steps from the sand, this {type} in {area} pairs easy beach access with sunset views and a breezy, laid-back feel.",
    "A bright {type} near {area} — slow mornings, seafood shacks, and long barefoot walks along the shore.",
  ],
  metro: [
    "A comfortable {type} in {area}, close to the city's cafes, offices, and metro — an easy base for work or weekend exploring.",
    "Right in the thick of {area}, this {type} puts restaurants, markets, and nightlife on your doorstep.",
  ],
  heritage: [
    "A characterful {type} in {area} with old-world detail, near the bazaars, monuments, and street food of the old city.",
    "Soak up the history of {area} from this {type} — carved balconies, quiet courtyards, and landmarks a short stroll away.",
  ],
  lake: [
    "A serene {type} near {area} with views over the water, made for unwinding to lakeside sunsets and palace silhouettes.",
    "Wake to shimmering water at this {type} in {area}, a calm retreat a short walk from the ghats and old city.",
  ],
  mountain: [
    "A snug {type} in {area} ringed by pine and peaks — a cosy base for Himalayan treks, cafes, and crisp mountain air.",
    "Tucked into the hills at {area}, this {type} offers wood fires, valley views, and easy access to the trails.",
  ],
  river: [
    "A peaceful {type} near {area} overlooking the Ganga, with yoga decks, riverside walks, and the calm of the foothills.",
    "Find your calm at this {type} in {area} — morning yoga, river rafting nearby, and the sound of the Ganga at dusk.",
  ],
  backwater: [
    "A waterfront {type} in {area} on the Kerala backwaters, with swaying palms, canal views, and a slow, restful pace.",
    "A breezy {type} in {area} blending colonial charm and backwater calm, near cafes, art spaces, and the sea.",
  ],
};

// Each city: the exact picker name, a vibe (drives the description + price band),
// and nine neighbourhoods so generated titles stay distinct within the city.
const CITIES = [
  {
    name: "Goa",
    vibe: "beach",
    base: 3500,
    areas: [
      "Baga",
      "Calangute",
      "Anjuna",
      "Candolim",
      "Palolem",
      "Vagator",
      "Morjim",
      "Assagao",
      "Panaji",
    ],
  },
  {
    name: "Mumbai",
    vibe: "metro",
    base: 3200,
    areas: [
      "Bandra",
      "Colaba",
      "Juhu",
      "Andheri",
      "Worli",
      "Powai",
      "Marine Drive",
      "Lower Parel",
      "Versova",
    ],
  },
  {
    name: "New Delhi",
    vibe: "heritage",
    base: 3000,
    areas: [
      "Hauz Khas",
      "Chandni Chowk",
      "Connaught Place",
      "Saket",
      "Vasant Vihar",
      "Karol Bagh",
      "Defence Colony",
      "Lajpat Nagar",
      "Dwarka",
    ],
  },
  {
    name: "Noida",
    vibe: "metro",
    base: 2400,
    areas: [
      "Sector 18",
      "Sector 62",
      "Sector 137",
      "Sector 50",
      "Sector 76",
      "Sector 15",
      "Sector 93",
      "Sector 44",
      "Sector 128",
    ],
  },
  {
    name: "Bengaluru",
    vibe: "metro",
    base: 3000,
    areas: [
      "Indiranagar",
      "Koramangala",
      "Whitefield",
      "Jayanagar",
      "HSR Layout",
      "MG Road",
      "Malleshwaram",
      "Electronic City",
      "Hebbal",
    ],
  },
  {
    name: "Jaipur",
    vibe: "heritage",
    base: 3000,
    areas: [
      "Amber",
      "Civil Lines",
      "C-Scheme",
      "Bani Park",
      "Malviya Nagar",
      "Hawa Mahal Road",
      "Jhotwara",
      "Vaishali Nagar",
      "Tonk Road",
    ],
  },
  {
    name: "Udaipur",
    vibe: "lake",
    base: 3600,
    areas: [
      "Lake Pichola",
      "Fateh Sagar",
      "Hanuman Ghat",
      "City Palace Road",
      "Ambrai",
      "Sajjangarh",
      "Gulab Bagh",
      "Sukhadia Circle",
      "Badi",
    ],
  },
  {
    name: "Manali",
    vibe: "mountain",
    base: 2200,
    areas: [
      "Old Manali",
      "Vashisht",
      "Hadimba",
      "Solang",
      "Naggar",
      "Prini",
      "Burwa",
      "Aleo",
      "Manu Market",
    ],
  },
  {
    name: "Rishikesh",
    vibe: "river",
    base: 2000,
    areas: [
      "Lakshman Jhula",
      "Ram Jhula",
      "Tapovan",
      "Swarg Ashram",
      "Muni Ki Reti",
      "Shivpuri",
      "Brahmapuri",
      "Triveni Ghat",
      "Neelkanth Road",
    ],
  },
  {
    name: "Kochi",
    vibe: "backwater",
    base: 2800,
    areas: [
      "Fort Kochi",
      "Mattancherry",
      "Marine Drive",
      "Vyttila",
      "Willingdon Island",
      "Cherai",
      "Kumbalangi",
      "Panampilly Nagar",
      "Edappally",
    ],
  },
  {
    name: "Hyderabad",
    vibe: "metro",
    base: 2600,
    areas: [
      "Banjara Hills",
      "Jubilee Hills",
      "HITEC City",
      "Gachibowli",
      "Charminar",
      "Secunderabad",
      "Madhapur",
      "Kondapur",
      "Begumpet",
    ],
  },
  {
    name: "Kolkata",
    vibe: "heritage",
    base: 2400,
    areas: [
      "Park Street",
      "Salt Lake",
      "New Town",
      "Ballygunge",
      "Alipore",
      "Howrah",
      "College Street",
      "Esplanade",
      "Tollygunge",
    ],
  },
];

// Map a listing's vibe + property type onto the home page's browse categories
// (kept in sync with the CategoryStrip in pages/ListingsIndex.tsx). Multi-tag: a
// listing can land in several at once — a Goa villa is both "Villas" and
// "Beachfront" — so all seven categories stay populated. Every vibe yields at
// least one tag, so no listing is left uncategorised.
function categoriesFor(vibe, type) {
  const cats = new Set();
  if (type === "Villa" || type === "Bungalow") cats.add("Villas");
  if (type === "Studio" || type === "Loft") cats.add("Tiny Homes");
  if (type === "Cottage") cats.add("Cabins & Treehouses");
  if (vibe === "beach" || vibe === "backwater") cats.add("Beachfront");
  if (vibe === "metro" || vibe === "heritage") cats.add("Top Cities");
  if (vibe === "mountain") {
    cats.add("Cabins & Treehouses");
    cats.add("Nature");
  }
  if (vibe === "lake" || vibe === "river") {
    cats.add("Lakefront");
    cats.add("Nature");
  }
  return [...cats];
}

const sampleListings = CITIES.flatMap((city, cityIndex) =>
  Array.from({ length: PER_CITY }, (_, i) => {
    const type = TYPES[i % TYPES.length];
    const adjective = ADJECTIVES[i % ADJECTIVES.length];
    const area = city.areas[i % city.areas.length];
    const templates = DESCRIPTIONS[city.vibe];
    const description = templates[i % templates.length]
      .replaceAll("{type}", type.toLowerCase())
      .replaceAll("{area}", area);

    // Pick a vibe-appropriate photo, advanced by a global index so listings that
    // share a vibe across cities don't all land on the same image.
    const pool = IMAGES[city.vibe];
    const url = pool[(cityIndex * PER_CITY + i) % pool.length];

    return {
      title: `${adjective} ${type} in ${area}`,
      description,
      image: { filename: "listingimage", url },
      price: city.base + i * 150,
      location: city.name,
      country: "India",
      categories: categoriesFor(city.vibe, type),
    };
  }),
);

module.exports = { data: sampleListings };
