import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { classifyTrack, STAGES, KNOWN_ARTISTS } from "./classifier.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || "60", 10);

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_USER = process.env.LASTFM_USER || "PaulGdB";

app.use(cors());
app.use(express.json());

// In-memory cache for recent tracks
let tracksCache = {
  data: null,
  timestamp: 0,
  hitCount: 0
};

// In-memory cache for artist tags to minimize Last.fm calls
const artistTagsCache = new Map();

// In-memory cache for proxied images (buffer + contentType)
const imageBufferCache = new Map();

/**
 * Image proxy endpoint to ensure ZERO requests leave the browser to Last.fm CDN.
 * Fulfills rule: "In the browser's Network tab, no request goes to Last.fm."
 */
const ALLOWED_IMAGE_HOSTS = ["lastfm.freetls.fastly.net", ".last.fm", ".audioscrobbler.com", ".fastly.net"];

app.get("/api/image-proxy", async (req, res) => {
  const imageUrl = req.query.url;
  let parsedUrl;
  try {
    parsedUrl = new URL(String(imageUrl || ""));
  } catch {
    return res.status(400).send("Invalid image URL");
  }
  const hostOk =
    (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
    ALLOWED_IMAGE_HOSTS.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(h));
  if (!hostOk) {
    return res.status(403).send("Disallowed image host");
  }

  if (imageBufferCache.has(imageUrl)) {
    const cachedImg = imageBufferCache.get(imageUrl);
    res.setHeader("Content-Type", cachedImg.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(cachedImg.buffer);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const imgRes = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);

    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Keep up to 100 images in memory
    if (imageBufferCache.size > 100) {
      const firstKey = imageBufferCache.keys().next().value;
      imageBufferCache.delete(firstKey);
    }
    imageBufferCache.set(imageUrl, { buffer, contentType });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(buffer);
  } catch (err) {
    console.warn(`[ImageProxy] Failed to fetch image ${imageUrl}:`, err.message);
    return res.status(502).send("Could not fetch remote image");
  }
});

/**
 * Audio preview (30s) via Deezer public API, fully proxied by this server
 * (no API key needed; browser never contacts Deezer or Last.fm directly).
 */
const previewCache = new Map();

app.get("/api/preview", async (req, res) => {
  const artist = String(req.query.artist || "").trim();
  const track = String(req.query.track || "").trim();
  if (!artist || !track) return res.status(400).json({ found: false, error: "Paramètres manquants" });

  const key = `${artist}|${track}`.toLowerCase();
  if (previewCache.has(key)) return res.json(previewCache.get(key));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const q = encodeURIComponent(`${artist} ${track}`);
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await r.json();
    const norm = (s) => (s || "").toLowerCase();
    const hit =
      (data.data || []).find(
        (d) => d.preview && norm(d.artist?.name).includes(norm(artist).split(" ")[0]) && norm(d.title).includes(norm(track).slice(0, 8))
      ) || (data.data || []).find((d) => d.preview);

    const result = hit
      ? { found: true, title: hit.title, artist: hit.artist?.name, audioUrl: `api/preview-audio?id=${hit.id}` }
      : { found: false };
    if (previewCache.size >= 200) {
      previewCache.delete(previewCache.keys().next().value);
    }
    previewCache.set(key, result);
    return res.json(result);
  } catch (err) {
    console.warn("[Preview] lookup failed:", err.message);
    return res.status(502).json({ found: false, error: "Service d'extraits indisponible" });
  }
});

app.get("/api/preview-audio", async (req, res) => {
  const id = String(req.query.id || "");
  if (!/^\d+$/.test(id)) return res.status(400).send("Invalid id");
  try {
    // Fetch a fresh signed preview URL (they expire quickly)
    const info = await (await fetch(`https://api.deezer.com/track/${id}`)).json();
    const url = info.preview;
    if (!url || !new URL(url).hostname.endsWith(".dzcdn.net")) return res.status(404).send("No preview");
    const audio = await fetch(url);
    if (!audio.ok) throw new Error(`HTTP ${audio.status}`);
    const buf = Buffer.from(await audio.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buf);
  } catch (err) {
    console.warn("[Preview] audio failed:", err.message);
    return res.status(502).send("Could not fetch audio");
  }
});

/**
 * Fetch top tags for an artist from Last.fm (fast non-blocking lookup)
 */
async function fetchArtistTags(artist) {
  if (!artist || !LASTFM_API_KEY) return [];
  const normalized = artist.trim().toLowerCase();

  // If already in known artists or cache, return immediately (0ms)
  if (KNOWN_ARTISTS[normalized] || artistTagsCache.has(normalized)) {
    return artistTagsCache.get(normalized) || [];
  }

  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(
      artist
    )}&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      artistTagsCache.set(normalized, []);
      return [];
    }

    const data = await res.json();
    const tagList = (data.toptags?.tag || []).slice(0, 5).map((t) => t.name);
    artistTagsCache.set(normalized, tagList);
    return tagList;
  } catch (err) {
    // Graceful fallback: classify without tags rather than stalling
    artistTagsCache.set(normalized, []);
    return [];
  }
}

/**
 * Endpoint: /api/recent-tracks
 * Fetches recent tracks from Last.fm, enriches them with genre/stage info, and caches the result.
 */
/**
 * Filters and selects at most `maxPerStage` (8) tracks per stage.
 * Prioritizes tracks with the highest classification confidence.
 * If exceeding maxPerStage on a stage, avoids repeating the same artist (diversity pass).
 */
function filterStageTracksWithDiversity(classifiedTracks, maxPerStage = 8) {
  const stageGroups = {};

  for (const track of classifiedTracks) {
    const sId = track.stage?.id || "REGGAE";
    if (!stageGroups[sId]) stageGroups[sId] = [];
    stageGroups[sId].push(track);
  }

  const finalTracks = [];

  for (const [stageId, bucket] of Object.entries(stageGroups)) {
    const stageLimit = stageId === "MASTERCLASS" ? 1 : maxPerStage;
    if (bucket.length <= stageLimit) {
      finalTracks.push(...bucket);
      continue;
    }

    // Sort by:
    // 1. Now Playing first (always keep what's currently playing)
    // 2. Highest confidence score DESC (priority on certain matches)
    // 3. Recency uts DESC
    bucket.sort((a, b) => {
      if (b.nowPlaying !== a.nowPlaying) return b.nowPlaying ? 1 : -1;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.uts - a.uts;
    });

    const selected = [];
    const seenArtists = new Set();
    const deferredTracks = [];

    // Pass 1: Select tracks from unique artists (diversity priority)
    for (const track of bucket) {
      const normArtist = (track.artist || "").trim().toLowerCase();
      if (!seenArtists.has(normArtist)) {
        seenArtists.add(normArtist);
        selected.push(track);
        if (selected.length === stageLimit) break;
      } else {
        deferredTracks.push(track);
      }
    }

    // Pass 2: If we still have slots under stageLimit, fill with highest confidence remaining tracks
    if (selected.length < stageLimit) {
      for (const track of deferredTracks) {
        selected.push(track);
        if (selected.length === stageLimit) break;
      }
    }

    finalTracks.push(...selected);
  }

  return finalTracks;
}

/**
 * Endpoint: /api/recent-tracks
 * Fetches up to 50 recent tracks from Last.fm, enriches them with genre/stage info,
 * selects up to 8 confident & diverse tracks per stage, and caches the result.
 */
app.get("/api/recent-tracks", async (req, res) => {
  const now = Date.now();

  // Check cache validity
  const cacheAge = (now - tracksCache.timestamp) / 1000;
  if (tracksCache.data && cacheAge < CACHE_TTL_SECONDS) {
    tracksCache.hitCount++;
    console.log(`[Cache] HIT (${cacheAge.toFixed(1)}s old, hits: ${tracksCache.hitCount})`);
    return res.json({
      ...tracksCache.data,
      fromCache: true,
      cacheAgeSeconds: Math.floor(cacheAge),
      cacheExpiresInSeconds: Math.max(0, Math.floor(CACHE_TTL_SECONDS - cacheAge)),
      cacheHitCount: tracksCache.hitCount
    });
  }

  // Validate API key
  if (!LASTFM_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "Clé API Last.fm manquante sur le serveur (vérifiez le fichier .env).",
      fromCache: false
    });
  }

  try {
    console.log(`[Last.fm] MISS -> Fetching up to 50 scrobbles for user "${LASTFM_USER}"...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    // Fetch up to 50 tracks to find deep matches and diversity
    const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
      LASTFM_USER
    )}&api_key=${LASTFM_API_KEY}&format=json&limit=50`;

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Erreur Last.fm HTTP ${response.status} (${response.statusText})`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(`Last.fm API: ${payload.message || "Erreur inconnue"}`);
    }

    const rawTracks = payload.recenttracks?.track || [];
    const tracksArray = Array.isArray(rawTracks) ? rawTracks : [rawTracks];

    // Find unique artists to fetch tags concurrently
    const uniqueArtists = [...new Set(tracksArray.map((t) => t.artist?.["#text"] || t.artist?.name || ""))].filter(
      Boolean
    );

    // Fetch tags in parallel (with tag caching)
    const tagsPromises = uniqueArtists.map(async (artist) => {
      const tags = await fetchArtistTags(artist);
      return [artist.toLowerCase(), tags];
    });
    const artistTagsEntries = await Promise.all(tagsPromises);
    const artistTagsMap = new Map(artistTagsEntries);

    // Transform and classify all 50 tracks
    const allClassifiedTracks = tracksArray.map((t, index) => {
      const artistName = t.artist?.["#text"] || t.artist?.name || "Artiste inconnu";
      const trackName = t.name || "Titre inconnu";
      const albumName = t.album?.["#text"] || t.album?.name || "Album non spécifié";
      const nowPlaying = t["@attr"]?.nowplaying === "true";

      // Select highest resolution image available
      let imageUrl = "";
      if (Array.isArray(t.image) && t.image.length > 0) {
        const extralarge = t.image.find((img) => img.size === "extralarge");
        const large = t.image.find((img) => img.size === "large");
        const medium = t.image.find((img) => img.size === "medium");
        imageUrl = extralarge?.["#text"] || large?.["#text"] || medium?.["#text"] || t.image[0]?.["#text"] || "";
      }

      // Route image via local server proxy so browser never touches Last.fm CDN
      const proxiedImageUrl = imageUrl ? `api/image-proxy?url=${encodeURIComponent(imageUrl)}` : "";

      const tags = artistTagsMap.get(artistName.toLowerCase()) || [];
      const classification = classifyTrack(artistName, trackName, tags);
      const stage = classification.stage;

      return {
        id: `track-${index}-${t.date?.uts || "now"}`,
        name: trackName,
        artist: artistName,
        album: albumName,
        image: proxiedImageUrl,
        originalImage: imageUrl,
        nowPlaying,
        dateText: t.date?.["#text"] || (nowPlaying ? "En cours d'écoute" : "Récemment"),
        uts: t.date?.uts ? parseInt(t.date.uts, 10) : Math.floor(Date.now() / 1000),
        url: t.url || `https://www.last.fm/music/${encodeURIComponent(artistName)}`,
        tags,
        confidence: classification.confidence,
        matchType: classification.matchType,
        stage: {
          id: stage.id,
          name: stage.name,
          subtitle: stage.subtitle,
          color: stage.color,
          secondaryColor: stage.secondaryColor,
          position: stage.position
        }
      };
    });

    // Select max 8 tracks per stage prioritized by confidence & diversity
    const tracks = filterStageTracksWithDiversity(allClassifiedTracks, 8);

    const result = {
      success: true,
      user: LASTFM_USER,
      totalScrobbles: payload.recenttracks?.["@attr"]?.total || tracks.length,
      scrobblesAnalyzed: allClassifiedTracks.length,
      tracksDisplayCount: tracks.length,
      maxPerStage: 8,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      cacheExpiresInSeconds: CACHE_TTL_SECONDS,
      stages: STAGES,
      tracks
    };

    // Update in-memory cache
    tracksCache = {
      data: result,
      timestamp: now,
      hitCount: 0
    };

    return res.json(result);
  } catch (error) {
    console.error("[Last.fm Error]", error.message);

    // If we have stale cache, serve it gracefully with warning
    if (tracksCache.data) {
      console.log("[Cache] Serving stale cache due to upstream error");
      return res.json({
        ...tracksCache.data,
        fromCache: true,
        stale: true,
        warning: `Last.fm inaccessible (${error.message}). Affichage des dernières données sauvegardées.`
      });
    }

    return res.status(502).json({
      success: false,
      error: `Impossible de joindre Last.fm : ${error.message}`,
      user: LASTFM_USER,
      tracks: []
    });
  }
});

// Endpoint: Purge cache
app.post("/api/cache/clear", (req, res) => {
  tracksCache = { data: null, timestamp: 0, hitCount: 0 };
  console.log("[Cache] Cache cleared manually");
  res.json({ success: true, message: "Cache serveur purgé avec succès." });
});

// Endpoint: Health check for Docker & monitoring
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    user: LASTFM_USER,
    hasApiKey: !!LASTFM_API_KEY,
    cached: !!tracksCache.data,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Serve Three.js build files and addons with correct MIME types
app.use(
  "/vendor/three/addons",
  express.static(path.join(rootDir, "node_modules", "three", "examples", "jsm"))
);
app.use(
  "/vendor/three",
  express.static(path.join(rootDir, "node_modules", "three", "build"))
);

// Serve frontend static assets from public/
app.use(express.static(path.join(rootDir, "public")));

// Fallback to index.html for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`=======================================================`);
  console.log(`🎶 FESTIVAL 3D MUSIC SERVER STARTED`);
  console.log(`🌐 Local URL:   http://localhost:${PORT}`);
  console.log(`👤 Last.fm User: ${LASTFM_USER}`);
  console.log(`⏱️  Cache TTL:   ${CACHE_TTL_SECONDS} seconds`);
  console.log(`=======================================================`);
});
