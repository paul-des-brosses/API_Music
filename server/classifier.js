/**
 * Music Genre & Festival Stage Classifier
 * Maps Last.fm tags to one of the 5 Festival Zones.
 */

export const STAGES = {
  TECHNO: {
    id: "TECHNO",
    name: "The Neon Warehouse",
    subtitle: "Rave & Electronic Bunker",
    position: { x: -32, y: 0, z: -25 },
    color: "#00f0ff",
    secondaryColor: "#ff007f",
    ambientLight: 0x00f0ff,
    description: "Bass puissantes, lasers néon et fumée cyberpunk. Scène de l'électro, techno, hardtek et trance."
  },
  RAP: {
    id: "RAP",
    name: "The Block Party",
    subtitle: "Urban Skyline & Hip-Hop",
    position: { x: 32, y: 0, z: -25 },
    color: "#ffaa00",
    secondaryColor: "#ff4400",
    ambientLight: 0xffaa00,
    description: "Briques rouges, néons dorés et caissons de basses. Scène du rap, hip-hop et trap."
  },
  REGGAE: {
    id: "REGGAE",
    name: "Sunken Beach Oasis",
    subtitle: "Chill & Roots Island",
    position: { x: 35, y: 0, z: 25 },
    color: "#2ecc71",
    secondaryColor: "#f1c40f",
    ambientLight: 0x2ecc71,
    description: "Palmiers, sable fin et soleil couchant. Espace dub, reggae et sons acoustiques chill."
  },
  CLASSICAL: {
    id: "CLASSICAL",
    name: "The Crystal Amphitheater",
    subtitle: "Symphonic & Ambient Dome",
    position: { x: -32, y: 0, z: 25 },
    color: "#9b59b6",
    secondaryColor: "#3498db",
    ambientLight: 0x9b59b6,
    description: "Colonnes de marbre et verrière étoilée. Sanctuaire du classique, des musiques de film et du piano."
  },
  ROCK_METAL: {
    id: "ROCK_METAL",
    name: "The Volcanic Pit",
    subtitle: "Heavy Metal & Hard Rock",
    position: { x: -45, y: 0, z: 0 },
    color: "#e74c3c",
    secondaryColor: "#c0392b",
    ambientLight: 0xe74c3c,
    description: "Lave en fusion, structures métalliques rouillées et pyrotechnie. Scène rock et metal."
  },
  MAINSTAGE: {
    id: "MAINSTAGE",
    name: "Mainstage Odyssey",
    subtitle: "Pop, Indie & Divers",
    position: { x: 0, y: 0, z: 0 },
    color: "#f39c12",
    secondaryColor: "#e67e22",
    ambientLight: 0xffffff,
    description: "L'arche centrale du festival. Scène éclectique pour la pop, l'indie et les grands classiques."
  }
};

const GENRE_RULES = [
  {
    stage: "TECHNO",
    keywords: [
      "techno", "electro", "electronic", "hardtek", "frenchcore", "trance",
      "edm", "house", "acid", "drum and bass", "dnb", "synthwave", "gabber",
      "dance", "dubstep", "industrial", "idm", "ambient techno"
    ]
  },
  {
    stage: "RAP",
    keywords: [
      "rap", "hip-hop", "hip hop", "french rap", "rap francais", "trap",
      "drill", "boom bap", "cloud rap", "r&b", "rnb", "urban", "grime"
    ]
  },
  {
    stage: "REGGAE",
    keywords: [
      "reggae", "dub", "roots reggae", "ska", "dancehall", "ragga", "lovers rock", "chillout", "calypso"
    ]
  },
  {
    stage: "CLASSICAL",
    keywords: [
      "classical", "baroque", "romantic", "symphony", "instrumental",
      "soundtrack", "ost", "score", "piano", "orchestra", "opera", "contemporary classical"
    ]
  },
  {
    stage: "ROCK_METAL",
    keywords: [
      "metal", "heavy metal", "rock", "hard rock", "punk", "metalcore",
      "death metal", "black metal", "grunge", "thrash metal", "nu metal"
    ]
  },
  {
    stage: "MAINSTAGE",
    keywords: [
      "pop", "indie", "alternative", "singer-songwriter", "folk", "soul", "funk", "disco"
    ]
  }
];

// Fallback known artists dictionary to guarantee instant, accurate placement
export const KNOWN_ARTISTS = {
  "billx": "TECHNO",
  "billx et gargäntua": "TECHNO",
  "gargäntua": "TECHNO",
  "daft punk": "TECHNO",
  "charlotte de witte": "TECHNO",
  "amelie lens": "TECHNO",
  "paul kalkbrenner": "TECHNO",
  "gesaffelstein": "TECHNO",
  "justice": "TECHNO",
  "around the world": "TECHNO",
  
  "vald": "RAP",
  "sdm": "RAP",
  "luv resval": "RAP",
  "damso": "RAP",
  "booba": "RAP",
  "freeze corleone": "RAP",
  "jul": "RAP",
  "nekfeu": "RAP",
  "eminem": "RAP",
  "travis scott": "RAP",
  "kendrick lamar": "RAP",
  
  "bob marley": "REGGAE",
  "bob marley & the wailers": "REGGAE",
  "tiken jah fakoly": "REGGAE",
  "dub inc": "REGGAE",
  "danakil": "REGGAE",
  
  "wolfgang amadeus mozart": "CLASSICAL",
  "mozart": "CLASSICAL",
  "ludwig van beethoven": "CLASSICAL",
  "beethoven": "CLASSICAL",
  "johann sebastian bach": "CLASSICAL",
  "bach": "CLASSICAL",
  "hans zimmer": "CLASSICAL",
  "chopin": "CLASSICAL",
  "frederic chopin": "CLASSICAL",
  
  "gojira": "ROCK_METAL",
  "metallica": "ROCK_METAL",
  "iron maiden": "ROCK_METAL",
  "rammstein": "ROCK_METAL",
  "nirvana": "ROCK_METAL",
  "ac/dc": "ROCK_METAL"
};

/**
 * Classifies an artist based on known artist list or Last.fm tags
 * @param {string} artistName
 * @param {Array<string>} tags
 * @returns {object} Stage metadata
 */
export function classifyTrack(artistName, tags = []) {
  const normalizedArtist = (artistName || "").trim().toLowerCase();

  // 1. Direct dictionary match
  if (KNOWN_ARTISTS[normalizedArtist]) {
    const stageKey = KNOWN_ARTISTS[normalizedArtist];
    return STAGES[stageKey];
  }

  // Partial match in known artists
  for (const [knownName, stageKey] of Object.entries(KNOWN_ARTISTS)) {
    if (normalizedArtist.includes(knownName) || knownName.includes(normalizedArtist)) {
      return STAGES[stageKey];
    }
  }

  // 2. Score by tags
  const scores = {
    TECHNO: 0,
    RAP: 0,
    REGGAE: 0,
    CLASSICAL: 0,
    ROCK_METAL: 0,
    MAINSTAGE: 0
  };

  const normalizedTags = tags.map(t => (typeof t === "string" ? t : t.name || "").toLowerCase());

  for (const tag of normalizedTags) {
    for (const rule of GENRE_RULES) {
      for (const kw of rule.keywords) {
        if (tag === kw) {
          scores[rule.stage] += 3;
        } else if (tag.includes(kw)) {
          scores[rule.stage] += 1;
        }
      }
    }
  }

  let bestStage = "MAINSTAGE";
  let maxScore = 0;

  for (const [stage, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestStage = stage;
    }
  }

  return STAGES[bestStage];
}
