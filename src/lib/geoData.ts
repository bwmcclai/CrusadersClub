// ─── Geographic Reference Data ───────────────────────────────────────────────
// ISO 3166-1 numeric codes → country names
// These IDs match world-atlas@2 countries-50m.json feature IDs

export type ContinentId =
  | 'north-america'
  | 'south-america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'oceania'

export const COUNTRY_NAMES: Record<number, string> = {
  4:   'Afghanistan',
  8:   'Albania',
  12:  'Algeria',
  24:  'Angola',
  32:  'Argentina',
  36:  'Australia',
  40:  'Austria',
  50:  'Bangladesh',
  56:  'Belgium',
  64:  'Bhutan',
  68:  'Bolivia',
  70:  'Bosnia & Herz.',
  72:  'Botswana',
  76:  'Brazil',
  84:  'Belize',
  96:  'Brunei',
  100: 'Bulgaria',
  104: 'Myanmar',
  108: 'Burundi',
  112: 'Belarus',
  116: 'Cambodia',
  120: 'Cameroon',
  124: 'Canada',
  132: 'Cape Verde',
  140: 'Central African Rep.',
  144: 'Sri Lanka',
  148: 'Chad',
  152: 'Chile',
  156: 'China',
  170: 'Colombia',
  174: 'Comoros',
  178: 'Congo',
  180: 'DR Congo',
  188: 'Costa Rica',
  191: 'Croatia',
  192: 'Cuba',
  196: 'Cyprus',
  203: 'Czech Republic',
  204: 'Benin',
  208: 'Denmark',
  212: 'Dominica',
  214: 'Dominican Rep.',
  218: 'Ecuador',
  222: 'El Salvador',
  226: 'Equatorial Guinea',
  231: 'Ethiopia',
  232: 'Eritrea',
  233: 'Estonia',
  238: 'Falkland Islands',
  242: 'Fiji',
  246: 'Finland',
  250: 'France',
  262: 'Djibouti',
  266: 'Gabon',
  268: 'Georgia',
  270: 'Gambia',
  276: 'Germany',
  288: 'Ghana',
  296: 'Kiribati',
  300: 'Greece',
  304: 'Greenland',
  308: 'Grenada',
  320: 'Guatemala',
  324: 'Guinea',
  328: 'Guyana',
  332: 'Haiti',
  336: 'Vatican City',
  340: 'Honduras',
  344: 'Hong Kong',
  348: 'Hungary',
  352: 'Iceland',
  356: 'India',
  360: 'Indonesia',
  364: 'Iran',
  368: 'Iraq',
  372: 'Ireland',
  376: 'Israel',
  380: 'Italy',
  388: 'Jamaica',
  392: 'Japan',
  398: 'Kazakhstan',
  400: 'Jordan',
  404: 'Kenya',
  408: 'North Korea',
  410: 'South Korea',
  414: 'Kuwait',
  417: 'Kyrgyzstan',
  418: 'Laos',
  422: 'Lebanon',
  426: 'Lesotho',
  428: 'Latvia',
  430: 'Liberia',
  434: 'Libya',
  438: 'Liechtenstein',
  440: 'Lithuania',
  442: 'Luxembourg',
  450: 'Madagascar',
  454: 'Malawi',
  458: 'Malaysia',
  462: 'Maldives',
  466: 'Mali',
  470: 'Malta',
  478: 'Mauritania',
  480: 'Mauritius',
  484: 'Mexico',
  492: 'Monaco',
  496: 'Mongolia',
  498: 'Moldova',
  499: 'Montenegro',
  504: 'Morocco',
  508: 'Mozambique',
  516: 'Namibia',
  524: 'Nepal',
  528: 'Netherlands',
  540: 'New Caledonia',
  548: 'Vanuatu',
  554: 'New Zealand',
  558: 'Nicaragua',
  562: 'Niger',
  566: 'Nigeria',
  578: 'Norway',
  583: 'Micronesia',
  584: 'Marshall Islands',
  585: 'Palau',
  586: 'Pakistan',
  591: 'Panama',
  598: 'Papua New Guinea',
  600: 'Paraguay',
  604: 'Peru',
  608: 'Philippines',
  616: 'Poland',
  620: 'Portugal',
  624: 'Guinea-Bissau',
  626: 'Timor-Leste',
  630: 'Puerto Rico',
  634: 'Qatar',
  642: 'Romania',
  643: 'Russia',
  646: 'Rwanda',
  678: 'São Tomé & Príncipe',
  682: 'Saudi Arabia',
  686: 'Senegal',
  688: 'Serbia',
  694: 'Sierra Leone',
  702: 'Singapore',
  703: 'Slovakia',
  705: 'Slovenia',
  706: 'Somalia',
  710: 'South Africa',
  716: 'Zimbabwe',
  724: 'Spain',
  728: 'South Sudan',
  729: 'Sudan',
  740: 'Suriname',
  748: 'Eswatini',
  752: 'Sweden',
  756: 'Switzerland',
  760: 'Syria',
  762: 'Tajikistan',
  764: 'Thailand',
  768: 'Togo',
  776: 'Tonga',
  780: 'Trinidad & Tobago',
  784: 'United Arab Emirates',
  788: 'Tunisia',
  792: 'Turkey',
  795: 'Turkmenistan',
  798: 'Tuvalu',
  800: 'Uganda',
  804: 'Ukraine',
  807: 'North Macedonia',
  818: 'Egypt',
  826: 'United Kingdom',
  834: 'Tanzania',
  840: 'United States',
  854: 'Burkina Faso',
  858: 'Uruguay',
  860: 'Uzbekistan',
  862: 'Venezuela',
  882: 'Samoa',
  887: 'Yemen',
  894: 'Zambia',
  // Additional territories often in world-atlas
  31:  'Azerbaijan',
  51:  'Armenia',
  90:  'Solomon Islands',
  158: 'Taiwan',
  275: 'Palestine',
  512: 'Oman',
  674: 'San Marino',
  704: 'Vietnam',
}

// ─── Continent → ISO codes ────────────────────────────────────────────────────

export const CONTINENT_COUNTRIES: Record<ContinentId, number[]> = {
  'north-america': [
    124,  // Canada
    840,  // United States
    484,  // Mexico
    84,   // Belize
    320,  // Guatemala
    340,  // Honduras
    222,  // El Salvador
    558,  // Nicaragua
    188,  // Costa Rica
    591,  // Panama
    192,  // Cuba
    332,  // Haiti
    214,  // Dominican Republic
    388,  // Jamaica
    780,  // Trinidad & Tobago
    304,  // Greenland
  ],
  'south-america': [
    76,   // Brazil
    32,   // Argentina
    152,  // Chile
    604,  // Peru
    170,  // Colombia
    862,  // Venezuela
    858,  // Uruguay
    600,  // Paraguay
    68,   // Bolivia
    218,  // Ecuador
    328,  // Guyana
    740,  // Suriname
    630,  // Puerto Rico (loosely grouped)
  ],
  'europe': [
    250,  // France
    276,  // Germany
    380,  // Italy
    724,  // Spain
    620,  // Portugal
    826,  // United Kingdom
    372,  // Ireland
    528,  // Netherlands
    56,   // Belgium
    756,  // Switzerland
    40,   // Austria
    578,  // Norway
    752,  // Sweden
    246,  // Finland
    208,  // Denmark
    616,  // Poland
    203,  // Czech Republic
    703,  // Slovakia
    348,  // Hungary
    642,  // Romania
    100,  // Bulgaria
    300,  // Greece
    191,  // Croatia
    70,   // Bosnia & Herz.
    499,  // Montenegro
    705,  // Slovenia
    807,  // North Macedonia
    8,    // Albania
    688,  // Serbia
    804,  // Ukraine
    112,  // Belarus
    233,  // Estonia
    428,  // Latvia
    440,  // Lithuania
    498,  // Moldova
    196,  // Cyprus
    352,  // Iceland
    442,  // Luxembourg
    470,  // Malta
    492,  // Monaco
    674,  // San Marino
    336,  // Vatican City
    438,  // Liechtenstein
  ],
  'africa': [
    12,   // Algeria
    818,  // Egypt
    434,  // Libya
    504,  // Morocco
    788,  // Tunisia
    729,  // Sudan
    231,  // Ethiopia
    706,  // Somalia
    404,  // Kenya
    800,  // Uganda
    646,  // Rwanda
    108,  // Burundi
    834,  // Tanzania
    454,  // Malawi
    508,  // Mozambique
    716,  // Zimbabwe
    710,  // South Africa
    748,  // Eswatini
    426,  // Lesotho
    516,  // Namibia
    72,   // Botswana
    894,  // Zambia
    728,  // South Sudan
    180,  // DR Congo
    178,  // Congo
    266,  // Gabon
    120,  // Cameroon
    566,  // Nigeria
    562,  // Niger
    466,  // Mali
    854,  // Burkina Faso
    288,  // Ghana
    384,  // Côte d'Ivoire
    694,  // Sierra Leone
    324,  // Guinea
    686,  // Senegal
    204,  // Benin
    768,  // Togo
    478,  // Mauritania
    262,  // Djibouti
    232,  // Eritrea
    140,  // Central African Rep.
    24,   // Angola
    450,  // Madagascar
    148,  // Chad
    624,  // Guinea-Bissau
    270,  // Gambia
    132,  // Cape Verde
    174,  // Comoros
    480,  // Mauritius
    678,  // São Tomé & Príncipe
    226,  // Equatorial Guinea
    430,  // Liberia
  ],
  'asia': [
    156,  // China
    356,  // India
    392,  // Japan
    410,  // South Korea
    408,  // North Korea
    643,  // Russia
    792,  // Turkey
    364,  // Iran
    368,  // Iraq
    682,  // Saudi Arabia
    400,  // Jordan
    422,  // Lebanon
    376,  // Israel
    760,  // Syria
    784,  // United Arab Emirates
    414,  // Kuwait
    512,  // Oman
    634,  // Qatar
    48,   // Bahrain
    887,  // Yemen
    586,  // Pakistan
    50,   // Bangladesh
    144,  // Sri Lanka
    462,  // Maldives
    524,  // Nepal
    64,   // Bhutan
    104,  // Myanmar
    764,  // Thailand
    116,  // Cambodia
    418,  // Laos
    704,  // Vietnam
    458,  // Malaysia
    360,  // Indonesia
    608,  // Philippines
    702,  // Singapore
    96,   // Brunei
    398,  // Kazakhstan
    860,  // Uzbekistan
    762,  // Tajikistan
    417,  // Kyrgyzstan
    795,  // Turkmenistan
    4,    // Afghanistan
    496,  // Mongolia
    51,   // Armenia
    268,  // Georgia
    31,   // Azerbaijan
    275,  // Palestine
    158,  // Taiwan
    344,  // Hong Kong
    626,  // Timor-Leste
  ],
  'oceania': [
    36,   // Australia
    554,  // New Zealand
    598,  // Papua New Guinea
    242,  // Fiji
    548,  // Vanuatu
    90,   // Solomon Islands
    776,  // Tonga
    882,  // Samoa
    798,  // Tuvalu
    583,  // Micronesia
    585,  // Palau
    584,  // Marshall Islands
    540,  // New Caledonia
    296,  // Kiribati
  ],
}

// ─── Continent labels & centroids (lon, lat) for globe overlay ────────────────

export const CONTINENT_INFO: Record<ContinentId, {
  label:    string
  centroid: [number, number]   // [longitude, latitude]
  color:    string
}> = {
  'north-america': { label: 'North America', centroid: [-100,  45], color: '#E87C3E' },
  'south-america': { label: 'South America', centroid: [  -58, -15], color: '#2EC472' },
  'europe':        { label: 'Europe',         centroid: [   15,  54], color: '#3A9BD5' },
  'africa':        { label: 'Africa',         centroid: [   22,   5], color: '#E8C63E' },
  'asia':          { label: 'Asia',           centroid: [   90,  45], color: '#C94040' },
  'oceania':       { label: 'Oceania',        centroid: [  140, -25], color: '#9B59B6' },
}

// ─── Reverse lookup: ISO id → continent ──────────────────────────────────────

const COUNTRY_TO_CONTINENT = new Map<number, ContinentId>()
for (const [cont, ids] of Object.entries(CONTINENT_COUNTRIES)) {
  for (const id of ids) {
    COUNTRY_TO_CONTINENT.set(id, cont as ContinentId)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCountryName(id: number): string {
  return COUNTRY_NAMES[id] ?? `Territory ${id}`
}

export function getContinent(id: number): ContinentId | null {
  return COUNTRY_TO_CONTINENT.get(id) ?? null
}

export function getContinentCountryIds(continent: ContinentId): number[] {
  return CONTINENT_COUNTRIES[continent]
}
