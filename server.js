const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── SUPABASE ──
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ohudqbiquyybwbnmxxjp.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_Kx9EHStSauHeRofXspg01Q_SHguVQHQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── LOGGING (fallback fichier) ──
const LOG_FILE = path.join(__dirname, "logs.json");
function logQuestion(question, staff) {
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE)) logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    logs.push({ q: question, staff: staff || 'inconnu', t: new Date().toISOString() });
    if (logs.length > 500) logs = logs.slice(-500);
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs));
  } catch (e) {}
}

// ── ADMIN PIN ──
const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

// ── ROUTES NOTES ──
app.get("/api/notes", async (req, res) => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/notes", async (req, res) => {
  const { staff_name, message } = req.body;
  if (!staff_name || !message) return res.status(400).json({ error: "Données manquantes" });
  const { data, error } = await supabase.from("notes").insert([{ staff_name, message }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.delete("/api/notes/:id", async (req, res) => {
  const { error } = await supabase.from("notes").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── ROUTES CHECKLISTS ──
app.post("/api/checklist-log", async (req, res) => {
  const { staff_name, checklist_type } = req.body;
  if (!staff_name || !checklist_type) return res.status(400).json({ error: "Données manquantes" });
  const { data, error } = await supabase.from("checklist_logs").insert([{ staff_name, checklist_type }]).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.get("/api/checklist-logs", async (req, res) => {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("checklist_logs")
    .select("*")
    .gte("completed_at", since)
    .order("completed_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── ROUTES RECETTES ──
app.get("/api/recettes", async (req, res) => {
  const { data, error } = await supabase
    .from("recettes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/recettes", async (req, res) => {
  const { titre, description, ingredients, instructions, file_url, created_by } = req.body;
  if (!titre) return res.status(400).json({ error: "Titre requis" });
  const { data, error } = await supabase
    .from("recettes")
    .insert([{ titre, description, ingredients, instructions, file_url, created_by: created_by || 'Ibrahim' }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.put("/api/recettes/:id", async (req, res) => {
  const { titre, description, ingredients, instructions } = req.body;
  const { data, error } = await supabase
    .from("recettes")
    .update({ titre, description, ingredients, instructions, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.delete("/api/recettes/:id", async (req, res) => {
  const { error } = await supabase.from("recettes").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── ROUTES STOCK ──
app.get("/api/stock", async (req, res) => {
  const { data, error } = await supabase.from("stock_alerts").select("*").order("fournisseur");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/stock", async (req, res) => {
  const { product, fournisseur, code, status, reported_by } = req.body;
  // Upsert par product
  const { data, error } = await supabase
    .from("stock_alerts")
    .upsert([{ product, fournisseur, code, status, reported_by, updated_at: new Date().toISOString() }],
      { onConflict: 'product' })
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

app.delete("/api/stock/:product", async (req, res) => {
  const { error } = await supabase.from("stock_alerts").delete().eq("product", decodeURIComponent(req.params.product));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── ADMIN ──
app.get("/admin", (req, res) => {
  const { pin } = req.query;
  if (pin !== ADMIN_PIN) {
    return res.send(`
      <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:-apple-system,sans-serif;max-width:400px;margin:60px auto;padding:20px;background:#f9f8f6}
      h2{font-size:20px;margin-bottom:20px}
      input{width:100%;padding:12px;font-size:16px;border:1.5px solid #ddd;border-radius:10px;margin:10px 0;box-sizing:border-box}
      button{width:100%;padding:13px;background:#111;color:white;border:none;border-radius:10px;font-size:15px;cursor:pointer}</style>
      </head><body>
      <h2>Admin — Le Shake</h2>
      <form action="/admin" method="get">
        <input type="password" name="pin" placeholder="Code PIN" autofocus>
        <button type="submit">Accéder</button>
      </form></body></html>
    `);
  }

  let logs = [];
  try {
    if (fs.existsSync(LOG_FILE)) logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch (e) {}

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter(l => l.t.startsWith(today)).length;
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const weekLogs = logs.filter(l => l.t > week);

  const freq = {};
  weekLogs.forEach(l => {
    const words = l.q.toLowerCase().replace(/[^a-zàâéèêëîïôùûüç\s]/g, "").split(/\s+/);
    words.filter(w => w.length > 4).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  });
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // Stats par staff
  const staffStats = {};
  weekLogs.forEach(l => {
    const s = l.staff || 'inconnu';
    staffStats[s] = (staffStats[s] || 0) + 1;
  });

  const recentQ = logs.slice(-20).reverse().map(l =>
    `<li style="padding:8px 0;border-bottom:1px solid #eee">
      <span style="color:#999;font-size:11px">${l.t.slice(0,16).replace("T"," ")} — ${l.staff || '?'}</span><br>
      <span style="font-size:13px">${l.q}</span>
    </li>`
  ).join("");

  const staffRows = Object.entries(staffStats).sort((a,b) => b[1]-a[1]).map(([s,c]) =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0ece5">
      <span style="font-size:13px">${s}</span><span style="font-weight:600">${c}</span>
    </div>`
  ).join("");

  res.send(`
    <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f8f6;color:#1a1916}
      h1{font-size:20px;margin-bottom:4px}h2{font-size:13px;color:#888;font-weight:400;margin-bottom:24px}
      .card{background:white;border:1px solid #e8e4dd;border-radius:12px;padding:16px;margin-bottom:14px}
      .stat{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0ece5}
      .stat:last-child{border:none}
      .stat-label{font-size:13px;color:#6b6760}.stat-value{font-size:18px;font-weight:600}
      .tag{display:inline-block;background:#f0e6c8;color:#b8962e;padding:3px 10px;border-radius:20px;font-size:12px;margin:3px}
      ul{list-style:none;padding:0;margin:0}
      h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#999;margin-bottom:10px}
    </style></head><body>
    <h1>Le Shake — Admin</h1>
    <h2>Tableau de bord</h2>
    <div class="card">
      <div class="stat"><span class="stat-label">Questions aujourd'hui</span><span class="stat-value">${todayCount}</span></div>
      <div class="stat"><span class="stat-label">Cette semaine</span><span class="stat-value">${weekLogs.length}</span></div>
      <div class="stat"><span class="stat-label">Total</span><span class="stat-value">${logs.length}</span></div>
    </div>
    <div class="card">
      <h3>Questions par staff (7 jours)</h3>
      ${staffRows || '<p style="color:#999;font-size:13px">Aucune donnée</p>'}
    </div>
    <div class="card">
      <h3>Mots les plus recherchés</h3>
      ${topWords.map(([w,c]) => `<span class="tag">${w} (${c})</span>`).join("")}
    </div>
    <div class="card">
      <h3>20 dernières questions</h3>
      <ul>${recentQ}</ul>
    </div>
    <p style="text-align:center;margin-top:20px"><a href="/admin?pin=${pin}" style="color:#999;font-size:12px">Rafraîchir</a></p>
    </body></html>
  `);
});

// ── CHAT ──
const SYSTEM_PROMPT = `Tu es l'assistant du restaurant Le Shake. Tu t'appelles Shake. Tu parles en français.

RÈGLES DE RÉPONSE — STRICTES :
- Réponses courtes par défaut. 1 à 3 lignes pour une question simple.
- Si la réponse tient en une phrase, tu réponds en une phrase.
- Jamais de formule d'introduction : pas de "Bien sûr", "Absolument", "Avec plaisir", "Bonne question".
- Pas d'emojis, pas d'astérisques, pas de mise en forme excessive.
- Quand tu listes, tu utilises des tirets simples.
- Tu parles comme un collègue compétent qui connaît son boulot. Pas comme un chatbot.
- Pour les questions de hiérarchie ou contacts : une réponse directe, sans explication du fonctionnement interne.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIÉRARCHIE & DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRECTION :
Jonathan → Patron
Daniel → Direction — horaires, recrutement, congés, consignes, responsable de Lloyd
Liora → Direction — RH, fiches de paie, contrats, réservations de groupe

MANAGEMENT :
Lloyd → Manager de salle — ton référent pendant le service
Ibrahim → Chef de cuisine

RÈGLE :
- Pendant le service → Lloyd
- Horaires, congés, demandes → Daniel
- Salaire, contrat → Liora
- On ne saute pas les échelons

URGENCES : Malaise → 112 | Client agressif → Police Woluwe 02 788 53 43

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHILOSOPHIE & RÈGLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Au Shake, on reçoit des invités, on ne sert pas des assiettes.
Le client peut oublier ce qu'il a mangé. Il n'oubliera jamais comment il s'est senti.

1. Bonjour dans les 3 secondes
2. Anticipe toujours
3. Verre vide, miette, serviette par terre = règle immédiatement
4. Connaître la carte parfaitement
5. Proposer, ne pas demander
6. Les plaintes sont des cadeaux — écouter, s'excuser, résoudre
7. La salle doit être belle à 19h, 21h et 23h
8. Tenue impeccable, téléphone rangé
9. L'énergie est contagieuse
10. Le client repart avec une meilleure humeur

RÈGLES PRATIQUES :
- Téléphone : interdit pendant le service
- Alcool : strictement interdit pendant le service
- Cigarette : uniquement pendant la coupure
- Dress code : obligatoire — cravate fournie
- Repas staff : 11h30-11h45 (midi) / 17h30-17h45 (soir). Tableau de Lloyd.
- Verre de fermeture : interdit dans le restaurant
- Erreur de pointage : 50% du coût à la charge de la personne
- Avis Google : proposer quand client content, QR code sur l'addition

ATTITUDE :
- Jamais de stress visible devant les clients
- Jamais statique — quand c'est calme : tables, eau, couverts, consoles, terrasse
- Un client qui entre : bonjour immédiatement même si occupé
- Le dernier client = même qualité que le premier
- Entraide : passe, collègue débordé, table à débarrasser — on aide

PROBLÈMES EN SERVICE :
- Table qui attend trop → s'excuser, référer à Lloyd. Jamais directement en cuisine.
- Erreur commande → référer à Lloyd
- Client mécontent → prévenir Lloyd immédiatement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÉSERVATIONS & GROUPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
En ligne sur le site ou par téléphone.
Plus de 8 personnes : choix réduit (4 entrées / 4 plats / 4 desserts) ou menu sur mesure.
Questions réservations → Lloyd ou Daniel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARTE — ENTRÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tartare de Thon 22€ | Saint-Jacques 24€ | Carpaccio de Bœuf 20€
Grenouilles 22€ | Escargots 21€ | Os à Moelle 19€ | Foie Gras 26€
Croquettes de Crevettes 24€ | Croquettes de Fromage 18€
Champignons 20€ | Velouté Saint-Germain 18€ | Œuf Mimosa 20€ | Burrata 20€
TO SHARE : Croquettes Ibériques 18€ | Smash Burger 20€ | Fritti de Calamars 18€ | Pizzetta Thon 20€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARTE — PLATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Poulet Rôti 29€ | Tartare de Bœuf 25€ | Vol-au-Vent 38€ | Rognon 32€
Filet Pur 42€ | Magret de Canard 32€ | Sole prix du jour | Saumon 32€
Salade César 25€ | Coquillettes 28€ | Raviole aux Cèpes 27€
Linguine Citron 25€ | Parmentier de Canard 28€ | Onglet 32€
À PARTAGER : Côte à l'Os 55€/pp | Bar entier 35€/pp | Linguine au Homard 45€/pp

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARTE — DESSERTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dame Blanche 13€ | Pavlova 13€ | Baba au Rhum 14€ | Cookie 13€
Crème Brûlée 12€ | Flan 12€ | Profiteroles 14€ | Fromages 15€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS LUNCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
26€ — Entrée + Plat OU Plat + Dessert
Lundi au vendredi midi uniquement.
Menu change chaque lundi → consulter Facebook ou demander à Lloyd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COCKTAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGNATURE 15€ :
Le Shake — Gin Bombay, St Germain, Pêche, Hibiscus
Saint-Germain — St Germain, Prosecco
Moulin Rouge — Gin Tanqueray, Cassis, Martini Dry
Belle Normande — Vodka, Calvados, St Germain
Negroni — Gin Tanqueray Orange, Grand Marnier, Campari
L'Exotic — Rhum, Coco, Passion
Basilic — sans alcool possible
MOCKTAILS 12€ : Gingembre | Esprit Sureau

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VINS BLANCS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Muscadet sur Lie Genaudières 2023 — v.9€ / 22€ / 38€
Terra di Nostri Blanc 2024 — v.8€ / 34€
Vouvray Sec Les Perruches 2024 — v.10€ / 43€
Sancerre Blanc Marloup 2024 — v.12€ / 29€ / 55€
Chablis Brocard 2024 — 38€ / 66€
Pinot Gris E.Boeckel 2024 — 22€ / 38€
Gewurztraminer Bio Kuehn 2020 — 45€
Riesling Brandluft Boeckel 2023 — 45€
Pouilly-Fumé M.Michot 2023 — 64€
Lilas Blanc maison — v.6€ / 12€ / 20€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VINS ROUGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pinot Noir E.Boeckel 2023 — v.8€ / 22€ / 38€
Terra di Nostri Rouge 2023 — 34€
Château Peybonhomme Blaye 2022 — v.9€ / 25€ / 42€
Château Fleur Lartigue St-Émilion 2023 — v.13€ / 32€ / 58€
Morgon Côte de Py VV 2021 — 57€
Brouilly Ch. de la Terrière 2023 — 60€
Châteauneuf-du-Pape Perrin 2022 — 88€
Château Patache d'Aux 2018 — 29€ / 55€
Lilas Rouge maison — v.6€ / 12€ / 20€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VINS ROSÉS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Terra di Nostri Rosé 2024 — v.8€ / 34€
R de Ramatuelle Provence 2024 — 36€
Estandon Héritage Provence 2024 — 44€
M de Minuty Provence 2024 — 52€
Lilas Rosé maison — v.6€ / 12€ / 20€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BULLES & CHAMPAGNES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cava La Vuelta — v.10€ / 45€
Erard-Salmon Brut — v.14€ / 65€
Veuve Clicquot Brut — 110€
Jean-Noël Haton Blanc de Blancs — 125€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRAND CRU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chablis 1er Cru Vau de Vey Bio 2023 — 95€
Mercurey Blanc Bois de Lalier 2022 — 92€
Crozes-Hermitage Blanc Ferraton 2023 — 75€
Cigalus Blanc Gérard Bertrand 2023 — 110€
Pouilly-Fuissé Ch. La Vernalle 2023 — 110€
Chagual Cabernet BIO Lafite 2022 — 59€
L'Oratoire de Chasse Spleen 2019 — 82€
Domaine de l'Aigle Pinot Noir G.Bertrand 2023 — 95€

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCORDS METS & VINS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Magret → Château Patache d'Aux, Chagual Cabernet BIO, Enate Crianza
Filet Pur / Côte à l'Os → Saint-Émilion, Saint-Estèphe, Châteauneuf-du-Pape
Tartare de Bœuf → Brouilly, Terra di Nostri Rouge
Onglet / Rognon → Morgon Côte de Py, Chinon, Saint-Nicolas de Bourgueil
Foie Gras → Vouvray Sec Les Perruches, Gewurztraminer Bio Kuehn
Escargots → Chablis Brocard, Sancerre Blanc
Saint-Jacques → Chablis 1er Cru, Mercurey Blanc
Tartare de Thon → Sancerre Blanc, Muscadet sur Lie
Homard → Chablis 1er Cru, Mercurey Blanc, Pouilly-Fuissé
Saumon → Vouvray Sec, Chablis, Pinot Gris Boeckel
Poulet Rôti → Morgon, Pinot Noir Boeckel, Mâcon La Roche Vineuse
Burrata → Pinot Grigio San Simone, Gavi del Comune di Gavi
Grenouilles → Chablis, Pouilly-Fumé

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MACHINE À CAFÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La Nuova Era Altea Wood 2 groupes. Responsable : barmans.
Début : allumer 20 min avant, purger chaque groupe, nettoyer buses vapeur.
Fin : rétro-lavage pastille (1/groupe), 5 cycles, rincer 3 cycles, démonter porte-filtres pour la nuit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAVAGE DES MAINS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SURE Antibac, 1 minute minimum, 3 doses, 30s massage, 30s rinçage, sécher papier, fermer robinet avec papier.
Interdit : bijoux, ongles longs, manches longues, vernis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUIZ D'INTÉGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si demandé, pose ces 10 questions une par une. Score sur 10 à la fin.

Q1 : Tu arrives en service et tu vois une table qui attend depuis 5 minutes sans avoir été saluée. Tu fais quoi ?
Bonne réponse : aller saluer immédiatement et prévenir Lloyd

Q2 : Un client te dit que son steak est trop cuit. Tu fais quoi ?
Bonne réponse : s'excuser, ne pas discuter, prévenir Lloyd immédiatement

Q3 : Cite 3 cocktails du Shake avec leurs ingrédients.
Bonne réponse : parmi Le Shake, Saint-Germain, Moulin Rouge, Belle Normande, Negroni, L'Exotic

Q4 : Quel vin tu proposes avec le Foie Gras ?
Bonne réponse : Vouvray Sec Les Perruches ou Gewurztraminer Bio Kuehn

Q5 : Tu as une question urgente pour la cuisine pendant le service. Comment tu procèdes ?
Bonne réponse : passer par Lloyd — jamais directement en cuisine

Q6 : Un client te demande l'addition mais ton terminal est en panne. Tu fais quoi ?
Bonne réponse : prévenir Lloyd immédiatement

Q7 : Il est 17h52 et tu n'as pas mangé. Tu peux encore manger ?
Bonne réponse : non — repas staff jusqu'à 17h45 maximum

Q8 : Tu remarques que le sel est vide sur une table. Tu attends qu'on te le demande ?
Bonne réponse : non — on règle immédiatement

Q9 : Ton collègue est débordé. Tu as 2 minutes. Tu fais quoi ?
Bonne réponse : on aide sans qu'on le demande

Q10 : Fin de service — cite 3 choses à faire avant de partir.
Bonne réponse : parmi — rang propre, tables dressées, lampes chargées, terrasse rangée, plans de travail nettoyés

Score : 10/10 → Parfait. | 7-9 → Bien, relis les points ratés. | 5-6 → Insuffisant, reprends les procédures. | -5 → Reprendre depuis le début, parler à Lloyd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRÉBATCHS BAR & ALLERGÈNES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[À compléter]
Pour allergènes : référer toujours à Lloyd ou la cuisine. Ne jamais inventer.`;

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, staff } = req.body;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") logQuestion(lastMsg.content, staff);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
