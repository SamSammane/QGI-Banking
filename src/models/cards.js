export const MODEL_CARDS = {
  'cnn-lstm': {
    name: 'CNN-LSTM Hybrid for Blockchain Payment Fraud',
    purpose:
      'Detect fraudulent transactions in blockchain payment data by combining CNN-derived local-structural features with LSTM-derived temporal dependencies. Engineered for the severe class-imbalance characteristic of fraud datasets.',
    addresses: [
      'Class imbalance via targeted sampling and loss weighting',
      'Lack of temporal sensitivity in standalone GNN classifiers',
      'Lack of graph-structural inductive bias in standalone RNN classifiers',
    ],
    paper: {
      title: 'Detection of Blockchain Online Payment Fraud Via CNN-LSTM',
      venue: 'BDICN 2026 (5th International Conference on Big Data, Information and Computer Network)',
      publisher: 'Association for Computing Machinery (ACM Digital Library)',
      doi: '10.1145/3801228.3801323',
      url: 'https://doi.org/10.1145/3801228.3801323',
      authors: 'Yuan, Lin, Wu, Chang',
    },
    status:
      'Model card and reproducible-benchmark scaffolding shipped in v0.1. Full reference training code targeted for Roadmap Phase I.',
  },

  cssa: {
    name: 'CSSA — Cross-Modal Semantic-Structural Alignment',
    purpose:
      'Fuse LLM-derived semantic representations with graph-contrastive structural representations into a single fraud detector through a unified contrastive objective.',
    addresses: [
      'Gap between purely semantic (NLP-on-memos) and purely structural (GNN-on-graphs) detectors',
      'Cross-modal alignment for payment fraud where transaction context spans text and graph',
    ],
    paper: {
      title:
        'CSSA: A Cross-Modal Semantic-Structural Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection of Online Payment',
      venue: 'Preprints.org',
      year: '2026',
    },
    status:
      'Model card shipped in v0.1. Reference implementation and ablation harness targeted for Roadmap Phase I/II.',
  },

  finscra: {
    name: 'FinSCRA — LLM-Powered Multi-Chain Reasoning for Interpretable Node Classification',
    purpose:
      'Use large language models to reason over text-attributed graphs of on-chain entities, producing classification decisions with explicit chain-of-thought reasoning suitable for regulated compliance review.',
    addresses: [
      'Cross-chain laundering patterns that defeat single-chain analytical tools',
      'Black-box graph classifiers that struggle under model-governance and explainability expectations',
      'Interpretability-by-construction for AML / BSA-aligned workflows',
    ],
    paper: {
      title:
        'FinSCRA: An LLM-Powered Multi-Chain Reasoning Framework for Interpretable Node Classification on Text-Attributed Graphs',
      venue: 'Preprints.org',
      year: '2026',
    },
    status:
      'Model card shipped in v0.1. Reference reasoning harness over text-attributed graphs targeted for Roadmap Phase II.',
  },
};

export function getCard(key) {
  return MODEL_CARDS[key?.toLowerCase()];
}

export function listCards() {
  return Object.keys(MODEL_CARDS);
}
