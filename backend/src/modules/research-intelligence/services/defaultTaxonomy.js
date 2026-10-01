/**
 * Starter taxonomy seeded for a tenant that has none. Admins can edit it freely and
 * the AI classifier proposes additions (status "proposed") for review.
 */

'use strict';

module.exports = [
  {
    name: 'Computing & Information Technology', color: '#6366F1', icon: 'cpu',
    categories: ['Artificial Intelligence & Machine Learning', 'Computer Vision & Image Processing', 'Natural Language Processing',
      'Data Science & Big Data', 'Cybersecurity & Cryptography', 'Networks, IoT & Edge Computing', 'Cloud & Distributed Systems',
      'Software Engineering', 'Blockchain & Distributed Ledgers', 'Human-Computer Interaction'],
  },
  {
    name: 'Engineering & Technology', color: '#0EA5E9', icon: 'cog',
    categories: ['Electrical & Power Systems', 'Electronics & Communication', 'Signal Processing', 'Mechanical & Thermal Engineering',
      'Civil & Structural Engineering', 'Robotics & Automation', 'Manufacturing & Industrial Engineering', 'Control Systems'],
  },
  {
    name: 'Physical Sciences', color: '#8B5CF6', icon: 'atom',
    categories: ['Cosmology & Astrophysics', 'High Energy & Particle Physics', 'Condensed Matter Physics', 'Quantum Science',
      'Optics & Photonics', 'Mathematics & Statistics'],
  },
  {
    name: 'Chemical & Materials Sciences', color: '#14B8A6', icon: 'flask',
    categories: ['Nanomaterials & Nanotechnology', 'Materials Characterisation', 'Catalysis & Photocatalysis', 'Polymer Science',
      'Organic & Medicinal Chemistry', 'Energy Materials & Storage'],
  },
  {
    name: 'Medical & Health Sciences', color: '#EF4444', icon: 'heart-pulse',
    categories: ['Oncology', 'Infectious Diseases & Microbiology', 'Cardiovascular & Metabolic Health', 'Neuroscience & Mental Health',
      'Public Health & Epidemiology', 'Medical Imaging & Diagnostics', 'Clinical Research', 'Nursing & Allied Health'],
  },
  {
    name: 'Dental Sciences', color: '#F472B6', icon: 'smile',
    categories: ['Oral Pathology & Oral Medicine', 'Periodontics & Implantology', 'Orthodontics', 'Conservative Dentistry & Endodontics',
      'Prosthodontics', 'Oral & Maxillofacial Surgery', 'Community Dentistry'],
  },
  {
    name: 'Pharmaceutical Sciences', color: '#F59E0B', icon: 'pill',
    categories: ['Drug Delivery & Pharmaceutics', 'Pharmacology & Toxicology', 'Phytochemistry & Natural Products',
      'Computational Drug Discovery', 'Pharmaceutical Analysis'],
  },
  {
    name: 'Life & Agricultural Sciences', color: '#22C55E', icon: 'leaf',
    categories: ['Biotechnology & Molecular Biology', 'Genetics & Genomics', 'Agriculture & Crop Science', 'Food Science & Nutrition',
      'Veterinary & Animal Sciences'],
  },
  {
    name: 'Environment & Sustainability', color: '#10B981', icon: 'globe',
    categories: ['Climate Change', 'Renewable Energy', 'Water & Wastewater Treatment', 'Pollution & Environmental Monitoring',
      'Sustainable Development'],
  },
  {
    name: 'Management, Commerce & Economics', color: '#F97316', icon: 'briefcase',
    categories: ['Marketing & Consumer Behaviour', 'Finance & Accounting', 'Human Resource Management', 'Operations & Supply Chain',
      'Entrepreneurship & Innovation', 'Economics & Policy'],
  },
  {
    name: 'Social Sciences, Law & Humanities', color: '#A855F7', icon: 'book',
    categories: ['Education & Pedagogy', 'Psychology', 'Law & Governance', 'Media & Communication', 'Languages & Literature',
      'Sociology & Development Studies'],
  },
];
