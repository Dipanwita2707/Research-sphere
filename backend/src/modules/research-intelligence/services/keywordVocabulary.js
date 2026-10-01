/**
 * Keyword vocabulary for Research Intelligence extraction:
 * stopwords, abbreviation aliases, and curated multi-word domain phrases.
 *
 * Aliases are only applied to a whole keyword (e.g. an author keyword "ML"), or to an
 * UPPERCASE token in running text, so words such as "who" or "de" are never expanded.
 */

'use strict';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'used', 'using', 'use', 'based', 'via', 'also', 'such',
  'than', 'then', 'this', 'that', 'these', 'those', 'which', 'while', 'where', 'when', 'what', 'how', 'why',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'any', 'no', 'not', 'only', 'same',
  'so', 'very', 'just', 'about', 'above', 'after', 'again', 'between', 'but', 'during', 'further', 'here',
  'into', 'its', 'itself', 'like', 'our', 'over', 'their', 'them', 'under', 'until', 'well', 'without', 'we',
  'they', 'it', 'he', 'she', 'you', 'i', 'me', 'my', 'his', 'her', 'us', 'your', 'who', 'whom', 'whose',
  'towards', 'toward', 'through', 'within', 'among', 'across', 'against', 'along', 'upon', 'onto', 'per',
  'however', 'therefore', 'thus', 'moreover', 'furthermore', 'respectively', 'et', 'al', 'vs', 'versus',
]);

/** Single words too generic to be a research keyword on their own. */
const GENERIC_TERMS = new Set([
  'study', 'studies', 'analysis', 'approach', 'method', 'methods', 'methodology', 'paper', 'research', 'review',
  'survey', 'system', 'systems', 'model', 'models', 'novel', 'new', 'proposed', 'results', 'result', 'work',
  'framework', 'application', 'applications', 'technique', 'techniques', 'effect', 'effects', 'impact',
  'performance', 'evaluation', 'design', 'development', 'investigation', 'assessment', 'comparison',
  'comparative', 'role', 'case', 'data', 'article', 'articles', 'introduction', 'conclusion', 'overview',
  'india', 'indian', 'university', 'students', 'patients', 'treatment', 'management', 'health', 'education',
]);

const ALIAS_MAP = {
  // AI / ML / CS
  ml: 'Machine Learning', dl: 'Deep Learning', ai: 'Artificial Intelligence', nlp: 'Natural Language Processing',
  iot: 'Internet of Things', iiot: 'Industrial Internet of Things', xai: 'Explainable AI', llm: 'Large Language Models',
  llms: 'Large Language Models', cnn: 'Convolutional Neural Network', cnns: 'Convolutional Neural Network',
  rnn: 'Recurrent Neural Network', gnn: 'Graph Neural Network', gan: 'Generative Adversarial Network',
  gans: 'Generative Adversarial Network', rl: 'Reinforcement Learning', svm: 'Support Vector Machine',
  lstm: 'Long Short-Term Memory', vae: 'Variational Autoencoder', pca: 'Principal Component Analysis',
  knn: 'K-Nearest Neighbors', ids: 'Intrusion Detection System', sdn: 'Software-Defined Networking',
  wsn: 'Wireless Sensor Network', vanet: 'Vehicular Ad Hoc Network', manet: 'Mobile Ad Hoc Network',
  // Physics / cosmology
  pbh: 'Primordial Black Holes', eft: 'Effective Field Theory', cmb: 'Cosmic Microwave Background',
  bbn: 'Big Bang Nucleosynthesis', qcd: 'Quantum Chromodynamics', qed: 'Quantum Electrodynamics',
  qft: 'Quantum Field Theory', susy: 'Supersymmetry', gw: 'Gravitational Waves', agn: 'Active Galactic Nucleus',
  flrw: 'Friedmann-Lemaitre-Robertson-Walker',
  // Health / life sciences
  'covid-19': 'COVID-19', covid19: 'COVID-19', 'sars-cov-2': 'SARS-CoV-2', hiv: 'HIV', bmi: 'Body Mass Index',
  mri: 'Magnetic Resonance Imaging', ecg: 'Electrocardiography', eeg: 'Electroencephalography', dna: 'DNA',
  rna: 'RNA', pcr: 'Polymerase Chain Reaction', 'rt-pcr': 'RT-PCR', cbct: 'Cone Beam Computed Tomography',
  // Materials / characterisation
  sem: 'Scanning Electron Microscopy', tem: 'Transmission Electron Microscopy', xrd: 'X-Ray Diffraction',
  ftir: 'Fourier Transform Infrared Spectroscopy', 'uv-vis': 'UV-Visible Spectroscopy',
  dsc: 'Differential Scanning Calorimetry', tga: 'Thermogravimetric Analysis', dft: 'Density Functional Theory',
};

const CURATED_PHRASES = [
  // Cosmology & physics
  'primordial black holes', 'effective field theory', 'stochastic inflation', 'single field inflation',
  'ultra slow-roll', 'slow-roll inflation', 'dark energy', 'dark matter', 'cosmic microwave background',
  'cosmological perturbation theory', 'gravitational waves', 'gravitational lensing', 'neutron star',
  'black hole', 'general relativity', 'modified gravity', 'scalar field', 'string theory', 'quantum gravity',
  'loop quantum gravity', 'quantum cosmology', 'particle physics', 'high energy physics', 'standard model',
  'higgs boson', 'hubble tension', 'big bang nucleosynthesis', 'power spectrum', 'equation of state',
  'de sitter space', 'quantum field theory', 'condensed matter physics', 'quantum computing',
  // AI / ML / CS
  'machine learning', 'deep learning', 'artificial intelligence', 'natural language processing',
  'computer vision', 'image processing', 'image classification', 'object detection', 'semantic segmentation',
  'reinforcement learning', 'transfer learning', 'neural network', 'convolutional neural network',
  'recurrent neural network', 'generative adversarial network', 'large language models', 'knowledge graph',
  'data mining', 'feature extraction', 'feature selection', 'pattern recognition', 'anomaly detection',
  'sentiment analysis', 'named entity recognition', 'support vector machine', 'random forest', 'decision tree',
  'gradient boosting', 'federated learning', 'edge computing', 'cloud computing', 'fog computing',
  'internet of things', 'cyber security', 'network security', 'intrusion detection', 'blockchain',
  'explainable ai', 'generative ai', 'big data', 'wireless sensor network', 'software engineering',
  'recommender system', 'speech recognition', 'time series forecasting', 'optimization algorithm',
  'genetic algorithm', 'particle swarm optimization', 'smart grid', 'digital twin',
  // Pharmacy / medicine / dentistry
  'drug delivery', 'targeted drug delivery', 'controlled release', 'sustained release', 'antimicrobial activity',
  'antibacterial activity', 'antifungal activity', 'antioxidant activity', 'anti-inflammatory activity',
  'molecular docking', 'molecular dynamics', 'pharmacokinetics', 'bioavailability', 'phytochemical screening',
  'green synthesis', 'clinical trial', 'randomized controlled trial', 'systematic review', 'meta-analysis',
  'cross-sectional study', 'public health', 'quality of life', 'oral health', 'dental caries', 'dental implant',
  'periodontal disease', 'root canal', 'orthodontic treatment', 'oral cancer', 'breast cancer', 'diabetes mellitus',
  'antimicrobial resistance', 'mental health', 'medical imaging',
  // Materials / energy / environment
  'thin film', 'nanoparticles', 'nanocomposites', 'carbon nanotubes', 'quantum dots', 'graphene oxide',
  'zinc oxide', 'titanium dioxide', 'photocatalytic degradation', 'solar cell', 'fuel cell', 'supercapacitor',
  'energy storage', 'renewable energy', 'band gap', 'optical properties', 'dielectric properties',
  'wastewater treatment', 'heavy metals', 'climate change', 'sustainable development', 'life cycle assessment',
  'finite element analysis', 'computational fluid dynamics', 'heat transfer',
  // Management / social sciences
  'supply chain management', 'consumer behaviour', 'corporate governance', 'human resource management',
  'financial performance', 'digital marketing', 'higher education', 'e-learning',
];

module.exports = { STOPWORDS, GENERIC_TERMS, ALIAS_MAP, CURATED_PHRASES };
