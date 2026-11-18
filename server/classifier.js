/**
 * Music Genre & Festival Stage Classifier
 * Maps Last.fm tags to one of the 5 Festival Zones.
 */

export const MASTERCLASS_STAGE = {
  id: "MASTERCLASS",
  name: "🏆 Masterclass — Place Centrale",
  subtitle: "Trophée d'Honneur",
  position: { x: 0, y: 0, z: 0 },
  color: "#ffd700",
  secondaryColor: "#ff9900",
  ambientLight: 0xffd700,
  description: "Le cœur du festival : récompense ultime attribuée à une véritable masterclass."
};

export const STAGES = {
  TECHNO: {
    id: "TECHNO",
    name: "The Neon Warehouse",
    subtitle: "Rave & Electronic Bunker",
    position: { x: 0, y: 0, z: -26 },
    color: "#00f0ff",
    secondaryColor: "#ff007f",
    ambientLight: 0x00f0ff,
    description: "Bass puissantes, lasers néon et fumée cyberpunk. Scène de l'électro, techno, hardtek et trance."
  },
  RAP: {
    id: "RAP",
    name: "The Urban Party",
    subtitle: "Urban Skyline & Hip-Hop",
    position: { x: 25, y: 0, z: -8 },
    color: "#ffaa00",
    secondaryColor: "#ff4400",
    ambientLight: 0xffaa00,
    description: "Briques rouges, néons dorés et caissons de basses. Scène du rap, hip-hop et trap."
  },
  REGGAE: {
    id: "REGGAE",
    name: "Sunken Beach Oasis",
    subtitle: "Chill & Roots Island",
    position: { x: 15, y: 0, z: 21 },
    color: "#2ecc71",
    secondaryColor: "#f1c40f",
    ambientLight: 0x2ecc71,
    description: "Palmiers, sable fin et soleil couchant. Espace dub, reggae et sons acoustiques chill."
  },
  CLASSICAL: {
    id: "CLASSICAL",
    name: "The Crystal Amphitheater",
    subtitle: "Symphonic & Ambient Dome",
    position: { x: -15, y: 0, z: 21 },
    color: "#9b59b6",
    secondaryColor: "#3498db",
    ambientLight: 0x9b59b6,
    description: "Colonnes de marbre et verrière étoilée. Sanctuaire du classique, des musiques de film et du piano."
  },
  ROCK_METAL: {
    id: "ROCK_METAL",
    name: "The Volcanic Pit",
    subtitle: "Heavy Metal & Hard Rock",
    position: { x: -25, y: 0, z: -8 },
    color: "#e74c3c",
    secondaryColor: "#c0392b",
    ambientLight: 0xe74c3c,
    description: "Lave en fusion, structures métalliques rouillées et pyrotechnie. Scène rock et metal."
  }
};

const GENRE_RULES = [
  {
    stage: "TECHNO",
    keywords: [
      "techno", "electro", "electronic", "hardtek", "frenchcore", "trance",
      "edm", "house", "acid", "drum and bass", "dnb", "synthwave", "gabber",
      "dance", "dubstep", "industrial", "idm", "ambient techno", "hardstyle"
    ]
  },
  {
    stage: "RAP",
    keywords: [
      "rap", "hip-hop", "hip hop", "french rap", "rap francais", "rap fr", "trap",
      "drill", "boom bap", "cloud rap", "r&b", "rnb", "urban", "grime", "pop rap"
    ]
  },
  {
    stage: "REGGAE",
    keywords: [
      "reggae", "dub", "roots reggae", "ska", "dancehall", "ragga", "lovers rock"
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
      "death metal", "black metal", "grunge", "thrash metal", "nu metal", "indie rock"
    ]
  }
];

// Reference known artists dictionary to guarantee instant, 100% accurate placement
export const KNOWN_ARTISTS = {
  // Techno / Electronic
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
  "jeckyll": "TECHNO",
  "jeckyll & hyde": "TECHNO",
  
  // Rap / Urban
  "plk": "RAP",
  "werenoi": "RAP",
  "oboy": "RAP",
  "orelsan": "RAP",
  "orelsan et sdm": "RAP",
  "vald": "RAP",
  "sdm": "RAP",
  "luv resval": "RAP",
  "damso": "RAP",
  "booba": "RAP",
  "freeze corleone": "RAP",
  "jul": "RAP",
  "nekfeu": "RAP",
  "ninho": "RAP",
  "gazo": "RAP",
  "tiakola": "RAP",
  "sch": "RAP",
  "dinos": "RAP",
  "josman": "RAP",
  "laylow": "RAP",
  "hamza": "RAP",
  "eminem": "RAP",
  "travis scott": "RAP",
  "kendrick lamar": "RAP",
  
  // Reggae / Dub (Codé en dur comme demandé)
  "bob marley": "REGGAE",
  "bob marley & the wailers": "REGGAE",
  "danakil": "REGGAE",
  "yaniss odua": "REGGAE",
  "cozik": "REGGAE",
  "tiken jah fakoly": "REGGAE",
  "dub inc": "REGGAE",
  "biga ranx": "REGGAE",
  "biga*ranx": "REGGAE",
  
  // Classical / Symphonic / Film Scores
  "wolfgang amadeus mozart": "CLASSICAL",
  "mozart": "CLASSICAL",
  "ludwig van beethoven": "CLASSICAL",
  "beethoven": "CLASSICAL",
  "johann sebastian bach": "CLASSICAL",
  "bach": "CLASSICAL",
  "hans zimmer": "CLASSICAL",
  "chopin": "CLASSICAL",
  "frederic chopin": "CLASSICAL",
  "antonio vivaldi": "CLASSICAL",
  "vivaldi": "CLASSICAL",
  "ludwig göransson": "CLASSICAL",
  "ludwig goransson": "CLASSICAL",
  
  // Metal / Rock
  "gojira": "ROCK_METAL",
  "metallica": "ROCK_METAL",
  "iron maiden": "ROCK_METAL",
  "rammstein": "ROCK_METAL",
  "nirvana": "ROCK_METAL",
  "ac/dc": "ROCK_METAL"
};

/**
 * Classifies an artist and track based on known artist dictionary, tags, and title keywords.
 * Computes a confidence score (0-100) and applies specific priority rules.
 * 
 * Rule: If a track has both RAP and REGGAE markers, RAP takes precedence.
 * 
 * @param {string} artistName
 * @param {string} trackName
 * @param {Array<string>} tags
 * @returns {object} { stage, confidence, matchType }
 */
export function classifyTrack(artistName, trackName = "", tags = []) {
  const normalizedArtist = (artistName || "").trim().toLowerCase();
  const normalizedTitle = (trackName || "").trim().toLowerCase();

  // 0. Masterclass centerpiece track (Place Centrale)
  if (normalizedArtist.includes("kavinsky") && normalizedTitle.includes("outsider")) {
    return {
      stage: MASTERCLASS_STAGE,
      confidence: 100,
      matchType: "MASTERCLASS"
    };
  }

  // 1. Direct dictionary match (Maximum confidence: 100%)
  if (KNOWN_ARTISTS[normalizedArtist]) {
    const stageKey = KNOWN_ARTISTS[normalizedArtist];
    return {
      stage: STAGES[stageKey],
      confidence: 100,
      matchType: "KNOWN_ARTIST"
    };
  }

  // Partial dictionary match (Confidence: 95%)
  for (const [knownName, stageKey] of Object.entries(KNOWN_ARTISTS)) {
    if (normalizedArtist.includes(knownName) || knownName.includes(normalizedArtist)) {
      return {
        stage: STAGES[stageKey],
        confidence: 95,
        matchType: "KNOWN_ARTIST_PARTIAL"
      };
    }
  }

  // 2. Score by tags and title keywords
  const scores = {
    TECHNO: 0,
    RAP: 0,
    REGGAE: 0,
    CLASSICAL: 0,
    ROCK_METAL: 0
  };

  const normalizedTags = tags.map((t) => (typeof t === "string" ? t : t.name || "").toLowerCase());

  // A. Score based on tags
  for (const tag of normalizedTags) {
    for (const rule of GENRE_RULES) {
      for (const kw of rule.keywords) {
        if (tag === kw) {
          scores[rule.stage] += 4;
        } else if (tag.includes(kw)) {
          scores[rule.stage] += 2;
        }
      }
    }
  }

  // B. Score based on track title clues
  for (const rule of GENRE_RULES) {
    for (const kw of rule.keywords) {
      if (kw.length >= 4 && normalizedTitle.includes(kw)) {
        scores[rule.stage] += 3;
      }
    }
  }

  // Specific title markers
  if (normalizedTitle.includes("remix") || normalizedTitle.includes("club mix") || normalizedTitle.includes("edit")) {
    scores.TECHNO += 3;
  }
  if (normalizedTitle.includes("freestyle") || normalizedTitle.includes("feat") || normalizedTitle.includes("ft.")) {
    scores.RAP += 2;
  }
  if (normalizedTitle.includes("symphony") || normalizedTitle.includes("concerto") || normalizedTitle.includes("orchestra")) {
    scores.CLASSICAL += 4;
  }

  // Determine stage strictly with highest score across all 5 genres
  let bestStage = "RAP"; // Default fallback if zero genre matches
  let maxScore = 0;
  let secondMaxScore = 0;

  for (const [stage, score] of Object.entries(scores)) {
    if (score > maxScore) {
      secondMaxScore = maxScore;
      maxScore = score;
      bestStage = stage;
    } else if (score > secondMaxScore) {
      secondMaxScore = score;
    }
  }

  // Calculate confidence score (25 to 95) based on score margin
  let confidence = 25;
  if (maxScore > 0) {
    const margin = maxScore - secondMaxScore;
    confidence = Math.min(95, Math.max(50, 55 + margin * 8 + maxScore * 2));
  }

  return {
    stage: STAGES[bestStage],
    confidence,
    matchType: maxScore > 0 ? "TAG_MATCH" : "FALLBACK"
  };
}
