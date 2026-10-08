// Generates public/expert.js (expert questions) from the race results in data/.
// Run scripts/fetch-results.js first.
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const OUT = path.join(__dirname, "..", "public", "expert.js");
const MAX_PER_RACE = 4;

const RACE_NL = {
  "Abu Dhabi Grand Prix": "de GP van Abu Dhabi",
  "Argentine Grand Prix": "de GP van Argentinië",
  "Australian Grand Prix": "de GP van Australië",
  "Austrian Grand Prix": "de GP van Oostenrijk",
  "Azerbaijan Grand Prix": "de GP van Azerbeidzjan",
  "Bahrain Grand Prix": "de GP van Bahrein",
  "Barcelona Grand Prix": "de GP van Barcelona",
  "Belgian Grand Prix": "de GP van België",
  "Brazilian Grand Prix": "de GP van Brazilië",
  "British Grand Prix": "de GP van Groot-Brittannië",
  "Canadian Grand Prix": "de GP van Canada",
  "Chinese Grand Prix": "de GP van China",
  "Dutch Grand Prix": "de GP van Nederland",
  "Eifel Grand Prix": "de GP van de Eifel",
  "Emilia Romagna Grand Prix": "de GP van Emilia-Romagna",
  "European Grand Prix": "de GP van Europa",
  "French Grand Prix": "de GP van Frankrijk",
  "German Grand Prix": "de GP van Duitsland",
  "Hungarian Grand Prix": "de GP van Hongarije",
  "Indian Grand Prix": "de GP van India",
  "Italian Grand Prix": "de GP van Italië",
  "Japanese Grand Prix": "de GP van Japan",
  "Korean Grand Prix": "de GP van Korea",
  "Las Vegas Grand Prix": "de GP van Las Vegas",
  "Luxembourg Grand Prix": "de GP van Luxemburg",
  "Malaysian Grand Prix": "de GP van Maleisië",
  "Mexican Grand Prix": "de GP van Mexico",
  "Mexico City Grand Prix": "de GP van Mexico-Stad",
  "Miami Grand Prix": "de GP van Miami",
  "Monaco Grand Prix": "de GP van Monaco",
  "Pacific Grand Prix": "de GP van de Pacific",
  "Portuguese Grand Prix": "de GP van Portugal",
  "Qatar Grand Prix": "de GP van Qatar",
  "Russian Grand Prix": "de GP van Rusland",
  "Sakhir Grand Prix": "de GP van Sakhir",
  "San Marino Grand Prix": "de GP van San Marino",
  "Saudi Arabian Grand Prix": "de GP van Saoedi-Arabië",
  "Singapore Grand Prix": "de GP van Singapore",
  "South African Grand Prix": "de GP van Zuid-Afrika",
  "Spanish Grand Prix": "de GP van Spanje",
  "Styrian Grand Prix": "de GP van Stiermarken",
  "São Paulo Grand Prix": "de GP van São Paulo",
  "Turkish Grand Prix": "de GP van Turkije",
  "Tuscan Grand Prix": "de GP van Toscane",
  "United States Grand Prix": "de GP van de Verenigde Staten",
  "70th Anniversary Grand Prix": "de 70th Anniversary GP",
};

const NAT_NL = {
  American: "de Verenigde Staten", Argentine: "Argentinië", Argentinian: "Argentinië", Australian: "Australië",
  Austrian: "Oostenrijk", Belgian: "België", Brazilian: "Brazilië", British: "Groot-Brittannië",
  Canadian: "Canada", Chinese: "China", Colombian: "Colombia", Czech: "Tsjechië", Danish: "Denemarken",
  Dutch: "Nederland", Finnish: "Finland", French: "Frankrijk", German: "Duitsland", Hungarian: "Hongarije",
  Indian: "India", Indonesian: "Indonesië", Irish: "Ierland", Italian: "Italië", Japanese: "Japan",
  Malaysian: "Maleisië", Mexican: "Mexico", Monegasque: "Monaco", "New Zealander": "Nieuw-Zeeland",
  Polish: "Polen", Portuguese: "Portugal", Russian: "Rusland", Spanish: "Spanje", Swedish: "Zweden",
  Swiss: "Zwitserland", Thai: "Thailand", Venezuelan: "Venezuela", Chilean: "Chili", Uruguayan: "Uruguay",
  "South African": "Zuid-Afrika",
};

const fail = msg => { console.error(msg); process.exit(1); };
const raceNl = r => RACE_NL[r.raceName] || fail(`Unknown race name: ${r.raceName} (${r.season})`);
const natNl = d => NAT_NL[d.nationality] || fail(`Unknown nationality: ${d.nationality} (${d.given} ${d.family})`);
const team = d => d.team.replace(/ F1 Team$/, "").replace(/ F1$/, "");
const naam = d => `${d.given} ${d.family}`;
const driverAlias = d => [d.family, `${d.family} ${d.given}`];
const finishHint = d => d.pos === 1 ? "Hij won ook de race"
  : /^\d+$/.test(d.posText) ? `Hij finishte als ${d.pos}e` : "Hij haalde de finish niet";

if (!fs.existsSync(path.join(DATA, "podiums.json"))) fail("data/podiums.json missing: run scripts/fetch-results.js first");
const podiums = JSON.parse(fs.readFileSync(path.join(DATA, "podiums.json"), "utf8"));
const firstWin = new Map(), firstPodium = new Map();
for (const p of podiums) {
  const key = `${p.season}-${p.round}`;
  if (!firstPodium.has(p.driverId)) firstPodium.set(p.driverId, key);
  if (p.pos === 1 && !firstWin.has(p.driverId)) firstWin.set(p.driverId, key);
}

// Only completed seasons: results of a running season can still be corrected.
const currentYear = new Date().getFullYear();
const seasons = fs.readdirSync(path.join(DATA, "results")).filter(f => /^\d{4}\.json$/.test(f) && Number(f.slice(0, 4)) < currentYear).sort();
const vragen = [];
for (const file of seasons) {
  const races = JSON.parse(fs.readFileSync(path.join(DATA, "results", file), "utf8"));
  const winsPerTeam = new Map();
  for (const r of races) { const w = r.results.find(x => x.pos === 1); if (w) winsPerTeam.set(w.team, (winsPerTeam.get(w.team) || 0) + 1); }
  const namen = races.map(raceNl);
  if (new Set(namen).size !== namen.length) fail(`Duplicate race name in ${file}`);

  for (const r of races) {
    const [p1, p2, p3] = [1, 2, 3].map(n => r.results.find(x => x.pos === n));
    if (!p1 || !p2 || !p3) { console.warn(`Skipped incomplete race: ${r.season} ${r.raceName}`); continue; }
    const key = `${r.season}-${r.round}`, race = raceNl(r), jaar = r.season;
    const pole = r.results.filter(x => x.grid === 1);
    const opties = [];
    const v = (antwoord, vraag, hints, alias) => [jaar, antwoord, vraag, hints, alias];

    if (firstWin.get(p1.driverId) === key)
      opties.push(v(naam(p1), `Wie won in ${race} ${jaar} zijn eerste Grand Prix?`, [`Hij reed voor ${team(p1)}`, `Hij komt uit ${natNl(p1)}`], driverAlias(p1)));
    const nieuw = [p2, p3].filter(d => firstPodium.get(d.driverId) === key);
    if (nieuw.length === 1)
      opties.push(v(naam(nieuw[0]), `Wie stond in ${race} ${jaar} voor het eerst op het podium?`,
        [`Hij werd ${nieuw[0].pos === 2 ? "tweede" : "derde"}`, `Hij reed voor ${team(nieuw[0])}`], driverAlias(nieuw[0])));
    if (winsPerTeam.get(p1.team) <= 2)
      opties.push(v(team(p1), `Welk team won ${race} ${jaar}?`,
        [`De winnaar kwam uit ${natNl(p1)}`, `De winnaar was ${naam(p1)}`], [p1.team]));
    if (p1.grid >= 5)
      opties.push(v(`Plek ${p1.grid}`, `Vanaf welke startplek won ${naam(p1)} ${race} ${jaar}?`,
        [`Hij reed voor ${team(p1)}`, `Het is een plek tussen ${p1.grid - 2} en ${p1.grid + 2}`], [String(p1.grid), `${p1.grid}e`]));
    if (pole.length === 1 && pole[0].driverId !== p1.driverId)
      opties.push(v(naam(pole[0]), `Wie startte ${race} ${jaar} vanaf de eerste startplek?`,
        [`Hij reed voor ${team(pole[0])}`, finishHint(pole[0])], driverAlias(pole[0])));
    opties.push(v(naam(p3), `Wie werd derde in ${race} ${jaar}?`, [`Hij reed voor ${team(p3)}`, `Hij komt uit ${natNl(p3)}`], driverAlias(p3)));
    opties.push(v(naam(p2), `Wie werd tweede in ${race} ${jaar}?`, [`Hij reed voor ${team(p2)}`, `Hij komt uit ${natNl(p2)}`], driverAlias(p2)));
    vragen.push(...opties.slice(0, MAX_PER_RACE));
  }
}

fs.writeFileSync(OUT, `// Generated by scripts/build-expert.js from Jolpica F1 race results. Do not edit by hand.\nwindow.EXPERT_VRAGEN = ${JSON.stringify(vragen)};\n`);
console.warn(`${vragen.length} expert questions written to public/expert.js`);
