// Downloads race results from the Jolpica F1 API (successor of Ergast) into data/.
// Usage: node scripts/fetch-results.js [fromYear] [toYear]
const fs = require("fs");
const path = require("path");

const API = "https://api.jolpi.ca/ergast/f1";
const OUT = path.join(__dirname, "..", "data");
const PAUSE_MS = 400;
const from = Number(process.argv[2]) || 1990;
const to = Number(process.argv[3]) || new Date().getFullYear();

const wait = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await wait(PAUSE_MS);
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      console.warn(`${res.status} on ${url}, retry ${attempt}`);
      await wait(attempt * 10000);
      continue;
    }
    throw new Error(`${res.status} on ${url}`);
  }
  throw new Error(`Giving up on ${url}`);
}

// Pages through an endpoint and merges the result rows of races that span page boundaries.
async function getRaces(endpoint) {
  const races = new Map();
  for (let offset = 0, total = 1; offset < total; offset += 100) {
    const data = (await getJson(`${API}/${endpoint}.json?limit=100&offset=${offset}`)).MRData;
    total = Number(data.total);
    for (const race of data.RaceTable.Races) {
      const key = `${race.season}-${race.round}`;
      if (!races.has(key)) races.set(key, { ...race, Results: [] });
      races.get(key).Results.push(...race.Results);
    }
  }
  return [...races.values()];
}

const trimResult = r => ({
  pos: Number(r.position),
  posText: r.positionText,
  driverId: r.Driver.driverId,
  given: r.Driver.givenName,
  family: r.Driver.familyName,
  nationality: r.Driver.nationality,
  team: r.Constructor.name,
  grid: Number(r.grid),
  laps: Number(r.laps),
  status: r.status,
});

(async () => {
  fs.mkdirSync(path.join(OUT, "results"), { recursive: true });

  for (let year = from; year <= to; year++) {
    const races = await getRaces(`${year}/results`);
    const trimmed = races.map(race => ({
      season: Number(race.season),
      round: Number(race.round),
      raceName: race.raceName,
      date: race.date,
      circuit: race.Circuit.circuitName,
      locality: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      results: race.Results.map(trimResult).sort((a, b) => a.pos - b.pos),
    })).sort((a, b) => a.round - b.round);
    fs.writeFileSync(path.join(OUT, "results", `${year}.json`), JSON.stringify(trimmed));
    console.warn(`${year}: ${trimmed.length} races`);
  }

  // All-time podiums since 1950, needed to know a driver's first podium or win.
  const podiums = [];
  for (const pos of [1, 2, 3]) {
    for (const race of await getRaces(`results/${pos}`)) {
      for (const r of race.Results) podiums.push({ season: Number(race.season), round: Number(race.round), pos, driverId: r.Driver.driverId });
    }
    console.warn(`all-time P${pos} loaded`);
  }
  podiums.sort((a, b) => a.season - b.season || a.round - b.round || a.pos - b.pos);
  fs.writeFileSync(path.join(OUT, "podiums.json"), JSON.stringify(podiums));
})().catch(e => { console.error(e.message); process.exit(1); });
