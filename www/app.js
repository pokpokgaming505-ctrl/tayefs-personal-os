const STORAGE_KEY = "northstar-life-os-v1";
const APP_VERSION = "0.3.0";
const REPOSITORY_RAW = "https://raw.githubusercontent.com/pokpokgaming505-ctrl/tayefs-personal-os";
const PLUGIN_PACKAGE_MAX_BYTES = 512 * 1024;
const views = { dashboard: "Dashboard", health: "Health & fitness", gym: "Gym", study: "Study room", build: "Build & create", content: "Content Studio", library: "Ideas & library", review: "Weekly review", ai: "AI", plugins: "Plugins" };
const themeClasses = ["theme-focus", "theme-simple", "theme-creator", "theme-bright"];
const pluginIcons = { gym: "◈", "ai-models": "✦", "content-studio": "▶" };
const pluginAdapters = new Set(["gym", "ai-models", "content-studio"]);
const bundledPluginCatalog = [
  { id: "gym", name: "Gym", version: "1.1.0", releaseTag: "gym-v1.1.0", sha256: "c3d3235cb5ec9bf57cf6f01e871d3d792438c1dd083a5794a29feecbf6138cd0", icon: "◈", description: "An editable monthly workout calendar with recovery days, sets/reps, and completion tracking.", location: "Health & fitness" },
  { id: "ai-models", name: "AI Models", version: "1.1.0", releaseTag: "ai-models-v1.1.0", sha256: "38ed038eb04bdeae3f63020cf2db22db2bc32773cd02199659a7c06f92ff0e98", icon: "✦", description: "Add your own compatible AI models; connect them to supported plugins only when you choose.", location: "AI Models" },
  { id: "content-studio", name: "Content Studio", version: "1.0.0", releaseTag: "content-studio-v1.0.0", sha256: "1683cf637e08db4fc240c3cfb88fbab978f23ea95a2a3688c55e95f2ca1b9fc0", icon: "▶", description: "Collect ideas, plan scripts and visuals, track production, and schedule content across platforms.", location: "Build & create" }
];
let pluginCatalog = bundledPluginCatalog.map(item => ({ ...item, packageUrl: `${REPOSITORY_RAW}/${item.releaseTag}/plugins/${item.id}/package.json` }));
let pluginCatalogRefreshPromise = null;
let downloadingPluginId = "";
let pluginDownloadProgress = 0;
let contentIntegrationEditorOpen = false;
let contentDraftingId = "";
const sessionApiKeys = new Map();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const nowDateKey = localDateKey();
const starterData = () => ({
  version: 3,
  settings: { theme: "focus", textSize: "normal", fontStyle: "sans", installedPlugins: [], installedPluginVersions: {}, pluginPackages: {}, aiModels: [], gymAiModel: "", contentAiModel: "" },
  tasks: [
    { id: uid(), title: "Finish one science lesson", area: "STUDY", date: nowDateKey, done: false, starter: true },
    { id: uid(), title: "Move your body", area: "HEALTH", date: nowDateKey, done: false, starter: true },
    { id: uid(), title: "Build a small tech idea", area: "CREATE", date: nowDateKey, done: false, starter: true }
  ],
  health: [], study: [],
  projects: [],
  books: [
    { id: uid(), title: "Atomic Habits", author: "James Clear", status: "Queue", starter: true },
    { id: uid(), title: "The 48 Laws of Power", author: "Robert Greene", status: "Queue", starter: true }
  ],
  notes: [], reviews: {}, gym: { months: {} }, content: { items: [] }
});
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && [1, 2, 3].includes(saved.version)) {
      const defaults = starterData();
      const migrated = { ...defaults, ...saved, version: 3 };
      migrated.settings = { ...defaults.settings, ...saved.settings };
      const validPackages = {};
      if (saved.version >= 3 && saved.settings?.pluginPackages && typeof saved.settings.pluginPackages === "object") {
        for (const [id, pluginPackage] of Object.entries(saved.settings.pluginPackages)) {
          try { validatePluginPackage(pluginPackage, id); validPackages[id] = pluginPackage; } catch { /* Ignore unsupported or malformed cached packages. */ }
        }
      }
      migrated.settings.pluginPackages = validPackages;
      migrated.settings.installedPluginVersions = saved.version >= 3 && saved.settings?.installedPluginVersions && typeof saved.settings.installedPluginVersions === "object" ? saved.settings.installedPluginVersions : {};
      migrated.settings.installedPlugins = saved.version >= 3 && Array.isArray(saved.settings?.installedPlugins)
        ? saved.settings.installedPlugins.filter(id => validPackages[id] && migrated.settings.installedPluginVersions[id] === validPackages[id].manifest.version) : [];
      migrated.settings.aiModels = Array.isArray(migrated.settings.aiModels) ? migrated.settings.aiModels : [];
      migrated.gym = { ...defaults.gym, ...saved.gym, months: saved.gym?.months || {} };
      migrated.content = { ...defaults.content, ...saved.content, items: Array.isArray(saved.content?.items) ? saved.content.items : [] };
      return migrated;
    }
  } catch (error) { console.warn("Could not read saved TAYEF'S data.", error); }
  return starterData();
}
let state = loadState();
let activeView = "dashboard";
let timerSeconds = 25 * 60;
let timerInterval = null;
let installPrompt = null;
let gymSelectedDate = nowDateKey;
let gymSelectedMonth = nowDateKey.slice(0, 7);
let gymIntegrationEditorOpen = false;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast("Could not save. Export a backup and check browser storage.", true); }
}
function esc(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }
function fmtDate(key) {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en", { month:"short", day:"numeric" });
}
function validatePluginPackage(pluginPackage, expectedId = "") {
  const manifest = pluginPackage?.manifest;
  const module = pluginPackage?.module;
  if (pluginPackage?.format !== "tayefs-plugin" || pluginPackage?.schemaVersion !== 1) throw new Error("This is not a supported TAYEF'S plugin package.");
  if (!manifest || !pluginAdapters.has(manifest.id) || (expectedId && manifest.id !== expectedId) || typeof manifest.name !== "string" || manifest.name.length > 64) throw new Error("This plugin type is not supported by this app version.");
  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version || "")) || !/^\d+\.\d+\.\d+$/.test(String(manifest.minAppVersion || "0.0.0")) || !pluginAdapters.has(manifest.adapter) || module?.type !== manifest.adapter) throw new Error("The plugin manifest or adapter is invalid.");
  if (compareVersions(String(manifest.minAppVersion || "0.0.0"), APP_VERSION) > 0) throw new Error(`This plugin needs app version ${manifest.minAppVersion} or newer.`);
  if (manifest.id === "gym" && (!Array.isArray(module.workoutTemplates) || !module.workoutTemplates.length || module.workoutTemplates.length > 8 || module.workoutTemplates.some(template => typeof template.title !== "string" || typeof template.focus !== "string" || !Array.isArray(template.exercises) || !template.exercises.length || template.exercises.length > 15 || template.exercises.some(exercise => !Array.isArray(exercise) || exercise.length !== 3 || typeof exercise[0] !== "string" || !Number.isFinite(Number(exercise[1])) || typeof exercise[2] !== "string")))) throw new Error("The Gym package does not contain valid workout templates.");
  if (manifest.id === "ai-models" && module.protocol !== "openai-chat-completions") throw new Error("The AI Models package uses an unsupported protocol.");
  if (manifest.id === "content-studio" && (!Array.isArray(module.platforms) || !module.platforms.length || module.platforms.length > 12 || !Array.isArray(module.formats) || !module.formats.length || module.formats.length > 12 || !Array.isArray(module.stages) || !module.stages.length || module.stages.length > 12 || !Array.isArray(module.pillars) || !module.pillars.length || module.pillars.length > 12 || !Array.isArray(module.templates) || !module.templates.length || module.templates.length > 8 || !Array.isArray(module.checklist) || module.checklist.length > 24 || !Array.isArray(module.workflow) || module.workflow.length > 12 || [...module.platforms, ...module.formats, ...module.stages, ...module.pillars, ...module.checklist, ...module.workflow].some(value => typeof value !== "string" || value.length > 100) || module.templates.some(template => !template || typeof template.id !== "string" || typeof template.name !== "string"))) throw new Error("The Content Studio package is missing valid planning data.");
  return pluginPackage;
}
function compareVersions(a, b) {
  const left = a.split(".").map(Number), right = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) > (right[i] || 0) ? 1 : -1;
  return 0;
}
function isPluginInstalled(id) { const pluginPackage = state.settings.pluginPackages[id]; return state.settings.installedPlugins.includes(id) && !!pluginPackage && state.settings.installedPluginVersions[id] === pluginPackage.manifest.version; }
function cachedPlugin(id) { return state.settings.pluginPackages[id] || null; }
function activePluginPackage(id) { return isPluginInstalled(id) ? cachedPlugin(id) : null; }
function monthDateKeys(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
}
const workoutTemplates = [
  { title: "Full body A", focus: "Easy, controlled full-body session", exercises: [["Bodyweight squat", 2, "8–12"], ["Incline push-up", 2, "8–12"], ["Resistance-band row", 2, "8–12"], ["Glute bridge", 2, "10–12"], ["Front plank", 2, "20–30 sec"]] },
  { title: "Full body B", focus: "Smooth repetitions, stop before form slips", exercises: [["Supported split squat", 2, "8 each side"], ["Light dumbbell floor press", 2, "8–12"], ["Resistance-band row", 2, "8–12"], ["Hip hinge drill", 2, "8–10"], ["Dead bug", 2, "8 each side"]] },
  { title: "Full body C", focus: "Choose light resistance and steady form", exercises: [["Low step-up", 2, "8 each side"], ["Knee or incline push-up", 2, "8–12"], ["Band pull-apart", 2, "10–12"], ["Calf raise", 2, "10–12"], ["Bird dog", 2, "8 each side"]] }
];
function createGymMonth(monthKey) {
  let sessionNumber = 0;
  const templates = activePluginPackage("gym")?.module.workoutTemplates || workoutTemplates;
  return Object.fromEntries(monthDateKeys(monthKey).map(key => {
    const weekday = new Date(`${key}T12:00:00`).getDay();
    const trainingDay = [1, 3, 5].includes(weekday);
    const template = templates[sessionNumber % templates.length];
    const exercises = trainingDay ? template.exercises.map((exercise, i) => ({ id: `${key}-exercise-${i + 1}`, name: exercise[0], sets: exercise[1], reps: exercise[2] })) : [];
    if (trainingDay) sessionNumber++;
    return [key, { date: key, kind: trainingDay ? "workout" : "recovery", title: trainingDay ? template.title : "Rest & recovery", focus: trainingDay ? template.focus : "Optional easy walk or gentle mobility; rest is a valid choice.", notes: "", exercises, completed: {} }];
  }));
}
function ensureGymMonth(monthKey = gymSelectedMonth) {
  if (!state.gym.months[monthKey]) state.gym.months[monthKey] = createGymMonth(monthKey);
  return state.gym.months[monthKey];
}
function bookMark(title) { return String(title).split(/\s+/).slice(0,3).map(esc).join("<br>"); }
function weekStartKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}
function daysBetween(startKey, count = 7) {
  const [y,m,d] = startKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => { const day = new Date(y,m-1,d+i); return { key: localDateKey(day), label: day.toLocaleDateString("en", { weekday:"short" }).slice(0,1) }; });
}
function todayEntries(list) { return list.filter(item => item.date === nowDateKey); }
function totalMinutes(list) { return list.reduce((sum,item) => sum + (Number(item.minutes)||0), 0); }
function minsLabel(value) { const h = Math.floor(value/60), m = value%60; return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m} min`; }
function pageHeading(eyebrow, title, description, meta = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${meta ? `<div class="heading-meta">${meta}</div>` : ""}</div>`;
}
function cardHead(title, sub = "", action = "") {
  return `<div class="card-head"><div><div class="card-title">${title}</div>${sub ? `<div class="card-sub" style="margin-top:4px">${sub}</div>` : ""}</div>${action}</div>`;
}
function emptyState(title, copy) { return `<div class="empty-state"><strong>${title}</strong>${copy}</div>`; }
function blankButton(label, action, style = "") { return `<button class="button ${style}" data-action="${action}">${label}</button>`; }
function taskRows(tasks, includeDate = false) {
  if (!tasks.length) return emptyState("Nothing on your list yet", "Add one small next step and start there.");
  return `<div class="mission-list">${tasks.map(task => `<label class="mission ${task.done ? "done" : ""}"><input class="check" type="checkbox" data-task="${esc(task.id)}" ${task.done ? "checked" : ""} aria-label="Mark ${esc(task.title)} complete"><span class="mission-copy"><strong>${esc(task.title)}</strong><small>${task.starter ? "Suggested starter · edit or remove anytime" : esc(task.area || "PERSONAL")}${includeDate ? ` · ${fmtDate(task.date)}` : ""}</small></span><span class="mission-area">${esc(task.area || "PERSONAL")}</span><button type="button" class="icon-action" data-delete-task="${esc(task.id)}" aria-label="Remove task" title="Remove task">×</button></label>`).join("")}</div>`;
}
function miniWeekBars(list, property = "minutes") {
  const days = daysBetween(weekStartKey());
  const values = days.map(d => list.filter(x => x.date === d.key).reduce((n,x) => n + (Number(x[property])||0), 0));
  const max = Math.max(1, ...values);
  return `<div class="week-bars">${days.map((d,i) => `<div class="bar-col"><div class="bar ${values[i] ? "active" : ""}" style="height:${Math.max(values[i] ? 12 : 2, values[i]/max*73)}%" title="${values[i]}"></div><span>${d.label}</span></div>`).join("")}</div>`;
}
function dashboardView() {
  const tasks = state.tasks.filter(t => t.date === nowDateKey);
  const todayHealth = todayEntries(state.health);
  const movement = totalMinutes(todayHealth.filter(x => x.kind === "movement"));
  const studyMinutes = totalMinutes(todayEntries(state.study));
  const activeProjects = state.projects.filter(p => p.status !== "Done").length;
  const done = tasks.filter(t => t.done).length;
  const percent = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const books = state.books.slice(0,2);
  const welcome = new Date().getHours() < 12 ? "Good morning, builder." : new Date().getHours() < 18 ? "Good afternoon, builder." : "Good evening, builder.";
  return `${pageHeading("YOUR LIFE, MOVING FORWARD", welcome, "আজকের ছোট পদক্ষেপগুলোই তোমার বড় লক্ষ্যকে কাছে আনবে।", `${new Date().toLocaleDateString("en",{weekday:"long"}).toUpperCase()} · WEEK ${Math.ceil((new Date().getDate()+6)/7)}`)}
  <div class="dashboard-grid"><div class="stack">
    <section class="card hero-card"><p class="eyebrow">YOUR NORTH STAR · THE LONG GAME</p><h2>Learn something. Build something. Take care of yourself.</h2><p>তোমার science, technology আর creator লক্ষ্যগুলোকে ছোট, সামলানো যায় এমন দৈনিক পদক্ষেপে এগিয়ে নাও।</p><div class="hero-tags"><span class="tag">SCIENCE STUDENT</span><span class="tag">TECH × CREATOR</span></div></section>
    <div class="metric-grid"><div class="metric"><div class="metric-label"><span>♡</span> MOVEMENT</div><div class="metric-value">${movement}<small> min</small></div><div class="metric-foot">${movement ? "Logged today" : "Ready when you are"}</div></div><div class="metric"><div class="metric-label"><span>▤</span> STUDY</div><div class="metric-value">${studyMinutes}<small> min</small></div><div class="metric-foot">${studyMinutes ? "Focused time today" : "Add a study session"}</div></div><div class="metric"><div class="metric-label"><span>⌘</span> BUILDS</div><div class="metric-value">${activeProjects}</div><div class="metric-foot">Active projects</div></div><div class="metric"><div class="metric-label"><span>✎</span> IDEAS</div><div class="metric-value">${state.notes.length}</div><div class="metric-foot">Notes captured</div></div></div>
    <section class="card">${cardHead("Today's small wins", `${done} of ${tasks.length} complete · progress at your pace`, `<button class="button small" data-action="add-task">+ Add task</button>`)}${taskRows(tasks)}<div style="margin-top:14px"><div class="progress-line"><i style="width:${percent}%"></i></div><div class="progress-foot"><span>DAILY PROGRESS</span><strong>${percent}%</strong></div></div></section>
    <div class="section-grid"><section class="card">${cardHead("Movement this week","Only track what feels useful.")} ${miniWeekBars(state.health.filter(x=>x.kind==="movement"))}<div class="bar-caption">${minsLabel(totalMinutes(state.health.filter(x=>x.kind==="movement" && x.date >= weekStartKey())))} logged this week</div></section><section class="card">${cardHead("A thought to keep","Field notes from what you read.")}<p class="quote">Build a system that makes the next good action easier to begin.<small>YOUR PERSONAL OS · KEEP WHAT WORKS</small></p></section></div>
  </div><div class="stack side-stack">
    <section class="card">${cardHead("Today's balance","A gentle snapshot, no scores to chase.")}<div class="ring-wrap"><div class="ring" style="--ring:${percent}%"><span>${percent}%</span></div><div class="ring-copy"><strong>${tasks.length ? (percent === 100 ? "All done for today" : "One step at a time") : "Make room for what matters"}</strong><small>${tasks.length ? `${tasks.length-done} next step${tasks.length-done===1?"":"s"} left on your list.` : "Add a mission, or keep today open."}</small></div></div></section>
    <section class="card">${cardHead("Focus session","A quiet 25-minute block.",`<span class="badge">25 / 5</span>`)}<div class="focus-box"><div class="focus-top"><span>PERSONAL FOCUS</span><span>◉</span></div><div class="timer" id="focus-timer">25:00</div><div class="focus-controls"><button class="button small" id="timer-toggle">Start focus</button><button class="button secondary small" id="timer-reset">Reset</button></div></div></section>
    <section class="card">${cardHead("On your bookshelf","A place to keep curious questions.",`<button class="text-action" data-view-link="library">Open library ↗</button>`)}${books.length ? books.map((book,i)=>`<div class="book-row" style="${i?"margin-top:13px":""}"><div class="book-cover ${i?"green":""}">${bookMark(book.title)}</div><div class="book-copy"><strong>${esc(book.title)}</strong><small>${esc(book.author||"Author not added")} · ${esc(book.status)}</small></div></div>`).join("") : emptyState("Your reading list is open", "Add a book or idea in your library.")}</section>
    <section class="card">${cardHead("Your direction","A compass, not a deadline.",`<span class="badge accent">4 YEAR VIEW</span>`)}<div class="ring-copy"><strong>Learn → Build → Share</strong><small>IT skills · strong foundations · useful work · your own voice</small></div></section>
  </div></div>`;
}
function healthView() {
  const movement = state.health.filter(x=>x.kind==="movement").sort((a,b)=>b.date.localeCompare(a.date));
  const sleep = state.health.filter(x=>x.kind==="sleep").sort((a,b)=>b.date.localeCompare(a.date));
  const todayMove = totalMinutes(todayEntries(movement));
  const latestSleep = todayEntries(sleep)[0];
  return `${pageHeading("CARE FOR YOUR ENERGY","Health & fitness","শরীরের যত্ন নাও—নিজের জন্য অর্থবহ জিনিসগুলোই নথিবদ্ধ করো।",`${todayMove} MIN MOVEMENT TODAY`)}
  <section class="card plugin-entry-card">${cardHead("Gym planner","এক মাসের editable workout plan, আলাদা Gym plugin-এ থাকে।",`<span class="badge">${isPluginInstalled("gym") ? `INSTALLED · v${esc(cachedPlugin("gym").manifest.version)}` : "OPTIONAL PLUGIN"}</span>`)}<p class="card-sub">${isPluginInstalled("gym") ? "দিন বেছে workout দেখো, sets/reps বদলাও, আর exercise complete হলে checkbox দাও।" : "Plugins খুলে versioned Gym package download করো; download শেষ হলে Add চাপলে planner চালু হবে।"}</p><div class="button-row" style="margin-top:12px">${isPluginInstalled("gym") ? `<button class="button small" data-view-link="gym">Open Gym planner ↗</button>` : `<button class="button small" data-view-link="plugins">Open Plugins to download Gym ↗</button>`}</div></section>
  <div class="section-grid"><section class="form-card"><h2>Log movement</h2><p>Walking, sport, stretching—তুমি যা করেছো সেটাই লেখো। কোনো লক্ষ্য বাধ্যতামূলক নয়।</p><form id="movement-form"><div class="field-grid"><div class="field"><label for="movement-type">Activity</label><select id="movement-type" name="activity"><option>Walk</option><option>Sport</option><option>Stretching</option><option>Other</option></select></div><div class="field"><label for="movement-minutes">Minutes</label><input id="movement-minutes" name="minutes" type="number" min="1" max="600" placeholder="30" required></div></div><div class="field"><label for="movement-note">Note (optional)</label><input id="movement-note" name="note" maxlength="120" placeholder="How did it feel?"></div><button class="button" type="submit">Save movement</button></form></section>
  <section class="form-card"><h2>Log rest</h2><p>ঘুম বা বিশ্রামের একটি সহজ নোট রাখো। এটি ব্যক্তিগত; ডেটা শুধু এই ব্রাউজারে থাকে।</p><form id="sleep-form"><div class="field"><label for="sleep-hours">Last night's sleep (hours)</label><input id="sleep-hours" name="hours" type="number" min="0" max="24" step="0.5" placeholder="8" required></div><div class="field"><label for="sleep-note">Optional note</label><input id="sleep-note" name="note" maxlength="120" placeholder="Rested, busy night, etc."></div><button class="button" type="submit">Save rest note</button>${latestSleep?`<div class="field-help" style="margin-top:9px">Today: ${latestSleep.hours} hours logged.</div>`:""}</form></section></div>
  <section class="card" style="margin-top:13px">${cardHead("Movement log","Your recent activity, without a score.",`<span class="badge">${movement.length} ENTRIES</span>`)}${movement.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>DATE</th><th>ACTIVITY</th><th>TIME</th><th>NOTE</th></tr></thead><tbody>${movement.slice(0,12).map(x=>`<tr><td>${fmtDate(x.date)}</td><td><strong>${esc(x.activity)}</strong></td><td>${x.minutes} min</td><td>${esc(x.note||"—")}</td></tr>`).join("")}</tbody></table></div>`:emptyState("Your movement log is empty","When you want, add a walk, workout, or any movement that felt good.")}</section>
  <section class="card" style="margin-top:13px">${cardHead("Rest notes","A private record, not a target.",`<span class="badge">${sleep.length} ENTRIES</span>`)}${sleep.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>DATE</th><th>SLEEP</th><th>NOTE</th></tr></thead><tbody>${sleep.slice(0,8).map(x=>`<tr><td>${fmtDate(x.date)}</td><td><strong>${x.hours} hours</strong></td><td>${esc(x.note||"—")}</td></tr>`).join("")}</tbody></table></div>`:emptyState("No rest notes yet","You can add one when tracking sleep feels helpful.")}</section>`;
}
function pluginsView() {
  const installed = state.settings.installedPlugins;
  const activeCount = pluginCatalog.filter(plugin => isPluginInstalled(plugin.id)).length;
  return `${pageHeading("MAKE YOUR SPACE YOURS", "Plugins", "GitHub থেকে package নামাও; তারপর আলাদা করে Add করে feature চালু করো।", `${activeCount} ADDED`)}
  <div class="plugin-toolbar"><button class="button secondary small" data-action="refresh-plugin-catalog" ${downloadingPluginId ? "disabled" : ""}>↻ Check GitHub for updates</button><button class="button small" data-action="import-plugin-file" ${downloadingPluginId ? "disabled" : ""}>↑ Import downloaded plugin .json</button><input class="hidden" id="plugin-import-file" type="file" accept="application/json,.json" /></div>
  <div class="plugin-grid">${pluginCatalog.map(plugin => {
    const cached = cachedPlugin(plugin.id);
    const cachedVersion = cached?.manifest?.version || "";
    const active = isPluginInstalled(plugin.id);
    const hasLatestDownloaded = cachedVersion === plugin.version;
    const hasUpdate = !!cached && compareVersions(plugin.version, cachedVersion) > 0;
    const busy = downloadingPluginId === plugin.id;
    const status = active ? `ADDED · v${cachedVersion}` : hasLatestDownloaded ? `DOWNLOADED · v${cachedVersion}` : cached ? `CACHED · v${cachedVersion}` : "HOSTED ON GITHUB";
    const action = busy
      ? `<button class="button secondary small download-progress" disabled><span class="spinner" aria-hidden="true"></span>${pluginDownloadProgress ? `${pluginDownloadProgress}%` : "Downloading…"}</button>`
      : active
        ? `<button class="button secondary small" data-action="remove-plugin" data-plugin="${esc(plugin.id)}">Remove</button>${hasUpdate ? `<button class="button small" data-action="download-plugin" data-plugin="${esc(plugin.id)}">Download v${esc(plugin.version)}</button>` : ""}`
        : hasLatestDownloaded
          ? `<button class="button small" data-action="install-plugin" data-plugin="${esc(plugin.id)}">Add v${esc(cachedVersion)} to app</button>${hasUpdate ? `<button class="button secondary small" data-action="download-plugin" data-plugin="${esc(plugin.id)}">Get latest v${esc(plugin.version)}</button>` : ""}`
          : `<button class="button small" data-action="download-plugin" data-plugin="${esc(plugin.id)}">${cached ? `Download update v${esc(plugin.version)}` : `Install · download v${esc(plugin.version)}`}</button>`;
    return `<article class="card plugin-card"><div class="plugin-icon">${esc(plugin.icon || pluginIcons[plugin.id] || "⊞")}</div><div class="plugin-main"><div class="plugin-heading"><h2>${esc(plugin.name)}</h2><span class="badge accent">Latest v${esc(plugin.version)}</span><span class="badge">${esc(status)}</span></div><p>${esc(plugin.description)}</p><div class="item-meta"><span class="badge">${esc(plugin.location)}</span><a class="badge plugin-release-link" href="https://github.com/pokpokgaming505-ctrl/tayefs-personal-os/releases/tag/${encodeURIComponent(plugin.releaseTag)}" target="_blank" rel="noreferrer">GitHub release ↗</a>${cachedVersion && cachedVersion !== plugin.version ? `<span class="badge">Cached v${esc(cachedVersion)}</span>` : ""}</div>${busy ? `<div class="download-track" role="status" aria-live="polite"><span class="download-bar" style="width:${pluginDownloadProgress || 32}%"></span></div><small class="download-help">GitHub package downloading… ${pluginDownloadProgress ? `${pluginDownloadProgress}%` : "Please wait"}</small>` : !cached ? `<small class="download-help">Install downloads the versioned, data-only package from GitHub. Add activates it after download.</small>` : ""}</div><div class="plugin-actions">${action}</div></article>`;
  }).join("")}</div>
  <section class="callout plugin-note"><strong>Plugin install flow</strong><br>প্রথমে GitHub থেকে versioned JSON package download হয়, এরপর Add চাপলে app-এর supported feature চালু হয়। হাতে download করা release package-ও Import করে Add করতে পারো। Package-এ চালানোর মতো JavaScript থাকে না—বর্তমান app version কেবল তার অনুমোদিত feature adapters চালায়।</section>`;
}
function contentStudioView() {
  const pluginPackage = activePluginPackage("content-studio");
  if (!pluginPackage) return pluginsView();
  const module = pluginPackage.module;
  const items = state.content.items.slice().sort((a, b) => String(a.publishDate || "9999").localeCompare(String(b.publishDate || "9999")));
  const stages = module.stages;
  const templates = module.templates;
  const model = isPluginInstalled("ai-models") ? state.settings.aiModels.find(item => item.id === state.settings.contentAiModel) : null;
  const stageOptions = value => stages.map(stage => `<option ${stage === value ? "selected" : ""}>${esc(stage)}</option>`).join("");
  const platformOptions = value => module.platforms.map(platform => `<option ${platform === value ? "selected" : ""}>${esc(platform)}</option>`).join("");
  const formatOptions = value => module.formats.map(format => `<option ${format === value ? "selected" : ""}>${esc(format)}</option>`).join("");
  const pillarOptions = value => module.pillars.map(pillar => `<option ${pillar === value ? "selected" : ""}>${esc(pillar)}</option>`).join("");
  const totalPublished = items.filter(item => item.stage === "Published").length;
  const inProduction = items.filter(item => ["Research", "Script", "Record", "Edit"].includes(item.stage)).length;
  return `${pageHeading("IDEA → SCRIPT → PUBLISH", "Content Studio", "আইডিয়া, research, hook, script, visuals, caption আর publishing plan—একটি workflow-তে রাখো।", `v${esc(pluginPackage.manifest.version)} · ${items.length} ITEMS`)}
  <div class="metric-grid content-metrics"><div class="metric"><div class="metric-label">✦ IDEAS</div><div class="metric-value">${items.filter(item => item.stage === "Idea").length}</div><div class="metric-foot">ready to shape</div></div><div class="metric"><div class="metric-label">◉ IN PRODUCTION</div><div class="metric-value">${inProduction}</div><div class="metric-foot">research through edit</div></div><div class="metric"><div class="metric-label">◷ SCHEDULED</div><div class="metric-value">${items.filter(item => item.stage === "Scheduled").length}</div><div class="metric-foot">planned to publish</div></div><div class="metric"><div class="metric-label">✓ PUBLISHED</div><div class="metric-value">${totalPublished}</div><div class="metric-foot">in your library</div></div></div>
  <div class="section-grid content-start-grid"><section class="form-card"><h2>Capture a content idea</h2><p>একটি idea লিখে রাখো; পরে brief, hook ও script তৈরি করতে পারো।</p><form id="content-create-form"><div class="field"><label for="content-title">Working title or idea</label><input id="content-title" name="title" maxlength="120" placeholder="e.g. How I automate one boring task" required></div><div class="field-grid"><div class="field"><label for="content-platform">Platform</label><select id="content-platform" name="platform">${platformOptions(module.platforms[0])}</select></div><div class="field"><label for="content-format">Format</label><select id="content-format" name="format">${formatOptions(module.formats[0])}</select></div><div class="field"><label for="content-pillar">Content pillar</label><select id="content-pillar" name="pillar">${pillarOptions(module.pillars[0])}</select></div><div class="field"><label for="content-date">Target publish date</label><input id="content-date" name="publishDate" type="date"></div></div><div class="field"><label for="content-template">Start from a template</label><select id="content-template" name="template">${templates.map(template => `<option value="${esc(template.id)}">${esc(template.name)}</option>`).join("")}</select></div><button class="button" type="submit">+ Add to content pipeline</button></form></section>
  <section class="card content-integration-card">${cardHead("Optional AI writing partner", model ? `Connected to ${esc(model.name)} · drafts only when you request them.` : "Use a model only if you choose to connect one.", `<button class="text-action" type="button" data-action="toggle-content-ai">${contentIntegrationEditorOpen ? "Close setup" : "Integrate AI with Content Studio"}</button>`)}${contentIntegrationEditorOpen ? (!isPluginInstalled("ai-models") ? `<div class="callout">First download and Add AI Models in Plugins. <button type="button" class="text-action" data-view-link="plugins">Open Plugins ↗</button></div>` : state.settings.aiModels.length ? `<form id="content-ai-link-form" class="inline-form"><label for="content-ai-model">Choose the model for this plugin</label><div class="button-row"><select id="content-ai-model" name="modelId" required><option value="">Select a saved model</option>${state.settings.aiModels.map(item => `<option value="${esc(item.id)}" ${state.settings.contentAiModel === item.id ? "selected" : ""}>${esc(item.name)} · ${esc(item.model)}</option>`).join("")}</select><button class="button small" type="submit">Save connection</button></div></form>` : `<div class="callout">Add a model in AI settings first. <button type="button" class="text-action" data-view-link="ai">Open AI ↗</button></div>`) : `<div class="callout">${model ? `Selected model: <strong>${esc(model.name)}</strong>.` : "AI is optional; planning and script fields work without it."} Before a draft request, the app shows which brief will be shared.</div>`}<div class="creator-prompt-points">${module.workflow.map(item => `<span class="badge">${esc(item)}</span>`).join("")}</div></section></div>
  <section class="card content-pipeline-card">${cardHead("Your content pipeline", "Open an item to keep its research, script, production checklist, and publishing notes together.", `<span class="badge">${items.length} ITEMS</span>`)}${items.length ? `<div class="content-items">${items.map(item => `<details class="content-item"><summary><span class="content-item-title"><strong>${esc(item.title)}</strong><small>${esc(item.platform)} · ${esc(item.format)} · ${esc(item.pillar)}${item.publishDate ? ` · ${esc(item.publishDate)}` : ""}</small></span><span class="badge accent">${esc(item.stage)}</span></summary><form class="content-edit-form" data-content-editor="${esc(item.id)}"><div class="field-grid"><div class="field"><label>Title</label><input name="title" maxlength="120" value="${esc(item.title)}" required></div><div class="field"><label>Stage</label><select name="stage">${stageOptions(item.stage)}</select></div><div class="field"><label>Platform</label><select name="platform">${platformOptions(item.platform)}</select></div><div class="field"><label>Format</label><select name="format">${formatOptions(item.format)}</select></div><div class="field"><label>Content pillar</label><select name="pillar">${pillarOptions(item.pillar)}</select></div><div class="field"><label>Target publish date</label><input name="publishDate" type="date" value="${esc(item.publishDate || "")}"></div></div><div class="field-grid"><div class="field"><label>Audience</label><input name="audience" maxlength="160" value="${esc(item.audience || "")}" placeholder="Who is this for?"></div><div class="field"><label>Goal / takeaway</label><input name="goal" maxlength="200" value="${esc(item.goal || "")}" placeholder="What should viewers learn or do?"></div></div><div class="field"><label>Research notes and sources</label><textarea name="research" maxlength="3000" placeholder="Facts to verify, links, examples, references…">${esc(item.research || "")}</textarea></div><div class="field"><label>Title options</label><textarea name="titleOptions" maxlength="1500" placeholder="Write several title variations">${esc(item.titleOptions || "")}</textarea></div><div class="field"><label>Opening hook</label><textarea name="hook" maxlength="1000" placeholder="The first line or visual that earns attention">${esc(item.hook || "")}</textarea></div><div class="field"><label>Outline / storyboard</label><textarea name="outline" maxlength="3000" placeholder="Scene 1 → point → example → payoff">${esc(item.outline || "")}</textarea></div><div class="field"><label>Script / voiceover</label><textarea class="content-script" name="script" maxlength="10000" placeholder="Draft the spoken or written content here">${esc(item.script || "")}</textarea></div><div class="field-grid"><div class="field"><label>Shot list / B-roll / assets</label><textarea name="shotList" maxlength="2000" placeholder="Shots, screen recordings, images, music…">${esc(item.shotList || "")}</textarea></div><div class="field"><label>Thumbnail / cover concept</label><textarea name="thumbnail" maxlength="1000" placeholder="Visual, subject, contrast, short text…">${esc(item.thumbnail || "")}</textarea></div></div><div class="field"><label>Caption, description, or CTA</label><textarea name="caption" maxlength="3000" placeholder="Caption, context, call to action…">${esc(item.caption || "")}</textarea></div><div class="field"><label>Hashtags / keywords</label><input name="hashtags" maxlength="500" value="${esc(item.hashtags || "")}" placeholder="#science #technology"></div><div class="content-checklist"><strong>Production checklist</strong><div>${module.checklist.map((step,index) => `<label><input type="checkbox" data-content-check="${esc(item.id)}|${index}" ${item.checklist?.[index] ? "checked" : ""}><span>${esc(step)}</span></label>`).join("")}</div></div><div class="button-row content-actions"><button class="button secondary small" type="submit">Save content brief</button>${model ? (contentDraftingId === item.id ? `<button type="button" class="button small" disabled><span class="spinner" aria-hidden="true"></span>Drafting…</button>` : `<button type="button" class="button small" data-action="generate-content-draft" data-content-id="${esc(item.id)}">Draft with ${esc(model.name)}</button>`) : ""}<button type="button" class="button secondary small" data-action="remove-content" data-content-id="${esc(item.id)}">Remove</button></div>${item.aiDraft ? `<details class="content-ai-result"><summary>AI draft suggestion · review before using</summary><pre>${esc(item.aiDraft)}</pre></details>` : ""}</form></details>`).join("")}</div>` : emptyState("Your creator desk is ready", "Capture a video, post, or thread idea above to start its research and production checklist.")}</section>
  <div class="callout plugin-note"><strong>Keep your own voice.</strong> Use this as a planning desk: check facts, follow each platform's rules, and review any AI draft before publishing. Content plans stay on this device.</div>`;
}
function gymView() {
  const month = ensureGymMonth(gymSelectedMonth);
  const dates = monthDateKeys(gymSelectedMonth);
  if (!month[gymSelectedDate]) gymSelectedDate = dates[0];
  const day = month[gymSelectedDate];
  const start = new Date(`${gymSelectedMonth}-01T12:00:00`);
  const offset = (start.getDay() + 6) % 7;
  const monthName = start.toLocaleDateString("en", { month: "long", year: "numeric" });
  const completedCount = day.exercises.filter(x => day.completed?.[x.id]).length;
  const linkedModel = state.settings.aiModels.find(x => x.id === state.settings.gymAiModel);
  const calendar = `${Array.from({ length: offset }, () => `<span class="calendar-spacer"></span>`).join("")}${dates.map(key => {
    const item = month[key];
    const selected = key === gymSelectedDate;
    const marker = item.kind === "workout" ? (item.exercises.length ? "◈" : "·") : "·";
    return `<button type="button" class="calendar-day ${selected ? "selected" : ""} ${item.kind === "workout" ? "training" : "recovery"}" data-gym-date="${key}" aria-label="${fmtDate(key)} · ${esc(item.title)}"><strong>${Number(key.slice(-2))}</strong><small>${marker}</small></button>`;
  }).join("")}`;
  const exercises = day.kind === "workout" ? (day.exercises.length ? `<div class="gym-exercise-list">${day.exercises.map((exercise, index) => `<article class="gym-exercise ${day.completed?.[exercise.id] ? "completed" : ""}"><label class="gym-check"><input type="checkbox" data-gym-complete="${esc(day.date)}|${esc(exercise.id)}" ${day.completed?.[exercise.id] ? "checked" : ""} aria-label="Complete ${esc(exercise.name)}"><span>DONE</span></label><form class="gym-exercise-form" data-edit-gym-exercise="${esc(exercise.id)}" data-gym-day="${esc(day.date)}"><label class="gym-exercise-name"><span>EXERCISE ${String(index + 1).padStart(2, "0")}</span><input name="name" value="${esc(exercise.name)}" maxlength="70" required></label><div class="gym-set-fields"><label>Sets<input name="sets" type="number" min="1" max="10" value="${Number(exercise.sets) || 2}" required></label><label>Reps / time<input name="reps" value="${esc(exercise.reps)}" maxlength="30" required></label><button class="icon-action" type="submit" aria-label="Save exercise">✓</button><button class="icon-action" type="button" data-delete-gym-exercise="${esc(day.date)}|${esc(exercise.id)}" aria-label="Remove exercise">×</button></div></form></article>`).join("")}</div>` : emptyState("No exercises added yet", "Add the exercises you want to do for this day.")) : `<div class="recovery-card"><span>↟</span><strong>Recovery day</strong><p>Rest is part of a routine. If it feels good, choose an easy walk or gentle mobility; there is no need to make up missed sessions.</p></div>`;
  return `${pageHeading("YOUR OPTIONAL TRAINING PLAN", "Gym", "A one-month plan you can reshape around school, energy, and how each movement feels. This is a starting template, not a personal prescription.", `${dates.length} DAYS · ${completedCount}/${day.exercises.length} DONE TODAY`)}
  <div class="gym-layout"><section class="card gym-calendar-card"><div class="gym-month-head"><button class="icon-action" type="button" data-gym-month="previous" aria-label="Previous month">‹</button><h2>${esc(monthName)}</h2><button class="icon-action" type="button" data-gym-month="next" aria-label="Next month">›</button></div><div class="calendar-grid calendar-weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(x => `<span>${x}</span>`).join("")}</div><div class="calendar-grid">${calendar}</div><div class="field-help" style="margin-top:12px">◈ Workout · · Recovery / rest · Tap a day to edit it.</div></section>
  <div class="stack"><section class="card gym-session-card">${cardHead(`<span>${fmtDate(day.date)} · ${day.kind === "workout" ? "Workout" : "Rest day"}</span>`, day.focus, `<span class="badge">${completedCount}/${day.exercises.length} COMPLETE</span>`)}<form class="gym-day-form" data-gym-day-form="${esc(day.date)}"><div class="field-grid"><div class="field"><label>Session title</label><input name="title" value="${esc(day.title)}" maxlength="60" required></div><div class="field"><label>Focus / note</label><input name="focus" value="${esc(day.focus)}" maxlength="140"></div></div><div class="field"><label>My note (optional)</label><textarea name="notes" maxlength="400" placeholder="Change this day's plan or add a reminder">${esc(day.notes || "")}</textarea></div><button class="button secondary small" type="submit">Save day plan</button> <button class="text-action" type="button" data-action="toggle-gym-day">${day.kind === "workout" ? "Set as recovery day" : "Make this a workout day"}</button></form>${exercises}${day.kind === "workout" ? `<form class="gym-add-form" id="gym-add-exercise" data-gym-day="${esc(day.date)}"><strong>Add exercise</strong><div class="field-grid"><div class="field"><label>Name</label><input name="name" maxlength="70" placeholder="e.g. Goblet squat" required></div><div class="field-grid gym-add-numbers"><div class="field"><label>Sets</label><input name="sets" type="number" min="1" max="10" value="2" required></div><div class="field"><label>Reps / time</label><input name="reps" value="8–12" maxlength="30" required></div></div></div><button class="button small" type="submit">+ Add to this day</button></form>` : ""}</section>
  <section class="card gym-ai-card">${cardHead("Nutrition ideas with AI", linkedModel ? `Connected to ${esc(linkedModel.name)} · ask only when you choose.` : "Optional. Connect a model only when you want to use it.", `<button class="text-action" type="button" data-action="toggle-gym-ai">${gymIntegrationEditorOpen ? "Close setup" : "Integrate AI with Gym plugin"}</button>`)}${gymIntegrationEditorOpen ? (state.settings.aiModels.length ? `<form id="gym-ai-link-form" class="inline-form"><label for="gym-ai-model">Choose a model for Gym</label><div class="button-row"><select id="gym-ai-model" name="modelId" required><option value="">Select a saved model</option>${state.settings.aiModels.map(model => `<option value="${esc(model.id)}" ${state.settings.gymAiModel === model.id ? "selected" : ""}>${esc(model.name)} · ${esc(model.model)}</option>`).join("")}</select><button class="button small" type="submit">Save connection</button></div></form>` : `<div class="callout">Install AI Models and add a provider first. <button class="text-action" data-view-link="plugins">Open Plugins ↗</button></div>`) : ""}${linkedModel ? `<form id="gym-nutrition-form" class="gym-profile-form"><p>Enter only what you want to share. On submit, the app names the configured provider and asks before sending this profile.</p><div class="field-grid"><div class="field"><label for="gym-age">Age</label><input id="gym-age" name="age" type="number" min="10" max="100" placeholder="e.g. 17" required></div><div class="field"><label for="gym-height">Height (cm)</label><input id="gym-height" name="height" type="number" min="100" max="230" placeholder="e.g. 170" required></div><div class="field"><label for="gym-weight">Weight (kg, optional under 18)</label><input id="gym-weight" name="weight" type="number" min="25" max="300" step="0.1" placeholder="Optional"></div><div class="field"><label for="gym-training-days">Gym days per week</label><input id="gym-training-days" name="trainingDays" type="number" min="0" max="7" value="3" required></div></div><div class="field"><label for="gym-goal">What would help?</label><select id="gym-goal" name="goal"><option>Balanced meal ideas</option><option>Everyday energy</option><option>Training recovery</option><option>General nutrition questions</option></select></div><button class="button small" type="submit">Ask ${esc(linkedModel.name)}</button><div class="field-help">For anyone under 18, this feature will not produce calorie or protein targets or weight-loss plans. It can offer general balanced-meal ideas and encourage a conversation with a parent/guardian and qualified health professional.</div></form><div id="gym-ai-response" class="ai-response hidden" aria-live="polite"></div>` : `<div class="callout">No model connected yet. <button class="text-action" type="button" data-action="toggle-gym-ai">Set up AI connection</button></div>`}</section></div></div>
  <section class="callout gym-safety"><strong>Keep training comfortable and supervised.</strong> This editable starter plan uses moderate sets and repetitions, includes recovery days, and does not use maximum lifts. Learn technique with a qualified adult; stop if something hurts. <a href="https://www.healthychildren.org/English/healthy-living/sports/Pages/Strength-Training.aspx" target="_blank" rel="noreferrer">AAP guidance ↗</a></section>`;
}
function aiView() {
  const models = state.settings.aiModels;
  return `${pageHeading("YOUR PERSONAL ASSISTANT", "AI", "Study, ideas, technology, business logic—নিজের প্রশ্ন করো। অন্য plugin-এ AI জুড়তে হলে সেই plugin-এর integration control থেকে আলাদা করে model বেছে নাও।", `${models.length} MODEL${models.length === 1 ? "" : "S"}`)}
  <section class="card ai-chat-card"><div class="card-head"><div><div class="card-title">Ask your assistant</div><div class="card-sub">Prompt শুধু তুমি submit করলে selected model-এ যাবে।</div></div><span class="badge accent">YOUR CHOICE</span></div>${models.length ? `<form id="ai-chat-form"><div class="field"><label for="ai-chat-model">Choose model</label><select id="ai-chat-model" name="modelId" required>${models.map(model => `<option value="${esc(model.id)}">${esc(model.name)} · ${esc(model.model)}</option>`).join("")}</select></div><div class="field"><label for="ai-chat-prompt">What do you want to work through?</label><textarea id="ai-chat-prompt" name="prompt" maxlength="3000" placeholder="Ask about a study topic, an IT idea, or a system you want to automate…" required></textarea></div><button class="button small" type="submit">Send to selected model</button></form>` : `<div class="empty-state">Add a model profile below, then enter its key for this session.</div>`}<div id="ai-chat-response" class="ai-response hidden" aria-live="polite"></div></section>
  <section class="form-card ai-model-form-card"><h2>Add an OpenAI-compatible model</h2><p>Model list এই device-এ save হয়। API key শুধু বর্তমান app session-এর memory-তে থাকে; app বন্ধ বা reload করলে আবার দিতে হবে। Request পাঠানোর আগে Gym plugin আলাদা করে confirmation নেয়।</p><form id="ai-model-form"><div class="field-grid"><div class="field"><label for="ai-model-name">Display name</label><input id="ai-model-name" name="name" maxlength="50" placeholder="e.g. Study helper" required></div><div class="field"><label for="ai-model-id">Model ID</label><input id="ai-model-id" name="model" maxlength="100" placeholder="e.g. gpt-4o-mini" required></div></div><div class="field"><label for="ai-model-endpoint">OpenAI-compatible base URL</label><input id="ai-model-endpoint" name="endpoint" type="url" placeholder="https://api.example.com/v1" required></div><div class="field"><label for="ai-model-key">API key</label><input id="ai-model-key" name="apiKey" type="password" autocomplete="off" placeholder="Stored in memory until this app closes" required></div><button class="button" type="submit">+ Add model</button></form><div class="field-help" style="margin-top:10px">Endpoint must support Chat Completions and browser CORS. Use HTTPS, or HTTP only for localhost models. API providers receive only the prompt and details you explicitly send.</div></section>
  <section class="card plugin-model-list">${cardHead("Saved model profiles", "The list keeps names and endpoints; keys are never written to app storage.", `<span class="badge">${models.length} MODELS</span>`)}${models.length ? `<div class="list-stack">${models.map(model => `<article class="item-card ai-model-card"><div class="item-main"><h3>${esc(model.name)}</h3><p>${esc(model.model)} · ${esc(model.endpoint)}</p><div class="item-meta"><span class="badge">${sessionApiKeys.has(model.id) ? "KEY READY THIS SESSION" : "KEY NEEDED THIS SESSION"}</span>${state.settings.gymAiModel === model.id ? `<span class="badge accent">CONNECTED TO GYM</span>` : ""}</div></div><form class="session-key-form" data-ai-key-form="${esc(model.id)}"><label class="sr-only" for="key-${esc(model.id)}">API key for ${esc(model.name)}</label><input id="key-${esc(model.id)}" type="password" name="apiKey" autocomplete="off" placeholder="Re-enter key" ${sessionApiKeys.has(model.id) ? "" : "required"}><button class="button secondary small" type="submit">${sessionApiKeys.has(model.id) ? "Replace key" : "Set key"}</button></form><button class="icon-action" type="button" data-delete-ai-model="${esc(model.id)}" aria-label="Remove ${esc(model.name)}">×</button></article>`).join("")}</div>` : emptyState("No models yet", "Add a model above, then choose it inside any plugin that supports AI integration.")}</section>
  <div class="callout plugin-note"><strong>Privacy and choice</strong><br>API keys are session-only. When a plugin sends a request, it uses the selected model provider's endpoint; the app shows a confirmation before including health or workout information.</div>`;
}
function studyView() {
  const records = state.study.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const today = totalMinutes(todayEntries(state.study));
  const bySubject = Object.entries(state.study.reduce((acc,x)=>{acc[x.subject]=(acc[x.subject]||0)+(Number(x.minutes)||0);return acc;},{})).sort((a,b)=>b[1]-a[1]);
  return `${pageHeading("LEARN WITH INTENTION","Study room","বিজ্ঞান ও অন্য বিষয়গুলো ছোট focused session-এ ভাগ করে শেখো।",`${minsLabel(today)} TODAY`)}
  <div class="dashboard-grid"><div class="stack"><section class="form-card"><h2>Log a study session</h2><p>পড়ার সময়টা নথিবদ্ধ করো—তারপর চাইলে কোন বিষয়টা এগোল সেটাও যোগ করো।</p><form id="study-form"><div class="field-grid"><div class="field"><label for="study-subject">Subject</label><input id="study-subject" name="subject" maxlength="60" placeholder="Physics, Chemistry, English…" required></div><div class="field"><label for="study-minutes">Focused minutes</label><input id="study-minutes" name="minutes" type="number" min="1" max="720" placeholder="45" required></div></div><div class="field"><label for="study-note">What did you cover? (optional)</label><input id="study-note" name="note" maxlength="140" placeholder="Chapter, problem set, or takeaway"></div><button class="button" type="submit">Save study session</button></form></section>
  <section class="card">${cardHead("Recent study sessions","A record of showing up.",`<span class="badge">${records.length} SESSIONS</span>`)}${records.length?`<div class="list-stack">${records.slice(0,10).map(x=>`<article class="item-card"><div class="item-main"><h3>${esc(x.subject)}</h3><p>${esc(x.note||"Focused study time")}</p><div class="item-meta"><span class="badge accent">${x.minutes} MIN</span><span class="badge">${fmtDate(x.date)}</span></div></div><button class="icon-action" data-delete="study" data-id="${esc(x.id)}" aria-label="Delete study session">×</button></article>`).join("")}</div>`:emptyState("Your study log starts with one session","Try a focused block, then note what you learned.")}</section></div>
  <div class="stack"><section class="card">${cardHead("This week's study","Keep a steady rhythm.")} ${miniWeekBars(state.study)}<div class="bar-caption">${minsLabel(totalMinutes(state.study.filter(x=>x.date>=weekStartKey())))} logged since Monday</div></section><section class="card">${cardHead("Subjects in rotation","Based on your logged sessions.")} ${bySubject.length?`<div class="list-stack">${bySubject.slice(0,6).map(([name,mins])=>`<div class="habit-row"><strong>${esc(name)}</strong><span class="badge">${minsLabel(mins)}</span></div>`).join("")}</div>`:emptyState("Your subjects will show here","Log a session to begin.")}</section><div class="callout"><strong>Small reminder</strong><br>Study to understand one thing clearly. Your plan can change as you learn more about yourself.</div></div></div>`;
}
function buildView() {
  const projects = state.projects.slice().sort((a,b)=>b.created.localeCompare(a.created));
  const tasks = state.tasks.filter(t=>t.area==="CREATE"||t.area==="BRAND");
  return `${pageHeading("MAKE IDEAS REAL","Build & create","Tech projects, Roblox builds, content experiments—keep the next small step visible.",`${projects.length} PROJECT${projects.length===1?"":"S"}`)}
  <div class="button-row" style="margin-bottom:15px">${blankButton("+ New project","add-project")}<button class="button secondary" data-action="add-task">+ Add a build task</button></div>
  <section class="card">${cardHead("Project board","Move each idea forward when you are ready.",`<span class="badge">IDEA → BUILD → DONE</span>`)}${projects.length?`<div class="list-stack">${projects.map(p=>`<article class="item-card"><div class="item-main"><h3>${esc(p.title)}</h3><p>${esc(p.description||"A project in progress.")}</p><div class="item-meta"><span class="badge">${esc(p.category||"PERSONAL")}</span><span class="badge">${fmtDate(p.created)}</span>${p.starter?`<span class="badge">STARTER IDEA</span>`:""}</div></div><div class="item-actions"><select class="status-select" data-project-status="${esc(p.id)}" aria-label="Project status"><option ${p.status==="Idea"?"selected":""}>Idea</option><option ${p.status==="Building"?"selected":""}>Building</option><option ${p.status==="Done"?"selected":""}>Done</option></select><button class="icon-action" data-delete="projects" data-id="${esc(p.id)}" aria-label="Delete project">×</button></div></article>`).join("")}</div>`:emptyState("Every good build starts small","Add a Roblox, technology, automation, or content project when an idea catches your attention.")}</section>
  <div class="section-grid" style="margin-top:13px"><section class="card">${cardHead("Build tasks","Next actions connected to making things.",`<button class="text-action" data-action="add-task">+ Add</button>`)}${tasks.length?taskRows(tasks,true):emptyState("No build tasks yet","Capture the next small action, not the whole project.")}</section><section class="card">${cardHead("A simple business lens","Notice problems before you automate them.",`<span class="badge accent">LEARN</span>`)}<p class="quote">Find a repeated problem. Make the fix simpler. Then let a useful system handle the boring part.<small>ONE QUESTION: WHAT COULD BE MADE EASIER?</small></p></section></div>`;
}
function libraryView() {
  const books = state.books.slice();
  const notes = state.notes.slice().sort((a,b)=>b.created.localeCompare(a.created));
  return `${pageHeading("KEEP YOUR CURIOSITY","Ideas & library","Books, anime, business logic, and out-of-the-box thoughts—all in one place.",`${books.length} BOOKS · ${notes.length} NOTES`)}
  <div class="button-row" style="margin-bottom:15px"><button class="button" data-action="add-book">+ Add a book</button><button class="button secondary" data-action="add-note">+ Capture an idea</button></div>
  <section class="card">${cardHead("Reading shelf","Your list can hold books you want to read, are reading, or finished.",`<span class="badge">${books.length} ITEMS</span>`)}${books.length?`<div class="list-stack">${books.map((b,i)=>`<article class="item-card"><div class="book-cover ${i%2?"green":""}">${bookMark(b.title)}</div><div class="item-main"><h3>${esc(b.title)}</h3><p>${esc(b.author||"Add an author when you like")}</p><div class="item-meta"><span class="badge accent">${esc(b.status)}</span>${b.starter?`<span class="badge">SUGGESTED STARTER</span>`:""}</div></div><div class="item-actions"><select class="status-select" data-book-status="${esc(b.id)}" aria-label="Reading status"><option ${b.status==="Queue"?"selected":""}>Queue</option><option ${b.status==="Reading"?"selected":""}>Reading</option><option ${b.status==="Finished"?"selected":""}>Finished</option></select><button class="icon-action" data-delete="books" data-id="${esc(b.id)}" aria-label="Remove book">×</button></div></article>`).join("")}</div>`:emptyState("Your shelf is ready","Add a book, essay, or topic you want to explore.")}</section>
  <section class="card" style="margin-top:13px">${cardHead("Idea notes","Capture the useful bit while it is fresh.",`<button class="text-action" data-action="add-note">+ New note</button>`)}${notes.length?`<div class="list-stack">${notes.map(n=>`<article class="item-card"><div class="item-main"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="item-meta"><span class="badge">${fmtDate(n.date)}</span><span class="badge">${esc(n.topic||"GENERAL")}</span></div></div><button class="icon-action" data-delete="notes" data-id="${esc(n.id)}" aria-label="Delete note">×</button></article>`).join("")}</div>`:emptyState("Nothing captured yet","Use a short title and write down one idea in your own words.")}</section>`;
}
function reviewView() {
  const week = weekStartKey();
  const weekDays = daysBetween(week);
  const weekStudy = state.study.filter(x=>x.date>=week && x.date<=weekDays[6].key);
  const weekHealth = state.health.filter(x=>x.date>=week && x.date<=weekDays[6].key);
  const weekTasks = state.tasks.filter(x=>x.date>=week && x.date<=weekDays[6].key);
  const weekProjects = state.projects.filter(x=>x.created>=week && x.created<=weekDays[6].key);
  const done = weekTasks.filter(x=>x.done).length;
  const review = state.reviews[week] || { wentWell:"", learned:"", next:"" };
  return `${pageHeading("REFLECT, THEN RESET","Weekly review","কী কাজ করেছে, কী শিখেছো, আর পরের সপ্তাহে কোন ছোট পদক্ষেপ নেবে?",`WEEK OF ${fmtDate(week).toUpperCase()}`)}
  <div class="metric-grid" style="margin-bottom:13px"><div class="metric"><div class="metric-label"><span>▤</span> STUDY</div><div class="metric-value">${minsLabel(totalMinutes(weekStudy))}</div><div class="metric-foot">${weekStudy.length} sessions</div></div><div class="metric"><div class="metric-label"><span>♡</span> MOVEMENT</div><div class="metric-value">${minsLabel(totalMinutes(weekHealth.filter(x=>x.kind==="movement")))}</div><div class="metric-foot">${weekHealth.filter(x=>x.kind==="movement").length} check-ins</div></div><div class="metric"><div class="metric-label"><span>✓</span> MISSIONS</div><div class="metric-value">${done}<small> / ${weekTasks.length}</small></div><div class="metric-foot">completed</div></div><div class="metric"><div class="metric-label"><span>⌘</span> BUILDS</div><div class="metric-value">${weekProjects.length}</div><div class="metric-foot">new projects this week</div></div></div>
  <div class="section-grid"><section class="card">${cardHead("Your week in focus","A gentle picture of your study time.")} ${miniWeekBars(weekStudy)}<div class="bar-caption">${minsLabel(totalMinutes(weekStudy))} total · progress can be quiet</div><div class="divider"></div><div class="callout"><strong>Keep the long view.</strong><br>A week is one small chapter. Notice what gave you energy and what made things harder.</div></section>
  <section class="form-card">${cardHead("A few prompts","Save a private note for your future self.")}<form id="review-form"><div class="field"><label for="review-well">What went well?</label><textarea id="review-well" name="wentWell" maxlength="500" placeholder="A small win, a good question, a moment you showed up…">${esc(review.wentWell)}</textarea></div><div class="field"><label for="review-learned">What did you learn?</label><textarea id="review-learned" name="learned" maxlength="500" placeholder="About a subject, a project, or yourself…">${esc(review.learned)}</textarea></div><div class="field"><label for="review-next">What is one next step?</label><textarea id="review-next" name="next" maxlength="300" placeholder="Keep it small and specific.">${esc(review.next)}</textarea></div><button class="button" type="submit">Save weekly reflection</button></form></section></div>`;
}
const renderers = { dashboard:dashboardView, health:healthView, gym:gymView, study:studyView, build:buildView, content:contentStudioView, library:libraryView, review:reviewView, ai:aiView, plugins:pluginsView };
function render({ focus = false } = {}) {
  $("#page-content").innerHTML = (renderers[activeView] || dashboardView)();
  $("#page-crumb").textContent = views[activeView] || views.dashboard;
  $$('[data-plugin-nav]').forEach(button => button.classList.toggle("hidden", !isPluginInstalled(button.dataset.pluginNav)));
  $$('[data-view]').forEach(button => { const selected = button.dataset.view === activeView; button.classList.toggle("active",selected); if (selected) button.setAttribute("aria-current","page"); else button.removeAttribute("aria-current"); });
  if (focus) $("#page-content").focus({ preventScroll:true });
  wireTimerControls();
}
function navigate(view) {
  if (!renderers[view]) return;
  if (view === "gym" && !isPluginInstalled("gym")) view = "plugins";
  if (view === "ai" && !isPluginInstalled("ai-models")) view = "plugins";
  if (view === "content" && !isPluginInstalled("content-studio")) view = "plugins";
  activeView = view;
  render({ focus:true });
  history.replaceState(null,"",`#${view}`);
  if (view === "plugins") refreshPluginCatalog();
}
function toast(message, error = false) {
  const region = $("#toast-region");
  const node = document.createElement("div");
  node.className = `toast${error?" error":""}`;
  node.textContent = message;
  region.append(node);
  setTimeout(()=>node.remove(),2800);
}
function showDialog(title, description, fields, submitLabel, onSubmit) {
  const dialog = $("#app-dialog");
  $("#dialog-content").innerHTML = `<h2 class="dialog-title">${title}</h2><p class="dialog-description">${description}</p><form id="modal-form">${fields}<div class="dialog-actions"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button" type="submit">${submitLabel}</button></div></form>`;
  const form = $("#modal-form");
  form.addEventListener("submit", event=>{ event.preventDefault(); const result=onSubmit(new FormData(form)); if (result !== false) { dialog.close(); render(); } });
  $$("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.showModal();
  $("#dialog-content input")?.focus();
}
const field = (name,label,placeholder,type="text",required=true,extra="") => `<div class="dialog-field"><label for="modal-${name}">${label}</label><input id="modal-${name}" name="${name}" type="${type}" placeholder="${placeholder}" ${required?"required":""} ${extra}></div>`;
const selectField = (name,label,options) => `<div class="dialog-field"><label for="modal-${name}">${label}</label><select id="modal-${name}" name="${name}">${options.map(x=>`<option>${x}</option>`).join("")}</select></div>`;
function addTaskDialog() {
  showDialog("Add a small next step","Keep it clear enough to start.",`${field("title","What needs doing?","e.g. Review one physics concept")}${selectField("area","Area",["STUDY","HEALTH","CREATE","BRAND","PERSONAL"])}`,"Add task",data=>{
    const title=String(data.get("title")||"").trim(); if (!title) return false;
    state.tasks.unshift({id:uid(),title,area:String(data.get("area")),date:nowDateKey,done:false});save();toast("Task added to today.");
  });
}
function addProjectDialog() {
  showDialog("Start a project","A project can begin as an idea; you can change its status as it grows.",`${field("title","Project name","e.g. Roblox obstacle course")}${field("description","What is the idea?","One short description", "text", false)}${selectField("category","Category",["Technology","Roblox","Automation","Content","Personal"])}`,"Create project",data=>{
    const title=String(data.get("title")||"").trim();if(!title)return false;
    state.projects.unshift({id:uid(),title,description:String(data.get("description")||"").trim(),category:String(data.get("category")),status:"Idea",created:nowDateKey});save();toast("Project created.");
  });
}
function addBookDialog() {
  showDialog("Add to your shelf","Books, essays, courses, or topics you want to explore.",`${field("title","Title","e.g. Deep Work")}${field("author","Author or source","Optional", "text", false)}${selectField("status","Reading status",["Queue","Reading","Finished"])}`,"Add to shelf",data=>{
    const title=String(data.get("title")||"").trim();if(!title)return false;
    state.books.unshift({id:uid(),title,author:String(data.get("author")||"").trim(),status:String(data.get("status"))});save();toast("Added to your library.");
  });
}
function addNoteDialog() {
  showDialog("Capture an idea","Write the thought in your own words so you can find it later.",`${field("title","Short title","The idea in a few words")}${selectField("topic","Topic",["BOOKS","BUSINESS","ANIME","TECH","SCIENCE","PERSONAL"])}<div class="dialog-field"><label for="modal-body">Your note</label><textarea id="modal-body" name="body" maxlength="1200" placeholder="What caught your attention?" required></textarea></div>`,"Save note",data=>{
    const title=String(data.get("title")||"").trim(),body=String(data.get("body")||"").trim();if(!title||!body)return false;
    state.notes.unshift({id:uid(),title,body,topic:String(data.get("topic")),date:nowDateKey,created:new Date().toISOString()});save();toast("Idea saved.");
  });
}
function wireTimerControls() {
  const display=$("#focus-timer"); if(!display)return;
  const paint=()=>{display.textContent=`${String(Math.floor(timerSeconds/60)).padStart(2,"0")}:${String(timerSeconds%60).padStart(2,"0")}`;};
  paint();
  const toggle=$("#timer-toggle"),reset=$("#timer-reset");
  toggle?.addEventListener("click",()=>{
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;toggle.textContent="Resume focus";return;}
    toggle.textContent="Pause";
    timerInterval=setInterval(()=>{timerSeconds=Math.max(0,timerSeconds-1);paint();if(timerSeconds===0){clearInterval(timerInterval);timerInterval=null;toggle.textContent="Start focus";timerSeconds=25*60;const record=confirm("Focus session complete. Add 25 minutes to your study log?");if(record){state.study.unshift({id:uid(),subject:"Focus session",minutes:25,date:nowDateKey,note:"Completed with the TAYEF'S focus timer."});save();if(activeView==="dashboard")render();toast("Focus session saved to Study.");}else toast("Focus session complete. Take a short break.");}},1000);
  });
  reset?.addEventListener("click",()=>{clearInterval(timerInterval);timerInterval=null;timerSeconds=25*60;paint();toggle.textContent="Start focus";});
}
function applyTheme(theme) {
  state.settings.theme = themeClasses.includes(`theme-${theme}`) ? theme : "focus";
  document.body.classList.remove(...themeClasses);
  document.body.classList.add(`theme-${state.settings.theme}`);
  $("#theme-select").value=state.settings.theme;
  save();
}
function applyTextPreferences() {
  const scale = { small: 0.94, normal: 1.08, large: 1.18, xlarge: 1.3 };
  const families = {
    sans: '"Hind Siliguri", "Noto Sans Bengali", "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    serif: '"Noto Serif Bengali", "Noto Serif", Georgia, serif',
    mono: '"Cascadia Code", "Noto Sans Bengali", ui-monospace, Consolas, monospace'
  };
  const size = Object.hasOwn(scale, state.settings.textSize) ? state.settings.textSize : "normal";
  const style = Object.hasOwn(families, state.settings.fontStyle) ? state.settings.fontStyle : "sans";
  document.documentElement.style.setProperty("--text-scale", scale[size]);
  document.documentElement.style.setProperty("--app-font", families[style]);
  $("#text-size-select").value = size;
  $("#font-style-select").value = style;
}
async function refreshPluginCatalog() {
  if (pluginCatalogRefreshPromise) return pluginCatalogRefreshPromise;
  pluginCatalogRefreshPromise = (async () => {
    try {
      const response = await fetch(`${REPOSITORY_RAW}/main/plugins/catalog.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const payload = await response.json();
      if (payload.schemaVersion !== 1 || !Array.isArray(payload.plugins)) throw new Error("Unsupported catalog format");
      const remote = new Map();
      for (const item of payload.plugins.slice(0, 20)) {
        const base = bundledPluginCatalog.find(candidate => candidate.id === item.id);
        if (!base || !/^\d+\.\d+\.\d+$/.test(String(item.version || "")) || item.releaseTag !== `${item.id}-v${item.version}` || !/^[a-f0-9]{64}$/i.test(String(item.sha256 || ""))) continue;
        remote.set(item.id, { ...base, version: item.version, releaseTag: item.releaseTag, sha256: item.sha256.toLowerCase(), packageUrl: `${REPOSITORY_RAW}/${item.releaseTag}/plugins/${item.id}/package.json` });
      }
      if (remote.size) {
        pluginCatalog = bundledPluginCatalog.map(base => remote.get(base.id) || { ...base, packageUrl: `${REPOSITORY_RAW}/${base.releaseTag}/plugins/${base.id}/package.json` });
        if (activeView === "plugins") render();
      }
    } catch (error) {
      console.info("Using the bundled plugin catalog while offline.", error);
    } finally {
      pluginCatalogRefreshPromise = null;
    }
  })();
  return pluginCatalogRefreshPromise;
}
async function downloadPlugin(id) {
  const plugin = pluginCatalog.find(item => item.id === id);
  if (!plugin || downloadingPluginId) return;
  downloadingPluginId = id;
  pluginDownloadProgress = 0;
  if (activeView === "plugins") render();
  let lastPaint = 0;
  try {
    const response = await fetch(plugin.packageUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`GitHub package download failed (${response.status}).`);
    const declaredLength = Number(response.headers.get("content-length")) || 0;
    if (declaredLength > PLUGIN_PACKAGE_MAX_BYTES) throw new Error("This plugin package is larger than the allowed 512 KB.");
    let bytes;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > PLUGIN_PACKAGE_MAX_BYTES) { await reader.cancel(); throw new Error("This plugin package is larger than the allowed 512 KB."); }
        chunks.push(value);
        pluginDownloadProgress = declaredLength ? Math.min(99, Math.floor(length / declaredLength * 100)) : 0;
        const now = Date.now();
        if (now - lastPaint > 180 && activeView === "plugins") { render(); lastPaint = now; }
      }
      bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } else {
      bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > PLUGIN_PACKAGE_MAX_BYTES) throw new Error("This plugin package is larger than the allowed 512 KB.");
    }
    const digestBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const digest = [...new Uint8Array(digestBuffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (!/^[a-f0-9]{64}$/i.test(plugin.sha256) || digest !== plugin.sha256.toLowerCase()) throw new Error("The downloaded file did not match the GitHub catalog checksum.");
    const pluginPackage = JSON.parse(new TextDecoder().decode(bytes));
    validatePluginPackage(pluginPackage, id);
    if (pluginPackage.manifest.version !== plugin.version || pluginPackage.manifest.releaseTag !== plugin.releaseTag) throw new Error("The package version does not match its GitHub release.");
    state.settings.pluginPackages[id] = pluginPackage;
    save();
    pluginDownloadProgress = 100;
    toast(`${plugin.name} v${plugin.version} downloaded. Tap Add to activate it.`);
  } catch (error) {
    toast(error.message || "Could not download this plugin. Check your connection and try again.", true);
  } finally {
    downloadingPluginId = "";
    setTimeout(() => { pluginDownloadProgress = 0; if (activeView === "plugins") render(); }, 350);
    if (activeView === "plugins") render();
  }
}
function importPluginFile(file) {
  if (!file) return;
  if (file.size > PLUGIN_PACKAGE_MAX_BYTES) { toast("Plugin packages are limited to 512 KB.", true); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const pluginPackage = validatePluginPackage(JSON.parse(String(reader.result)));
      const id = pluginPackage.manifest.id;
      if (!pluginCatalog.some(item => item.id === id)) throw new Error("This plugin is not listed in this app's supported catalog.");
      state.settings.pluginPackages[id] = pluginPackage;
      save();
      render();
      toast(`${pluginPackage.manifest.name} v${pluginPackage.manifest.version} imported. Tap Add to activate it.`);
    } catch (error) { toast(error.message || "That plugin package could not be read.", true); }
  };
  reader.onerror = () => toast("Could not read that plugin package file.", true);
  reader.readAsText(file);
}
function installPlugin(id) {
  const plugin = pluginCatalog.find(item => item.id === id);
  const pluginPackage = cachedPlugin(id);
  if (!plugin) { toast("This plugin is not in the current catalog.", true); return; }
  if (!pluginPackage) { navigate("plugins"); toast(`Download ${plugin.name} first. Add becomes available when the download finishes.`); downloadPlugin(id); return; }
  try { validatePluginPackage(pluginPackage, id); } catch (error) { toast(error.message, true); return; }
  if (!state.settings.installedPlugins.includes(id)) state.settings.installedPlugins.push(id);
  state.settings.installedPluginVersions[id] = pluginPackage.manifest.version;
  if (id === "gym") ensureGymMonth(gymSelectedMonth);
  save();
  contentIntegrationEditorOpen = false;
  toast(`${plugin.name} v${pluginPackage.manifest.version} added to this app.`);
  navigate(id === "gym" ? "gym" : id === "ai-models" ? "ai" : id === "content-studio" ? "content" : "plugins");
}
function removePlugin(id) {
  const plugin = pluginCatalog.find(item => item.id === id);
  if (!plugin) return;
  state.settings.installedPlugins = state.settings.installedPlugins.filter(item => item !== id);
  delete state.settings.installedPluginVersions[id];
  if (id === "ai-models") {
    sessionApiKeys.clear();
    state.settings.gymAiModel = "";
    state.settings.contentAiModel = "";
  }
  save();
  gymIntegrationEditorOpen = false;
  toast(`${plugin.name} removed. Your saved plan and settings stay on this device.`);
  navigate("plugins");
}
function endpointForModel(endpoint) {
  const parsed = new URL(endpoint);
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) throw new Error("Use HTTPS, or HTTP only for a localhost model.");
  if (!parsed.pathname.replace(/\/$/, "").endsWith("/chat/completions")) parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/chat/completions`;
  return parsed.toString();
}
async function askGymModel(form) {
  const model = state.settings.aiModels.find(item => item.id === state.settings.gymAiModel);
  const apiKey = model && sessionApiKeys.get(model.id);
  const responseBox = $("#gym-ai-response");
  if (!model || !apiKey) { toast("Open AI Models and enter this model's API key for the current session.", true); return; }
  const data = new FormData(form);
  const profile = {
    age: Number(data.get("age")),
    heightCm: Number(data.get("height")),
    weightKg: Number(data.get("weight")) || null,
    gymDaysPerWeek: Number(data.get("trainingDays")),
    request: String(data.get("goal"))
  };
  const isMinor = profile.age < 18;
  if (isMinor) profile.weightKg = null;
  const gymDays = state.gym.months[gymSelectedMonth]?.[gymSelectedDate];
  const workoutSummary = gymDays?.kind === "workout" ? `${gymDays.title}: ${gymDays.exercises.map(x => `${x.name}, ${x.sets} sets, ${x.reps}`).join("; ")}` : "No workout selected for this day.";
  const confirmation = `Send your age, height, weekly gym days, selected session (${workoutSummary}), and nutrition request to ${model.name} at ${model.endpoint}? Your API key will be sent for authentication. The provider may handle the shared details under its own privacy policy. Continue?`;
  if (!confirm(confirmation)) return;
  responseBox.classList.remove("hidden");
  responseBox.textContent = "Waiting for your selected model…";
  const safetyPrompt = isMinor
    ? "The user is under 18. Do not calculate or recommend daily calorie numbers, protein gram targets, weight loss, body composition goals, restrictive diets, or supplements. Give only general balanced-meal ideas, ordinary hydration and recovery reminders. Encourage asking a parent or guardian and a pediatric clinician or registered dietitian for personalized nutrition targets. Do not infer medical conditions. Reply in clear Bengali, briefly, and say that you are an AI rather than a clinician."
    : "Give general educational nutrition information only. If asked for calories or protein, provide a cautious rough range with the assumptions and uncertainty stated, do not prescribe weight loss or supplements, and recommend a qualified clinician or dietitian for personal advice. Reply in clear Bengali and say that you are an AI rather than a clinician.";
  const prompt = `Nutrition question for an app user. Profile they chose to share: ${JSON.stringify(profile)}. Current gym session: ${workoutSummary}. ${safetyPrompt} Do not repeat identifying details. If needed information is missing, explain what is missing instead of guessing.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const result = await fetch(endpointForModel(model.endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model.model, messages: [{ role: "user", content: prompt }], temperature: 0.4 }),
      signal: controller.signal
    });
    if (!result.ok) throw new Error(`Provider returned ${result.status}. Check the endpoint, API key, model ID, and provider limits.`);
    const payload = await result.json();
    const answer = payload.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("The provider returned an empty response.");
    responseBox.textContent = answer.trim();
  } catch (error) {
    responseBox.textContent = error.name === "AbortError" ? "The model took too long. Try again when ready." : (error.message || "The model could not be reached. Check its CORS and endpoint settings.");
    responseBox.classList.add("error");
  } finally {
    clearTimeout(timeout);
  }
}
async function askGeneralModel(form) {
  const data = new FormData(form);
  const model = state.settings.aiModels.find(item => item.id === String(data.get("modelId")));
  const apiKey = model && sessionApiKeys.get(model.id);
  const prompt = String(data.get("prompt") || "").trim();
  const responseBox = $("#ai-chat-response");
  if (!model || !apiKey) { toast("Enter that model's API key in AI settings for this session first.", true); return; }
  if (!prompt) return;
  if (!confirm(`Send this prompt to ${model.name} at ${model.endpoint}? Your API key will be sent for authentication. The provider will receive the text below and may handle it under its own privacy policy.\n\n${prompt}`)) return;
  responseBox.classList.remove("hidden", "error");
  responseBox.textContent = "Waiting for your selected model…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const result = await fetch(endpointForModel(model.endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model.model, messages: [{ role: "user", content: prompt }], temperature: 0.5 }),
      signal: controller.signal
    });
    if (!result.ok) throw new Error(`Provider returned ${result.status}. Check the endpoint, API key, model ID, and provider limits.`);
    const payload = await result.json();
    const answer = payload.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("The provider returned an empty response.");
    responseBox.textContent = answer.trim();
  } catch (error) {
    responseBox.textContent = error.name === "AbortError" ? "The model took too long. Try again when ready." : (error.message || "The model could not be reached. Check its CORS and endpoint settings.");
    responseBox.classList.add("error");
  } finally {
    clearTimeout(timeout);
  }
}
async function exportBackup() {
  const payload={...state,exportedAt:new Date().toISOString()};
  const json=JSON.stringify(payload,null,2), filename=`tayefs-backup-${nowDateKey}.json`;
  try {
    if(window.tayefsDesktop?.saveBackup){
      const result=await window.tayefsDesktop.saveBackup({filename,json});
      if(result?.saved)toast("Backup saved to your chosen location.");
      return;
    }
    const blob=new Blob([json],{type:"application/json"});
    const file=new File([blob],filename,{type:"application/json"});
    if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"TAYEF'S backup"});toast("Backup shared.");return;}
    const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast("Backup downloaded to your device.");
  } catch (error) {
    if(error?.name!=="AbortError")toast("Backup could not be exported.",true);
  }
}
function restoreBackup(file) {
  const reader=new FileReader();
  reader.onload=()=>{try{
    const incoming=JSON.parse(String(reader.result));
    if(![1,2,3].includes(incoming.version)||!Array.isArray(incoming.tasks)||!Array.isArray(incoming.study)||!Array.isArray(incoming.health))throw new Error("Unsupported backup format");
    const defaults=starterData();
    state={...defaults,...incoming,version:3,settings:{...defaults.settings,...incoming.settings},gym:{...defaults.gym,...incoming.gym,months:incoming.gym?.months||{}},content:{...defaults.content,...incoming.content,items:Array.isArray(incoming.content?.items)?incoming.content.items:[]}};
    const packages={};
    if(incoming.version>=3&&incoming.settings?.pluginPackages&&typeof incoming.settings.pluginPackages==="object")for(const [id,pluginPackage] of Object.entries(incoming.settings.pluginPackages)){try{validatePluginPackage(pluginPackage,id);packages[id]=pluginPackage;}catch{}}
    state.settings.pluginPackages=packages;
    state.settings.installedPluginVersions=incoming.version>=3&&incoming.settings?.installedPluginVersions?incoming.settings.installedPluginVersions:{};
    state.settings.installedPlugins=incoming.version>=3&&Array.isArray(incoming.settings?.installedPlugins)?incoming.settings.installedPlugins.filter(id=>packages[id]&&state.settings.installedPluginVersions[id]===packages[id].manifest.version):[];
    state.settings.aiModels=Array.isArray(state.settings.aiModels)?state.settings.aiModels:[];
    state.gym=state.gym&&typeof state.gym==="object"?state.gym:defaults.gym;
    state.content={...defaults.content,...(state.content&&typeof state.content==="object"?state.content:{}),items:Array.isArray(state.content?.items)?state.content.items:[]};
    sessionApiKeys.clear();save();applyTheme(state.settings.theme);applyTextPreferences();render();toast("Backup restored.");
  }catch(error){toast(error.message||"That backup file could not be read.",true);}};
  reader.readAsText(file);
}
function saveContentBriefFromForm(form) {
  const item=state.content.items.find(entry=>entry.id===form.dataset.contentEditor);
  if(!item)return false;
  const data=new FormData(form);
  for(const key of ["title","stage","platform","format","pillar","publishDate","audience","goal","research","titleOptions","hook","outline","script","shotList","thumbnail","caption","hashtags"]) item[key]=String(data.get(key)||"").trim();
  item.updatedAt=new Date().toISOString();
  save();
  return true;
}
async function generateContentDraft(id) {
  const item=state.content.items.find(entry=>entry.id===id);
  const model=state.settings.aiModels.find(entry=>entry.id===state.settings.contentAiModel);
  const apiKey=model&&sessionApiKeys.get(model.id);
  if(!item||!model||!apiKey){toast("Open AI Models and enter the selected model's key for this session.",true);return;}
  const summary={title:item.title,platform:item.platform,format:item.format,pillar:item.pillar,audience:item.audience,goal:item.goal,research:item.research,titleOptions:item.titleOptions,hook:item.hook,outline:item.outline,script:item.script,thumbnail:item.thumbnail,caption:item.caption,hashtags:item.hashtags};
  const prompt=`Help me draft an original ${item.format} for ${item.platform}. Treat the supplied research as unverified notes: do not invent facts or citations; mark claims that need checking. Keep the creator's natural voice and avoid manipulative claims. Return sections for: 3 title options, opening hook, beat-by-beat outline/storyboard, a first script draft, visual/shot suggestions, thumbnail or cover concept, caption with a clear CTA, and optional relevant keywords. The creator will review and edit everything before publishing.\n\nChosen brief: ${JSON.stringify(summary)}`;
  if(!confirm(`Send this content brief (idea, platform, audience, research notes, and any draft text) to ${model.name} at ${model.endpoint}? The provider receives the prompt and your API key for authentication. Review the provider's privacy terms. Continue?`))return;
  contentDraftingId=id;
  if(activeView==="content")render();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),60000);
  try{
    const response=await fetch(endpointForModel(model.endpoint),{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},body:JSON.stringify({model:model.model,messages:[{role:"user",content:prompt}],temperature:0.7}),signal:controller.signal});
    if(!response.ok)throw new Error(`Provider returned ${response.status}. Check the endpoint, API key, and model ID.`);
    const payload=await response.json();
    const answer=payload.choices?.[0]?.message?.content;
    if(typeof answer!=="string"||!answer.trim())throw new Error("The provider returned an empty response.");
    item.aiDraft=answer.trim();item.aiError="";item.updatedAt=new Date().toISOString();save();toast("AI draft saved in this content brief. Review it before publishing.");
  }catch(error){item.aiError=error.name==="AbortError"?"The model took too long. Try again when ready.":(error.message||"Could not reach this provider; check its CORS and endpoint settings.");toast(item.aiError,true);}
  finally{clearTimeout(timeout);contentDraftingId="";if(activeView==="content")render();}
}
function handleClick(event) {
  const nav=event.target.closest("[data-view]");if(nav){navigate(nav.dataset.view);return;}
  const viewLink=event.target.closest("[data-view-link]");if(viewLink){navigate(viewLink.dataset.viewLink);return;}
  const gymDate=event.target.closest("[data-gym-date]");if(gymDate){gymSelectedDate=gymDate.dataset.gymDate;render();return;}
  const gymMonthButton=event.target.closest("[data-gym-month]");if(gymMonthButton){const date=new Date(`${gymSelectedMonth}-01T12:00:00`);date.setMonth(date.getMonth()+(gymMonthButton.dataset.gymMonth==="next"?1:-1));gymSelectedMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;ensureGymMonth(gymSelectedMonth);gymSelectedDate=`${gymSelectedMonth}-01`;save();render();return;}
  const removeExercise=event.target.closest("[data-delete-gym-exercise]");if(removeExercise){const [date,id]=removeExercise.dataset.deleteGymExercise.split("|");const day=state.gym.months[date.slice(0,7)]?.[date];if(day){day.exercises=day.exercises.filter(item=>item.id!==id);delete day.completed[id];save();render();}return;}
  const removeModel=event.target.closest("[data-delete-ai-model]");if(removeModel){const id=removeModel.dataset.deleteAiModel;state.settings.aiModels=state.settings.aiModels.filter(item=>item.id!==id);sessionApiKeys.delete(id);if(state.settings.gymAiModel===id)state.settings.gymAiModel="";save();render();toast("Model removed from this device.");return;}
  const action=event.target.closest("[data-action]");if(action){switch(action.dataset.action){
    case"add-task":addTaskDialog();break;case"add-project":addProjectDialog();break;case"add-book":addBookDialog();break;case"add-note":addNoteDialog();break;
    case"download-plugin":downloadPlugin(action.dataset.plugin);break;case"install-plugin":installPlugin(action.dataset.plugin);break;case"remove-plugin":removePlugin(action.dataset.plugin);break;
    case"refresh-plugin-catalog":refreshPluginCatalog();toast("Checking the GitHub plugin catalog…");break;case"import-plugin-file":$("#plugin-import-file")?.click();break;
    case"toggle-gym-ai":gymIntegrationEditorOpen=!gymIntegrationEditorOpen;render();break;case"toggle-content-ai":contentIntegrationEditorOpen=!contentIntegrationEditorOpen;render();break;
    case"generate-content-draft":{const form=action.closest("form");if(form)saveContentBriefFromForm(form);generateContentDraft(action.dataset.contentId);break;}
    case"remove-content":if(confirm("Remove this content item from your device?")){state.content.items=state.content.items.filter(item=>item.id!==action.dataset.contentId);save();render();toast("Content item removed.");}break;
    case"toggle-gym-day":{const day=state.gym.months[gymSelectedMonth][gymSelectedDate];day.kind=day.kind==="workout"?"recovery":"workout";day.title=day.kind==="workout"?"Custom workout":"Rest & recovery";if(day.kind==="workout")day.focus="Choose comfortable movements and controlled form.";save();render();break;}
  }return;}
  const deleteButton=event.target.closest("[data-delete]");if(deleteButton){if(!confirm("Remove this item from your local workspace?"))return;const collection=deleteButton.dataset.delete,id=deleteButton.dataset.id;state[collection]=state[collection].filter(x=>x.id!==id);save();render();toast("Item removed.");return;}
  const deleteTask=event.target.closest("[data-delete-task]");if(deleteTask){if(!confirm("Remove this task?"))return;state.tasks=state.tasks.filter(x=>x.id!==deleteTask.dataset.deleteTask);save();render();return;}
}
function handleChange(event) {
  if(event.target.id==="plugin-import-file"){const file=event.target.files?.[0];if(file)importPluginFile(file);event.target.value="";return;}
  const contentCheck=event.target.closest("[data-content-check]");if(contentCheck){const [id,index]=contentCheck.dataset.contentCheck.split("|");const item=state.content.items.find(entry=>entry.id===id);if(item){item.checklist=item.checklist||{};item.checklist[index]=contentCheck.checked;save();}return;}
  const gymCompletion=event.target.closest("[data-gym-complete]");if(gymCompletion){const [date,id]=gymCompletion.dataset.gymComplete.split("|");const day=state.gym.months[date.slice(0,7)]?.[date];if(day){day.completed=day.completed||{};day.completed[id]=gymCompletion.checked;save();render();}return;}
  const taskBox=event.target.closest("[data-task]");if(taskBox){const task=state.tasks.find(x=>x.id===taskBox.dataset.task);if(task){task.done=taskBox.checked;save();render();}return;}
  const project=event.target.closest("[data-project-status]");if(project){const item=state.projects.find(x=>x.id===project.dataset.projectStatus);if(item){item.status=project.value;save();toast("Project status updated.");}return;}
  const book=event.target.closest("[data-book-status]");if(book){const item=state.books.find(x=>x.id===book.dataset.bookStatus);if(item){item.status=book.value;save();toast("Reading status updated.");}}
}
async function handleSubmit(event) {
  const form=event.target;
  if(form.id==="content-create-form"){event.preventDefault();const pluginPackage=activePluginPackage("content-studio");if(!pluginPackage)return;const data=new FormData(form),template=pluginPackage.module.templates.find(item=>item.id===String(data.get("template")))||pluginPackage.module.templates[0],title=String(data.get("title")||"").trim();if(!title||!template)return;state.content.items.unshift({id:uid(),title,stage:"Idea",platform:String(data.get("platform")),format:String(data.get("format")),pillar:String(data.get("pillar")),publishDate:String(data.get("publishDate")||""),audience:"",goal:"",research:"",titleOptions:template.titleOptions||"",hook:template.hook||"",outline:template.outline||"",script:template.script||"",shotList:template.shotList||"",thumbnail:template.thumbnail||"",caption:template.caption||"",hashtags:"",checklist:{},template:template.id,createdAt:new Date().toISOString()});save();render();toast("Content idea added to your pipeline.");return;}
  if(form.dataset.contentEditor){event.preventDefault();if(saveContentBriefFromForm(form)){render();toast("Content brief saved on this device.");}return;}
  if(form.id==="content-ai-link-form"){event.preventDefault();const id=String(new FormData(form).get("modelId")||"");if(!isPluginInstalled("ai-models")||!state.settings.aiModels.some(item=>item.id===id))return;state.settings.contentAiModel=id;contentIntegrationEditorOpen=false;save();render();toast("Content Studio is connected to the selected model.");return;}
  if(form.id==="ai-model-form"){event.preventDefault();const data=new FormData(form),name=String(data.get("name")||"").trim(),model=String(data.get("model")||"").trim(),endpoint=String(data.get("endpoint")||"").trim(),apiKey=String(data.get("apiKey")||"").trim();if(!name||!model||!endpoint||!apiKey)return;try{endpointForModel(endpoint);}catch(error){toast(error.message,true);return;}const id=uid();state.settings.aiModels.push({id,name,model,endpoint});sessionApiKeys.set(id,apiKey);save();render();toast("Model profile saved. Its API key is ready for this session only.");return;}
  if(form.dataset.aiKeyForm){event.preventDefault();const id=form.dataset.aiKeyForm,key=String(new FormData(form).get("apiKey")||"").trim();if(!key)return;sessionApiKeys.set(id,key);render();toast("API key set in memory for this session.");return;}
  if(form.id==="gym-ai-link-form"){event.preventDefault();const id=String(new FormData(form).get("modelId")||"");if(!state.settings.aiModels.some(item=>item.id===id))return;state.settings.gymAiModel=id;gymIntegrationEditorOpen=false;save();render();toast("Gym is connected to the selected model.");return;}
  if(form.id==="gym-nutrition-form"){event.preventDefault();const response=$("#gym-ai-response");response.classList.remove("hidden","error");await askGymModel(form);return;}
  if(form.id==="ai-chat-form"){event.preventDefault();await askGeneralModel(form);return;}
  if(form.dataset.gymDayForm){event.preventDefault();const day=state.gym.months[gymSelectedMonth]?.[form.dataset.gymDayForm];if(day){const data=new FormData(form);day.title=String(data.get("title")||"").trim()||day.title;day.focus=String(data.get("focus")||"").trim();day.notes=String(data.get("notes")||"").trim();save();render();toast("Day plan saved.");}return;}
  if(form.id==="gym-add-exercise"){event.preventDefault();const day=state.gym.months[gymSelectedMonth]?.[form.dataset.gymDay];const data=new FormData(form),name=String(data.get("name")||"").trim(),sets=Number(data.get("sets")),reps=String(data.get("reps")||"").trim();if(day&&name&&sets>=1&&reps){day.exercises.push({id:uid(),name,sets,reps});save();render();toast("Exercise added to this day.");}return;}
  if(form.dataset.editGymExercise){event.preventDefault();const day=state.gym.months[form.dataset.gymDay.slice(0,7)]?.[form.dataset.gymDay],exercise=day?.exercises.find(item=>item.id===form.dataset.editGymExercise),data=new FormData(form);if(exercise){exercise.name=String(data.get("name")||"").trim()||exercise.name;exercise.sets=Math.min(10,Math.max(1,Number(data.get("sets"))||2));exercise.reps=String(data.get("reps")||"").trim()||exercise.reps;save();render();toast("Exercise updated.");}return;}
  if(form.id==="movement-form"){event.preventDefault();const data=new FormData(form);state.health.unshift({id:uid(),kind:"movement",activity:String(data.get("activity")),minutes:Number(data.get("minutes")),note:String(data.get("note")||"").trim(),date:nowDateKey});save();render();toast("Movement logged.");}
  if(form.id==="sleep-form"){event.preventDefault();const data=new FormData(form);state.health.unshift({id:uid(),kind:"sleep",hours:Number(data.get("hours")),note:String(data.get("note")||"").trim(),date:nowDateKey});save();render();toast("Rest note saved.");}
  if(form.id==="study-form"){event.preventDefault();const data=new FormData(form);state.study.unshift({id:uid(),subject:String(data.get("subject")).trim(),minutes:Number(data.get("minutes")),note:String(data.get("note")||"").trim(),date:nowDateKey});save();render();toast("Study session saved.");}
  if(form.id==="review-form"){event.preventDefault();const data=new FormData(form);state.reviews[weekStartKey()]={wentWell:String(data.get("wentWell")||""),learned:String(data.get("learned")||""),next:String(data.get("next")||"")};save();toast("Weekly reflection saved.");}
}
document.addEventListener("click",handleClick);
document.addEventListener("change",handleChange);
document.addEventListener("submit",handleSubmit);
async function configureNativeStatusBar() {
  if (window.Capacitor?.getPlatform?.() !== "android") return;
  document.documentElement.classList.add("android-native");
  const statusBar = window.Capacitor?.Plugins?.StatusBar;
  if (!statusBar) return;
  try {
    await statusBar.setOverlaysWebView({ overlay: false });
    await statusBar.setBackgroundColor({ color: "#10120f" });
    await statusBar.setStyle({ style: "LIGHT" });
  } catch (error) { console.info("Using the configured Android status bar defaults.", error); }
}
configureNativeStatusBar();
$("#theme-select").addEventListener("change",event=>applyTheme(event.target.value));
$("#text-size-select").addEventListener("change",event=>{state.settings.textSize=event.target.value;applyTextPreferences();save();});
$("#font-style-select").addEventListener("change",event=>{state.settings.fontStyle=event.target.value;applyTextPreferences();save();});
$("#export-btn").addEventListener("click",exportBackup);
$("#import-btn").addEventListener("click",()=>$("#import-file").click());
$("#import-file").addEventListener("change",event=>{const file=event.target.files?.[0];if(file)restoreBackup(file);event.target.value="";});
$("#today-chip").textContent=new Date().toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
applyTheme(state.settings.theme);
applyTextPreferences();
const requestedView=location.hash.slice(1);if(renderers[requestedView])activeView=requestedView;
render();
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("#install-btn").classList.remove("hidden");});
$("#install-btn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#install-btn").classList.add("hidden");});
