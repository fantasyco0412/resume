type Industry = "healthcare" | "fintech" | "ecommerce" | "defense_gov";

const HEALTHCARE_BUZZWORDS = `Healthcare Interoperability & Standards
• HL7 v2
• FHIR (Fast Healthcare Interoperability Resources) – FHIR R4
• CCD / C-CDA
• SMART on FHIR
• FHIR APIs
• Clinical Data Exchange
• Healthcare Messaging
• Interoperability

EMR / EHR & Clinical Systems
• EMR / EHR Systems
• Epic
• Cerner (Oracle Health)
• Athenahealth
• Allscripts
• Clinical Workflows
• Longitudinal Patient Records
• Care Coordination
• Provider Directory
• Clinical Decision Support (CDS)

Healthcare Compliance & Security
• HIPAA Compliance
• PHI / PII
• Audit Logging
• Privacy-by-Design
• Role-Based Access Control (RBAC)
• Data Encryption (At Rest / In Transit)
• SOC 2 (Healthcare SaaS)

Claims, Payers & Revenue Cycle
• Claims Processing
• Eligibility & Benefits
• Prior Authorization
• Utilization Management
• Claims Adjudication
• Revenue Cycle Management (RCM)
• Explanation of Benefits (EOB)

Digital Health & Virtual Care
• Digital Health Platforms
• Virtual Care
• Telehealth / Telemedicine
• Mental Health Platforms
• Patient Engagement
• Asynchronous Care
• Remote Care
• Behavioral Health Technology

Healthcare Architecture & Platform Engineering
• Event-Driven Architecture
• CQRS
• Microservices
• FHIR-First Architecture
• Real-Time Clinical Data Streaming
• High Availability Healthcare Systems
• Patient-Facing Applications
• Clinician-Facing Applications`;

const FINTECH_BUZZWORDS = `Fintech Buzzwords
Payments & Transaction Processing
• Payment Processing
• Payment Orchestration
• Authorization, Capture, Settlement
• Payment Gateways
• Payment Rails
• ACH / SEPA / SWIFT
• Real-Time Payments (RTP)
• Idempotent Payments
• Transaction Lifecycle
• Reconciliation

FinTech Compliance & Security
• PCI DSS Compliance
• PSD2
• Strong Customer Authentication (SCA)
• Tokenization
• Encryption (At Rest / In Transit)
• Fraud Prevention
• Risk Controls
• Secure Payment Flows
• Audit Trails
• Financial Data Security

Banking & Financial Systems
• Core Banking Systems
• Ledger Systems
• Double-Entry Accounting
• Account Balances
• Clearing & Settlement
• Transaction Journals
• Funds Availability
• Interest Calculation
• Fee Calculation Engines

Fraud, Risk & Trust
• Fraud Detection
• Risk Scoring
• Transaction Monitoring
• Velocity Checks
• Anomaly Detection
• Chargebacks
• Dispute Management
• AML (Anti-Money Laundering)
• KYC (Know Your Customer)
• KYB (Know Your Business)

FinTech Architecture & Platform Engineering
• Event-Driven Architecture
• CQRS
• Microservices
• Distributed Transactions
• Idempotency
• Exactly-Once Processing
• High-Throughput Systems
• Low-Latency Systems
• Scalable Payment Platforms
• Financial Data Pipelines

Digital Wallets, Lending & Consumer FinTech
• Digital Wallets
• Balance Management
• Peer-to-Peer Payments
• Buy Now, Pay Later (BNPL)
• Credit Scoring
• Loan Origination
• Repayment Schedules
• Interest Accrual
• Consumer Financial Products`;

const ECOMMERCE_BUZZWORDS = `ECommerce Buzzwords
Core eCommerce Platform Concepts
• Product Catalog
• SKU Management
• Inventory Management
• Pricing Engine
• Promotions & Discounts
• Cart & Checkout
• Order Management System (OMS)
• Order Lifecycle
• Fulfillment
• Returns & Refunds

Checkout, Payments & Conversion
• Checkout Optimization
• Payment Orchestration
• Payment Gateways
• Authorization & Settlement
• Conversion Rate Optimization (CRO)
• Abandoned Cart Recovery
• Fraud Prevention
• Taxes & Duties
• Multi-Currency Payments

Marketplace & Merchandising
• Marketplace Platforms
• Third-Party Sellers
• Catalog Ingestion
• Search & Discovery
• Product Recommendations
• Personalization
• Merchandising Rules
• A/B Testing

Order Fulfillment & Logistics
• Warehouse Management Systems (WMS)
• Shipping Rate Calculation
• Carrier Integrations
• Order Routing
• Split Shipments
• Last-Mile Delivery
• Reverse Logistics

eCommerce Architecture & Scale
• High-Traffic Systems
• Event-Driven Architecture
• Microservices
• CQRS
• Distributed Transactions
• Idempotency
• Scalable Retail Platforms
• Peak Traffic Handling

Customer Experience & Analytics
• Customer Journey
• User Session Management
• Behavioral Analytics
• Clickstream Data
• Real-Time Dashboards
• Customer Retention
• Loyalty Programs`;

const DEFENSE_GOV_BUZZWORDS = `Defense, Government & Intelligence Community
Mission & Systems Engineering
• Mission Engineering
• Mission-Critical Systems
• Systems Engineering
• Intelligence Integration
• Data Integration Pipelines
• Enterprise Integration
• Full-Stack Mission Applications
• Stakeholder-Facing Technical Delivery
• Requirements Traceability
• Technical Documentation

Intelligence Community & National Security (domain vocabulary only — do not claim clearance)
• Intelligence Community (IC)
• National Security Mission Support
• Government Mission Systems
• Federal Technology Programs
• Secure Software Development
• Classified-Environment Readiness (only if profile supports secure/compliance work — never claim active clearance)
• Cross-Agency Data Sharing
• Analyst-Facing Tools
• Operational Technology Support

Defense & Federal Engineering
• DevSecOps
• Secure SDLC
• Authority to Operate (ATO) awareness
• FedRAMP-aligned practices
• RMF / NIST frameworks (when JD-relevant)
• DISA STIG awareness
• Zero Trust Architecture
• Role-Based Access Control (RBAC)
• Audit Logging & Compliance Controls
• High-Availability Government Systems

Full-Stack & Platform (common JD stack)
• Angular
• React
• Vue.js
• Node.js
• Python
• C#
• Java
• JavaScript / TypeScript
• HTML / CSS
• jQuery
• REST / CRUD APIs
• PostgreSQL / MongoDB
• Nginx / Apache
• Git / GitHub / GitLab
• CI/CD Pipelines
• Containerization & Cloud Deployment`;

const INDUSTRY_BLOCKS: Record<Industry, string> = {
  healthcare: HEALTHCARE_BUZZWORDS,
  fintech: FINTECH_BUZZWORDS,
  ecommerce: ECOMMERCE_BUZZWORDS,
  defense_gov: DEFENSE_GOV_BUZZWORDS,
};

const INDUSTRY_LABELS: Record<Industry, string> = {
  healthcare: "Healthcare",
  fintech: "Financial Services",
  ecommerce: "E-commerce",
  defense_gov: "Defense & Government",
};

/** Human-readable industry label from JD keywords (fallback when AI extraction is empty). */
export function inferIndustryLabelFromJd(jd: string): string {
  const industries = detectResumeIndustries(jd);
  if (industries.length === 0) return "";
  return industries.map((industry) => INDUSTRY_LABELS[industry]).join(" · ");
}

/** Pick industry vocabulary blocks that match the JD (reduces prompt size vs sending all three). */
export function detectResumeIndustries(jd: string): Industry[] {
  const lower = jd.toLowerCase();
  const found = new Set<Industry>();

  if (
    /\b(health\s*care|healthcare|clinical|hipaa|fhir|hl7|patient|medical|pharma|hospital|diagnostic|genomic|laboratory|physician|ehr|emr|biotech|life sciences|telehealth|rcm)\b/.test(
      lower
    )
  ) {
    found.add("healthcare");
  }
  if (
    /\b(fintech|fin-tech|payment processing|banking|lending|digital wallet|transaction|pci dss|aml|kyc|ledger|brokerage|underwriting|insurtech)\b/.test(
      lower
    )
  ) {
    found.add("fintech");
  }
  if (
    /\b(ecommerce|e-commerce|retail|marketplace|checkout|sku|merchandising|shopify|fulfillment|inventory management|order management)\b/.test(
      lower
    )
  ) {
    found.add("ecommerce");
  }
  if (
    /\b(defense|defence|government|federal|intelligence community|\bic\b|national security|mission engineering|dod|department of defense|mitre|clearance|ts\/sci|top secret|polygraph|intel integration|mission.system|govcon|government contract|federal contractor|intelligence analyst|secure facility|classified)\b/.test(
      lower
    )
  ) {
    found.add("defense_gov");
  }

  return [...found];
}

export function buildIndustryBuzzwordsForJd(jd: string): string {
  if (process.env.RESUME_PROMPT_COMPACT === "true") {
    return "";
  }

  const industries = detectResumeIndustries(jd);
  if (industries.length === 0) {
    return `
----------------------------------------
INDUSTRY VOCABULARY
----------------------------------------
- Use terminology and tools stated in the JD only.

`;
  }

  const blocks = industries.map((industry) => INDUSTRY_BLOCKS[industry]).join("\n\n");
  return `
----------------------------------------
INDUSTRY BUZZWORDS (MANDATORY VOCABULARY)
----------------------------------------

${blocks}

`;
}
