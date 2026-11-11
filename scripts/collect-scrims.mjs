import crypto from "node:crypto";

const API_KEY = process.env.SUPERCELL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = (process.env.BRAWL_API_BASE_URL || "https://api.brawlstars.com/v1").replace(/\/$/, "");

if (!API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing SUPERCELL_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY GitHub secret.");
}

const roster = [
  // World Finals 2026 — Corestats pro team roster tags
  { team: "FUT", nickname: "Angelboy", tag: "#9PCV9L982" },
  { team: "FUT", nickname: "Guesti", tag: "#2R0JLJJ9PP" },
  { team: "FUT", nickname: "Nob", tag: "#P2808PRC" },

  { team: "HMBLE", nickname: "Lukii", tag: "#8V92UYCJ" },
  { team: "HMBLE", nickname: "BosS", tag: "#V89Y2GP0" },
  { team: "HMBLE", nickname: "Symantec", tag: "#YQUCCJ2" },

  { team: "Team Heretics", nickname: "Marco", tag: "#Q22ULY9JY" },
  { team: "Team Heretics", nickname: "iKaoss", tag: "#PCPRPJV" },
  { team: "Team Heretics", nickname: "Subeme", tag: "#89VC2CGCJ" },

  { team: "ZETA DIVISION", nickname: "Sitetampo", tag: "#8Y98Q8U" },
  { team: "ZETA DIVISION", nickname: "Batman", tag: "#P0Y8JGL0U" },
  { team: "ZETA DIVISION", nickname: "Sizuku", tag: "#P90RJQ8C" },

  { team: "Team Elektros", nickname: "Memxn", tag: "#PJPPY9LRC" },
  { team: "Team Elektros", nickname: "Snoiy", tag: "#YUJ8PJ0LR" },
  { team: "Team Elektros", nickname: "Doin", tag: "#8CRU0PQRQ" },

  { team: "Tribe Gaming", nickname: "Lxffy", tag: "#82RCQCVG" },
  { team: "Tribe Gaming", nickname: "Diegogamer", tag: "#QLCJGQUP" },
  { team: "Tribe Gaming", nickname: "R B M", tag: "#U9GC8G02" },

  { team: "Bounty Hunters Allu", nickname: "Prozy", tag: "#GYCYCLRJL" },
  { team: "Bounty Hunters Allu", nickname: "Portox", tag: "#YGQYGCR" },
  { team: "Bounty Hunters Allu", nickname: "Wesley", tag: "#PLLRJC2V" },

  { team: "RED Canids", nickname: "Jubileubr", tag: "#GVYLVUGR" },
  { team: "RED Canids", nickname: "Cauebr", tag: "#JQ8L0YYL" },
  { team: "RED Canids", nickname: "Mohtep", tag: "#R2LR2QLG" },

  { team: "Crazy Raccoon", nickname: "Tensai", tag: "#9ULYPV8" },
  { team: "Crazy Raccoon", nickname: "Moya", tag: "#UR2UL8YR" },
  { team: "Crazy Raccoon", nickname: "Milkreo", tag: "#20C0LL00" },

  { team: "Reply Totem", nickname: "Maru", tag: "#2Q892QVU" },
  { team: "Reply Totem", nickname: "Maury", tag: "#82RGU8PR" },
  { team: "Reply Totem", nickname: "Joker", tag: "#9JCG0VY8U" },

  { team: "NOVO Esports", nickname: "MeOw", tag: "#90JCYPQU" },
  { team: "NOVO Esports", nickname: "Filippo", tag: "#9PQQ8GQQ" },
  { team: "NOVO Esports", nickname: "Jus", tag: "#JJ92RGPL" },

  { team: "Natus Vincere", nickname: "GeRo", tag: "#2VJCCCQGP" },
  { team: "Natus Vincere", nickname: "Enraged", tag: "#80PVPCC29" },
  { team: "Natus Vincere", nickname: "Nowy297", tag: "#22CL00PG0" },
  { team: "Jyro team", nickname: "Xenoxz", tag: "#Y28PL2Q0V" },
  { team: "Jyro team", nickname: "Fade", tag: "#2RCR2GJCL2" },
  { team: "Jyro team", nickname: "Jyro", tag: "#P90GVUV80" },
  { team: "Reason Esports", nickname: "Ducky", tag: "#20P2GP99" },
  { team: "Reason Esports", nickname: "Swarm", tag: "#R0PRVCUL" },
  { team: "Reason Esports", nickname: "David", tag: "#88PL8L2JC" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function supabaseRest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Supabase ${path} failed: HTTP ${response.status} ${(await response.text()).slice(0, 700)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

const canonicalTag = (tag) => `#${tag.toUpperCase().replace(/^#/, "").replace(/O/g, "0")}`;
const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const teamNames = [...new Set(roster.map((p) => p.team))];
const teamRows = await supabaseRest("teams?on_conflict=slug", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(teamNames.map((name) => ({ slug: slugify(name), name }))),
});
const teamIdByName = new Map(teamRows.map((team) => [team.name, team.id]));
const playerRows = roster.map((player) => ({
  tag: canonicalTag(player.tag),
  nickname: player.nickname,
  current_team_id: teamIdByName.get(player.team),
}));
await supabaseRest("players?on_conflict=tag", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(playerRows),
});

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

// Rebuild team-vs-team scrim series from the captured friendly battles.
const stored = await supabaseRest("scrim_battles?select=battle_id,battle_time,players,tracked_players,battle_data&order=battle_time.asc&limit=10000", {
  headers: { Accept: "application/json" },
});
const teamByTag = new Map(roster.map((p) => [canonicalTag(p.tag), p.team]));
const candidates = [];
for (const row of stored) {
  const participants = Array.isArray(row.players) ? row.players : [];
  const groups = new Map();
  for (const player of participants) {
    const team = teamByTag.get(canonicalTag(player.tag || ""));
    if (!team) continue;
    const side = Number(player.teamIndex);
    if (!groups.has(side)) groups.set(side, new Set());
    groups.get(side).add(team);
  }
  if (groups.size !== 2) continue;
  const sides = [...groups.entries()].map(([side, names]) => ({ side, names: [...names] }));
  if (sides.some((side) => side.names.length !== 1)) continue;
  const [sideA, sideB] = sides;
  if (sideA.names[0] === sideB.names[0]) continue;
  const firstTracked = (row.tracked_players || [])[0];
  if (!firstTracked) continue;
  const trackedSide = participants.find((p) => canonicalTag(p.tag || "") === canonicalTag(firstTracked.tag || ""))?.teamIndex;
  const result = String(row.battle_data?.battle?.result || firstTracked.result || "").toLowerCase();
  if (!["victory", "defeat", "draw"].includes(result)) continue;
  let winnerTeam = null;
  if (result !== "draw") {
    const winningSide = result === "victory"
      ? Number(trackedSide)
      : (Number(trackedSide) === sideA.side ? sideB.side : sideA.side);
    winnerTeam = winningSide === sideA.side ? sideA.names[0] : sideB.names[0];
  }
  candidates.push({
    battle_id: row.battle_id,
    played_at: row.battle_time,
    team_a: sideA.names[0],
    team_b: sideB.names[0],
    winner_team: winnerTeam,
  });
}
candidates.sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
const series = [];
for (const battle of candidates) {
  const names = [battle.team_a, battle.team_b].sort();
  const pairKey = names.join("::");
  const previous = series[series.length - 1];
  const gap = previous ? (new Date(battle.played_at) - new Date(previous.last_played_at)) / 60000 : Infinity;
  if (!previous || previous.pair_key !== pairKey || gap > 30) {
    series.push({
      pair_key: pairKey,
      team_a: names[0],
      team_b: names[1],
      first_played_at: battle.played_at,
      last_played_at: battle.played_at,
      score_a: 0,
      score_b: 0,
      battle_ids: [],
    });
  }
  const current = series[series.length - 1];
  current.last_played_at = battle.played_at;
  current.battle_ids.push(battle.battle_id);
  if (battle.winner_team === current.team_a) current.score_a++;
  else if (battle.winner_team === current.team_b) current.score_b++;
}
const scrimRows = series.filter((s) => s.score_a + s.score_b > 0).map((s) => {
  const teamA = s.team_a, teamB = s.team_b;
  const scoreA = s.score_a;
  const scoreB = s.score_b;
  return {
    source: `battlelog:${s.pair_key}:${s.first_played_at}`,
    played_at: s.first_played_at,
    team_a_id: teamIdByName.get(teamA),
    team_b_id: teamIdByName.get(teamB),
    score_a: scoreA,
    score_b: scoreB,
    verified: false,
  };
}).filter((s) => s.team_a_id && s.team_b_id);
if (scrimRows.length) {
  await supabaseRest("scrims?on_conflict=source", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(scrimRows),
  });
}
console.log(`Checked ${roster.length} players; upserted ${rows.length} friendly battles; built ${scrimRows.length} team scrim series from captured results.`);
