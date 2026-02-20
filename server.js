const express = require('express');
const cors = require('cors');
const lunr = require('lunr');
const candidates = require('./data.json');

const app = express();
app.use(cors());
app.use(express.json());

// பிரவுசரில் லிங்கை கிளிக் செய்தால் இந்த மெசேஜ் வரும் (உங்களுக்கான அப்டேட்)
app.get('/', (req, res) => {
    res.send('🚀 LEVEL UP X-RAY BACKEND IS LIVE AND RUNNING!');
});

// 1. Initialize Lunr Index
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

// 2. Search API Logic
app.post('/api/search', (req, res) => {
  const { query, location, skills, maxDistance, minExp } = req.body;

  let searchResults = [];
  if (query) {
    let formattedQuery = query.replace(/\bOR\b/gi, '').replace(/\bAND\b/gi, '+');
    try {
      const lunrResults = idx.search(formattedQuery);
      searchResults = lunrResults.map(r => candidates.find(c => c.id === r.ref));
    } catch (e) {
      searchResults = candidates;
    }
  } else {
    searchResults = [...candidates];
  }

  let filtered = searchResults.filter(c => {
    let locMatch = location ? c.location.toLowerCase().includes(location.toLowerCase()) : true;
    let expMatch = minExp ? c.totalYearsExperience >= minExp : true;
    let distMatch = maxDistance ? c.distance <= maxDistance : true;
    return locMatch && expMatch && distMatch;
  });

  const ranked = filtered.map(c => {
    let matchedSkills = 0;
    if (skills && skills.length > 0) {
      matchedSkills = c.skills.filter(s => 
        skills.some(targetSkill => targetSkill.toLowerCase() === s.toLowerCase())
      ).length;
    }
    return { ...c, skillMatchCount: matchedSkills };
  }).sort((a, b) => b.skillMatchCount - a.skillMatchCount);

  res.json({ count: ranked.length, results: ranked });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));