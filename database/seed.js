// database/seed.js
// ---------------------------------------------------------------
// Populates the database with:
//   • Your admin user account (from .env)
//   • All project categories
//   • All skill categories + individual skills
//   • Starter certificates
//   • Default site-wide settings (hero copy, contact links, etc.)
//
// Called by: npm run seed
// Run AFTER npm run build:db.
// Re-running is safe — every insert uses INSERT OR IGNORE or
// INSERT OR REPLACE so no duplicates are created.
// ---------------------------------------------------------------
'use strict';

const path     = require('path');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
require('dotenv').config();

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'portfolio.db');

// ---- Resolve absolute upload paths for Render's persistent disk
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const ADMIN_NAME     = process.env.ADMIN_NAME     || 'Kanishk';

// ---------------------------------------------------------------
// DATA
// ---------------------------------------------------------------

const CATEGORIES = [
  { name: 'Machine Learning',   slug: 'machine-learning',   sort_order: 1 },
  { name: 'Deep Learning',      slug: 'deep-learning',      sort_order: 2 },
  { name: 'Data Science',       slug: 'data-science',       sort_order: 3 },
  { name: 'Data Engineering',   slug: 'data-engineering',   sort_order: 4 },
  { name: 'NLP',                slug: 'nlp',                sort_order: 5 },
  { name: 'Computer Vision',    slug: 'computer-vision',    sort_order: 6 },
  { name: 'Generative AI',      slug: 'generative-ai',      sort_order: 7 },
  { name: 'MLOps',              slug: 'mlops',              sort_order: 8 },
  { name: 'Research',           slug: 'research',           sort_order: 9 },
];

// Each category has an icon key (maps to an SVG sprite in the frontend)
// and a list of skills. proficiency is 1–100 (displayed as a progress bar).
const SKILL_CATEGORIES = [
  {
    name: 'Machine Learning',
    icon: 'ml',
    sort_order: 1,
    skills: [
      { name: 'Scikit-learn',        proficiency: 92, sort_order: 1 },
      { name: 'XGBoost',             proficiency: 88, sort_order: 2 },
      { name: 'LightGBM',            proficiency: 85, sort_order: 3 },
      { name: 'Feature Engineering', proficiency: 90, sort_order: 4 },
      { name: 'Model Evaluation',    proficiency: 88, sort_order: 5 },
      { name: 'Ensemble Methods',    proficiency: 82, sort_order: 6 },
    ],
  },
  {
    name: 'Deep Learning',
    icon: 'dl',
    sort_order: 2,
    skills: [
      { name: 'PyTorch',             proficiency: 85, sort_order: 1 },
      { name: 'TensorFlow',          proficiency: 80, sort_order: 2 },
      { name: 'Keras',               proficiency: 83, sort_order: 3 },
      { name: 'CNNs',                proficiency: 82, sort_order: 4 },
      { name: 'RNNs / LSTMs',        proficiency: 78, sort_order: 5 },
      { name: 'Transformers',        proficiency: 80, sort_order: 6 },
    ],
  },
  {
    name: 'Generative AI',
    icon: 'genai',
    sort_order: 3,
    skills: [
      { name: 'LLM APIs (Gemini, OpenAI)', proficiency: 88, sort_order: 1 },
      { name: 'RAG Pipelines',             proficiency: 85, sort_order: 2 },
      { name: 'LangChain',                 proficiency: 80, sort_order: 3 },
      { name: 'Prompt Engineering',        proficiency: 90, sort_order: 4 },
      { name: 'Vector Databases (FAISS)',  proficiency: 82, sort_order: 5 },
      { name: 'Sentence Transformers',     proficiency: 85, sort_order: 6 },
    ],
  },
  {
    name: 'NLP',
    icon: 'nlp',
    sort_order: 4,
    skills: [
      { name: 'Hugging Face',        proficiency: 85, sort_order: 1 },
      { name: 'spaCy',               proficiency: 78, sort_order: 2 },
      { name: 'NLTK',                proficiency: 80, sort_order: 3 },
      { name: 'Text Classification', proficiency: 88, sort_order: 4 },
      { name: 'Named Entity Recognition', proficiency: 78, sort_order: 5 },
      { name: 'Sentiment Analysis',  proficiency: 90, sort_order: 6 },
    ],
  },
  {
    name: 'Data Science',
    icon: 'ds',
    sort_order: 5,
    skills: [
      { name: 'Pandas',              proficiency: 94, sort_order: 1 },
      { name: 'NumPy',               proficiency: 92, sort_order: 2 },
      { name: 'Matplotlib',          proficiency: 88, sort_order: 3 },
      { name: 'Seaborn',             proficiency: 86, sort_order: 4 },
      { name: 'Plotly',              proficiency: 80, sort_order: 5 },
      { name: 'Tableau / Power BI',  proficiency: 82, sort_order: 6 },
    ],
  },
  {
    name: 'Data Engineering',
    icon: 'de',
    sort_order: 6,
    skills: [
      { name: 'PostgreSQL',          proficiency: 86, sort_order: 1 },
      { name: 'Supabase',            proficiency: 82, sort_order: 2 },
      { name: 'SQLite',              proficiency: 88, sort_order: 3 },
      { name: 'ETL Pipelines',       proficiency: 84, sort_order: 4 },
      { name: 'GitHub Actions',      proficiency: 85, sort_order: 5 },
      { name: 'Apache Airflow',      proficiency: 72, sort_order: 6 },
    ],
  },
  {
    name: 'MLOps',
    icon: 'mlops',
    sort_order: 7,
    skills: [
      { name: 'Docker',              proficiency: 85, sort_order: 1 },
      { name: 'GitHub Actions (CI/CD)', proficiency: 84, sort_order: 2 },
      { name: 'MLflow',              proficiency: 75, sort_order: 3 },
      { name: 'Streamlit',           proficiency: 92, sort_order: 4 },
      { name: 'FastAPI',             proficiency: 84, sort_order: 5 },
      { name: 'Hugging Face Spaces', proficiency: 82, sort_order: 6 },
    ],
  },
  {
    name: 'Python',
    icon: 'python',
    sort_order: 8,
    skills: [
      { name: 'Python 3.x',          proficiency: 95, sort_order: 1 },
      { name: 'OOP',                 proficiency: 88, sort_order: 2 },
      { name: 'Decorators & Generators', proficiency: 82, sort_order: 3 },
      { name: 'Asyncio',             proficiency: 75, sort_order: 4 },
      { name: 'Testing (pytest)',     proficiency: 78, sort_order: 5 },
      { name: 'Type Hints',          proficiency: 84, sort_order: 6 },
    ],
  },
  {
    name: 'Cloud & SQL',
    icon: 'cloud',
    sort_order: 9,
    skills: [
      { name: 'Azure (ML Studio)',   proficiency: 78, sort_order: 1 },
      { name: 'GCP (Vertex AI)',     proficiency: 70, sort_order: 2 },
      { name: 'AWS (S3, EC2)',       proficiency: 68, sort_order: 3 },
      { name: 'SQL (Advanced)',      proficiency: 88, sort_order: 4 },
      { name: 'Render / Railway',    proficiency: 82, sort_order: 5 },
    ],
  },
];

const CERTIFICATES = [
  {
    title: 'Machine Learning Specialization',
    issuer: 'DeepLearning.AI / Stanford (Coursera)',
    issue_date: '2024',
    credential_url: '',
    sort_order: 1,
  },
  {
    title: 'Deep Learning Specialization',
    issuer: 'DeepLearning.AI (Coursera)',
    issue_date: '2024',
    credential_url: '',
    sort_order: 2,
  },
  {
    title: 'Data Engineering with Python',
    issuer: 'IBM / Coursera',
    issue_date: '2025',
    credential_url: '',
    sort_order: 3,
  },
  {
    title: 'MLOps Fundamentals',
    issuer: 'Google Cloud / Coursera',
    issue_date: '2025',
    credential_url: '',
    sort_order: 4,
  },
];

// All settings that live in the DB instead of hard-coded HTML.
// These become editable from the admin Settings panel (Phase 6).
const DEFAULT_SETTINGS = [
  // ── Site identity
  { key: 'site.title',                 value: 'Kanishk | AI/ML Engineer' },
  { key: 'site.tagline',               value: 'Building Intelligent Systems with Data, Machine Learning & AI' },
  { key: 'site.description',           value: 'Portfolio of Kanishk — AI/ML engineer and research-oriented developer specialising in machine learning, deep learning, NLP, data engineering and generative AI.' },

  // ── Hero section
  { key: 'hero.headline',              value: 'Building Intelligent Systems\nwith Data, ML & AI' },
  { key: 'hero.subheadline',           value: 'Specialising in Machine Learning, Deep Learning, NLP, Data Engineering, and Generative AI — turning raw data into production-ready intelligent systems.' },
  { key: 'hero.cta_primary_label',     value: 'Explore Projects' },
  { key: 'hero.cta_secondary_label',   value: 'Contact Me' },

  // ── About section
  { key: 'about.headline',             value: 'Research-Driven Engineer.\nBuilder at Heart.' },
  { key: 'about.body',                 value: "I'm an AI/ML engineer who obsesses over the full stack of a machine learning system — from raw dataset to deployed model to the metrics that actually matter in production.\n\nMy work spans classical machine learning, deep learning, large language models, and data pipelines. I believe the best AI systems are those that are rigorously engineered, honestly evaluated, and genuinely useful.\n\nI'm drawn to problems at the intersection of research and engineering: taking an idea from a paper, validating it on real data, and shipping it as something people can use." },

  // ── Contact / social
  { key: 'contact.email',              value: 'your@email.com' },
  { key: 'contact.github',             value: 'https://github.com/yourusername' },
  { key: 'contact.linkedin',           value: 'https://linkedin.com/in/yourusername' },
  { key: 'contact.resume_url',         value: '' },

  // ── Footer
  { key: 'footer.tagline',             value: 'Built with curiosity, engineered with intent.' },

  // ── Timeline section (homepage). Stored as a JSON array string;
  // each item: { year, title, description, category }
  // category is one of: "Learning Journey", "Projects", "Research",
  // "Certifications", "Achievements" — drives the colored tag on each entry.
  { key: 'timeline.items', value: JSON.stringify([
    { year: '2023', category: 'Learning Journey', title: 'Started CS Undergrad',
      description: 'Began a Computer Science degree, with an early pull toward data and machine learning over general software development.' },
    { year: '2024', category: 'Learning Journey', title: 'First ML Models',
      description: 'Built first classical ML projects — classification and regression pipelines using scikit-learn, then moved into XGBoost and ensemble methods.' },
    { year: '2025', category: 'Projects', title: 'Production-Grade Deployments',
      description: 'Shipped multiple end-to-end projects: a resume analyzer using sentence-transformers + Gemini, a FinBERT-based market sentiment system, and a Streamlit-deployed predictor — each fully containerized and live.' },
    { year: '2025', category: 'Research', title: 'Generative AI & RAG Systems',
      description: 'Built a Retrieval-Augmented Generation clinical assistant combining FAISS vector search, sentence-transformers embeddings, and Gemini 2.0 Flash, deployed via FastAPI and Streamlit.' },
    { year: '2026', category: 'Achievements', title: 'Industry Internship',
      description: 'Joined a Summer internship building a predictive maintenance ML pipeline, working with real sensor data, feature engineering, and production data integration challenges.' },
  ]) },

  // ── SEO / Open Graph
  { key: 'og.image',                   value: '/assets/img/og-default.png' },
  { key: 'twitter.handle',             value: '@yourusername' },
];

// ---------------------------------------------------------------
// SEED
// ---------------------------------------------------------------

async function seed() {
  console.log(`[seed] Opening database at: ${DB_PATH}`);
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  // ── Admin user ────────────────────────────────────────────────
  console.log('[seed] Creating admin user...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, name, role)
    VALUES (?, ?, ?, 'admin')
  `).run(ADMIN_EMAIL, passwordHash, ADMIN_NAME);
  console.log(`[seed]   Admin: ${ADMIN_EMAIL}`);

  // ── Categories ────────────────────────────────────────────────
  console.log('[seed] Seeding categories...');
  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (name, slug, sort_order)
    VALUES (@name, @slug, @sort_order)
  `);
  for (const cat of CATEGORIES) insertCategory.run(cat);
  console.log(`[seed]   ${CATEGORIES.length} categories`);

  // ── Skill categories + skills ─────────────────────────────────
  console.log('[seed] Seeding skills...');
  const insertSkillCat = db.prepare(`
    INSERT OR IGNORE INTO skill_categories (name, icon, sort_order)
    VALUES (@name, @icon, @sort_order)
  `);
  const getSkillCatId = db.prepare(`SELECT id FROM skill_categories WHERE name = ?`);
  const insertSkill   = db.prepare(`
    INSERT OR IGNORE INTO skills (skill_category_id, name, proficiency, sort_order)
    VALUES (@skill_category_id, @name, @proficiency, @sort_order)
  `);

  for (const sc of SKILL_CATEGORIES) {
    insertSkillCat.run({ name: sc.name, icon: sc.icon, sort_order: sc.sort_order });
    const { id: catId } = getSkillCatId.get(sc.name);
    for (const skill of sc.skills) {
      insertSkill.run({ skill_category_id: catId, ...skill });
    }
  }
  console.log(`[seed]   ${SKILL_CATEGORIES.length} skill categories`);

  // ── Certificates ──────────────────────────────────────────────
  console.log('[seed] Seeding certificates...');
  const insertCert = db.prepare(`
    INSERT OR IGNORE INTO certificates (title, issuer, issue_date, credential_url, sort_order)
    VALUES (@title, @issuer, @issue_date, @credential_url, @sort_order)
  `);
  for (const cert of CERTIFICATES) insertCert.run(cert);
  console.log(`[seed]   ${CERTIFICATES.length} certificates`);

  // ── Default settings ──────────────────────────────────────────
  console.log('[seed] Seeding default settings...');
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (@key, @value)
  `);
  for (const s of DEFAULT_SETTINGS) insertSetting.run(s);
  console.log(`[seed]   ${DEFAULT_SETTINGS.length} settings`);

  db.close();
  console.log('\n[seed] ✓ Done. Your database is ready.');
  console.log(`\n  Admin login → Email: ${ADMIN_EMAIL}`);
  console.log(`               Password: (the one in your .env)`);
  console.log('\n  Remember to update contact.email, contact.github,');
  console.log('  contact.linkedin, and contact.resume_url in the');
  console.log('  admin Settings panel after your first login.\n');
}

seed().catch(err => {
  console.error('[seed] FAILED:', err.message);
  process.exit(1);
});
