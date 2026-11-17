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
app.get("/api/image-proxy", async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) {
    return res.status(400).send("Invalid image URL");
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
app.get("/api/recent-tracks", async (req, res) => {
  const now = Date.now();
  const simulateError = req.query.simulate_error === "true" || req.query.simulate_error === "1";

  // Demo tool: simulate Last.fm failure if requested
  if (simulateError) {
    console.log("[API] Simulating Last.fm service outage as requested via ?simulate_error=true");
    if (tracksCache.data) {
      return res.status(200).json({
        ...tracksCache.data,
        fromCache: true,
        stale: true,
        warning: "Simulation de panne : Last.fm est inaccessible. Données de secours en cache affichées."
      });
    }
    return res.status(503).json({
      success: false,
      error: "Service Last.fm temporairement indisponible (Simulation de panne active).",
      fromCache: false
    });
  }

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
    console.log(`[Last.fm] MISS -> Fetching live scrobbles for user "${LASTFM_USER}"...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
      LASTFM_USER
    )}&api_key=${LASTFM_API_KEY}&format=json&limit=24`;

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

    // Transform and classify tracks
    const tracks = tracksArray.map((t, index) => {
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
      const proxiedImageUrl = imageUrl ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}` : "";

      const tags = artistTagsMap.get(artistName.toLowerCase()) || [];
      const stage = classifyTrack(artistName, tags);

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

    const result = {
      success: true,
      user: LASTFM_USER,
      totalScrobbles: payload.recenttracks?.["@attr"]?.total || tracks.length,
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

// Vendor scripts (Three.js and OrbitControls directly from node_modules)
app.get("/vendor/three.module.js", (req, res) => {
  res.sendFile(path.join(rootDir, "node_modules", "three", "build", "three.module.js"));
});

app.get("/vendor/OrbitControls.js", (req, res) => {
  res.sendFile(
    path.join(rootDir, "node_modules", "three", "examples", "jsm", "controls", "OrbitControls.js")
  );
});

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
