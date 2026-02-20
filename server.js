const express = require('express');
const cors = require('cors');
const lunr = require('lunr');
const candidates = require('./data.json');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Initialize Lunr Index (Fallback for Elasticsearch)
const idx = lunr(function () {
  this.ref('id');
  this.field('headline');
  this.field('skills');
  this.field('currentRole');

  candidates.forEach(function (doc) {
    this.add({
      id: doc.id,
      headline: doc.headline,
      skills: doc.skills.join(' '),
      currentRole: doc.currentRole
    });
  }, this);
});

// Scoring Algorithm Math Formula Reference:
// finalScore = (booleanMatchScore) + (skillMatchCount * 5) - (distancePenalty)

app.post('/api/search', (req, res) => {
  const { query, location, skills, maxDistance, minExp } = req.body;

  // 1. Execute Boolean Search if query exists
  let searchResults = [];
  if (query) {
    // Basic formatting for Lunr: convert OR to space, AND to +
    let formattedQuery = query.replace(/\bOR\b/gi, '').replace(/\bAND\b/gi, '+');
    try {
      const lunrResults = idx.search(formattedQuery);
      searchResults = lunrResults.map(r => candidates.find(c => c.id === r.ref));
    } catch (e) {
      searchResults = candidates; // fallback if query parsing fails
    }
  } else {
    searchResults = [...candidates];
  }

  // 2. Apply Filters (Distance, Location, Exp)
  let filtered = searchResults.filter(c => {
    let locMatch = location ? c.location.toLowerCase().includes(location.toLowerCase()) : true;
    let expMatch = minExp ? c.totalYearsExperience >= minExp : true;
    // Distance Match Logic
    let distMatch = maxDistance ? c.distance <= maxDistance : true;
    
    return locMatch && expMatch && distMatch;
  });

  // 3. Calculate Skill Match & Ranking
  const ranked = filtered.map(c => {
    let matchedSkills = 0;
    if (skills && skills.length > 0) {
      matchedSkills = c.skills.filter(s => 
        skills.some(targetSkill => targetSkill.toLowerCase() === s.toLowerCase())
      ).length;
    }
    return { ...c, skillMatchCount: matchedSkills };
  }).sort((a, b) => b.skillMatchCount - a.skillMatchCount); // Rank by skills

  res.json({ count: ranked.length, results: ranked });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 LEVEL UP API running on port ${PORT}`));