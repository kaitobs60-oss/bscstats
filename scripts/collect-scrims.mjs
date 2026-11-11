import crypto from "node:crypto";

const API_KEY = process.env.SUPERCELL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = (process.env.BRAWL_API_BASE_URL || "https://api.brawlstars.com/v1").replace(/\/$/, "");

if (!API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing SUPERCELL_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY GitHub secret.");
}

const roster = [
  { team: "FUT", nickname: "Angelboy", tag: "#9PCV9L982" },
  { team: "FUT", nickname: "Guesti", tag: "#2R0J1LJ9PP" },
  { team: "FUT", nickname: "Nob", tag: "#P2808PRC" },
  { team: "HMBLE", nickname: "Luki", tag: "#8V92UYCJ" },
  { team: "HMBLE", nickname: "Boss", tag: "#V89Y2GP0" },
  { team: "HMBLE", nickname: "Symantec", tag: "#YQUCCJ2" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const battleRows = new Map();

function playersForBattle(battle) {
  const groups = Array.isArray(battle.teams) ? battle.teams : (Array.isArray(battle.players) ? [battle.players] : []);
  return groups.flatMap((group, teamIndex) =>
    (Array.isArray(group) ? group : []).map((player) => ({
      tag: player.tag || null,
      name: player.name || null,
      teamIndex,
      brawler: player.brawler ? {
        id: player.brawler.id ?? null,
        name: player.brawler.name ?? null,
        power: player.brawler.power ?? null,
        trophies: player.brawler.trophies ?? null,
      } : null,
    }))
  );
}

function fingerprint(item, players) {
  const tags = players.map((p) => p.tag).filter(Boolean).sort();
  const seed = [
    item.battleTime || "",
    item.event?.id ?? "",
    item.battle?.mode || item.event?.mode || "",
    item.event?.map || "",
    tags.join(","),
  ].join("|");
  return crypto.createHash("sha256").update(seed).digest("hex");
}

async function apiGet(path) {
  return fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
}

async function resolvePlayerTag(player) {
  // Supercell player tags use 0, never the letter O. Normalize common O/0 typing mistakes.
  const tag = player.tag.toUpperCase().replace(/^#/, "").replace(/O/g, "0");
  const normalizedTag = `#${tag}`;
  const response = await apiGet(`/players/${encodeURIComponent(normalizedTag)}`);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    const error = new Error(`Player lookup failed for ${player.nickname} (${normalizedTag}): HTTP ${response.status} ${body}`);
    error.status = response.status;
    throw error;
  }
  const profile = await response.json();
  console.log(`Verified ${player.nickname} as ${normalizedTag} (API name: ${profile.name || "unknown"}).`);
  return { ...player, tag: normalizedTag };
}

async function getBattleLog(player) {
  const response = await apiGet(`/players/${encodeURIComponent(player.tag)}/battlelog`);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 400);
    const error = new Error(`Battle Log request failed for ${player.nickname}: HTTP ${response.status} ${body}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

for (const rosterEntry of roster) {
  let player;
  try {
    player = await resolvePlayerTag(rosterEntry);
    const log = await getBattleLog(player);
  for (const item of (log.items || [])) {
    const battle = item.battle || {};
    // Friendly battles are the public Battle Log category used for practice/scrim candidates.
    if (String(battle.type || "").toLowerCase() !== "friendly") continue;

    const players = playersForBattle(battle);
    const id = fingerprint(item, players);
    const row = battleRows.get(id) || {
      battle_id: id,
      battle_time: new Date(
        `${item.battleTime.slice(0, 4)}-${item.battleTime.slice(4, 6)}-${item.battleTime.slice(6, 8)}T${item.battleTime.slice(9, 11)}:${item.battleTime.slice(11, 13)}:${item.battleTime.slice(13, 15)}Z`
      ).toISOString(),
      event_id: item.event?.id ?? null,
      map_name: item.event?.map ?? null,
      mode: battle.mode || item.event?.mode || null,
      battle_type: "friendly",
      tracked_team: player.team,
      tracked_players: [],
      players,
      battle_data: { event: item.event || {}, battle },
      source: "supercell_battlelog",
    };

    if (!row.tracked_players.some((p) => p.tag === player.tag)) {
      row.tracked_players.push({
        team: player.team,
        nickname: player.nickname,
        tag: player.tag,
        result: battle.result || (battle.rank ? `rank-${battle.rank}` : null),
      });
    }
    const teams = [...new Set(row.tracked_players.map((p) => p.team))].sort();
    row.tracked_team = teams.join(" vs ");
    battleRows.set(id, row);
    }
  } catch (error) {
    if (error.status === 404) {
      console.warn(`Skipping ${rosterEntry.nickname}: player tag not found by the official API.`);
    } else {
      throw error;
    }
  }
  await sleep(350);
}

const rows = [...battleRows.values()];
if (rows.length) {
  const endpoint = `${SUPABASE_URL}/rest/v1/scrim_battles?on_conflict=battle_id`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 800);
    throw new Error(`Supabase insert failed: HTTP ${response.status} ${body}`);
  }
}

console.log(`Checked ${roster.length} players; upserted ${rows.length} unique friendly-battle records.`);
