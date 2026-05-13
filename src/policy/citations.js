export const CITATIONS = [
  {
    key: 'BSA',
    title: 'Bank Secrecy Act',
    citation: '31 U.S.C. § 5311 et seq.',
    summary:
      'Establishes recordkeeping and reporting obligations for U.S. financial institutions, including SAR-filing duties applicable to covered money-services businesses and digital-asset service providers where applicable.',
  },
  {
    key: 'AMLA2020',
    title: 'Anti-Money Laundering Act of 2020',
    citation: 'Public Law 116-283, Title LXIV',
    summary:
      'Expanded BSA requirements and modernized AML enforcement, including beneficial-ownership reporting and expanded scope for digital-asset activity.',
  },
  {
    key: 'FinCEN-Priorities',
    title: 'FinCEN National AML/CFT Priorities',
    citation: 'Financial Crimes Enforcement Network (Treasury)',
    summary:
      'Identifies the most significant AML/CFT threats facing the United States, including cybercrime (with virtual-currency considerations) and fraud.',
  },
  {
    key: 'OFAC',
    title: 'OFAC sanctions regime',
    citation: '50 U.S.C. § 1701 et seq. (IEEPA)',
    summary:
      'Authorizes designations of foreign persons and entities. Designations of cryptocurrency mixing infrastructure (e.g., Tornado Cash, Blender) directly implicate digital-asset transaction tracing and screening.',
  },
  {
    key: 'EO-14178',
    title: 'Executive Order 14178 — Strengthening American Leadership in Digital Financial Technology',
    citation: 'Executive Order 14178, January 23, 2025',
    summary:
      'Directs development of a federal digital-asset regulatory framework addressing market structure, oversight, consumer protection, and risk management.',
  },
  {
    key: 'CET-2024',
    title: '2024 Critical and Emerging Technologies List',
    citation: 'White House Office of Science and Technology Policy / NSTC',
    summary:
      'Identifies artificial intelligence, generative AI, large language models, distributed ledger technologies, digital assets, and digital payment technologies as critical and emerging technology areas.',
  },
  {
    key: 'Treasury-IF-2024',
    title: '2024 National Strategy for Combating Terrorist and Other Illicit Financing',
    citation: 'U.S. Department of the Treasury',
    summary:
      'Identifies illicit finance as a national security threat and explicitly recognizes scams, frauds, cybercrime, and criminal exploitation of payment technologies as part of the threat environment.',
  },
  {
    key: 'MRM-2026',
    title: 'OCC / Federal Reserve / FDIC 2026 revised interagency model-risk-management guidance',
    citation: 'OCC / FRB / FDIC',
    summary:
      'Emphasizes risk-based model development, validation, monitoring, governance, controls, and third-party model review. Explicitly acknowledges further work on banks’ use of generative and agentic AI.',
  },
  {
    key: 'IC3-2025',
    title: 'FBI IC3 2025 Annual Report',
    citation: 'Federal Bureau of Investigation, Internet Crime Complaint Center',
    summary:
      'Reports approximately $20.877 billion in total reported losses, approximately $11.367 billion in cryptocurrency-related reported losses, and approximately $8.649 billion in investment-fraud losses in 2025.',
  },
];

export function citationsBlock() {
  return CITATIONS.map(
    (c) => `[${c.key}] ${c.title} — ${c.citation}\n  ${c.summary}`
  ).join('\n\n');
}

export function citationKeys() {
  return CITATIONS.map((c) => c.key);
}
