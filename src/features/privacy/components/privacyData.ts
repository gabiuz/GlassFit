export interface PrivacySectionItem {
  id: string;
  title: string;
  tocLabel: string;
  subtitle?: string;
  paragraphs?: string[];
  meta?: string;
  lead?: string;
  listTitle?: string;
  bullets?: string[];
  trailing?: string;
  contacts?: { label: string; value: string }[];
}

export const PRIVACY_SECTIONS: PrivacySectionItem[] = [
  {
    id: "introduction",
    title: "Privacy Policy",
    tocLabel: "Introduction",
    subtitle: "Learn how information is handled when you use GlassFit.",
    paragraphs: [
      "GlassFit respects the privacy of its users. This Privacy Policy explains the types of information that may be processed when customers use GlassFit and how that information supports product visualization, quotation estimation, saved consultation references, account authentication, and customer-business consultation.",
      "GlassFit is a web-based visualization and consultation-support system for customized glass and aluminum products.",
    ],
    meta: "Effective Date: March 2026  |  Last Updated: March 2026",
  },
  {
    id: "information-we-process",
    title: "Information We May Process",
    tocLabel: "Information We May Process",
    paragraphs: [
      "The information processed by GlassFit depends on the features used by the customer.",
      "This information may include account and contact information, uploaded space images, selected products and product variations, visualization settings and outputs, quotation estimates, saved consultation references, and related system information.",
    ],
  },
  {
    id: "account-information",
    title: "Account Information",
    tocLabel: "Account Information",
    lead: "When a customer creates an account or authenticates to save a consultation reference, GlassFit may process information necessary to identify and manage the customer account.",
    listTitle: "This may include:",
    bullets: [
      "Full Name",
      "Email Address",
      "Contact Number",
      "Account authentication information",
    ],
    paragraphs: [
      "Customer authentication is required when saving persistent consultation information or generating a signed consultation reference link.",
      "Customers should keep their login credentials confidential and should not intentionally provide inaccurate account information.",
    ],
  },
  {
    id: "uploaded-space-images",
    title: "Space Images You Upload",
    tocLabel: "Space Images You Upload",
    paragraphs: [
      "GlassFit allows customers to upload an image of their actual interior or project space.",
      "The uploaded space image serves as the background for photo-based product visualization and may be processed to prepare the image for product placement, visual matching, object-aware layering, and visualization-output generation.",
      "Customers should only upload images they have permission to use.",
      "Customers are encouraged to review images before uploading them and avoid including people, documents, addresses, screens, or other unnecessary personal or confidential information.",
    ],
  },
  {
    id: "image-processing",
    title: "How Uploaded Images May Be Processed",
    tocLabel: "How Uploaded Images May Be Processed",
    lead: "GlassFit may perform backend-assisted image analysis to support visualization features.",
    listTitle:
      "Depending on the available system features, image processing may consider visual characteristics such as:",
    bullets: [
      "image brightness;",
      "ambient color;",
      "contrast;",
      "saturation;",
      "sharpness;",
      "noise;",
      "approximate light direction; and",
      "visible foreground objects or image regions used for object-aware layering.",
    ],
    paragraphs: [
      "These characteristics are used to support product placement and improve the visual consistency of product overlays within the uploaded image.",
      "Image analysis is intended for visualization support and does not guarantee exact physical measurements, depth estimation, object detection, or environmental reconstruction.",
    ],
  },
  {
    id: "product-configuration",
    title: "Your Product Configuration",
    tocLabel: "Your Product Configuration",
    lead: "GlassFit may process information about the products and options selected during a visualization session.",
    listTitle: "This may include:",
    bullets: [
      "selected product;",
      "selected product variation;",
      "dimensions;",
      "material;",
      "finish;",
      "color;",
      "glass type;",
      "size;",
      "design options;",
      "product placement;",
      "scale;",
      "rotation;",
      "viewing angle;",
      "layer arrangement; and",
      "other available visualization settings.",
    ],
    paragraphs: [
      "This information may be used to generate the visualization output and quotation estimate.",
    ],
  },
  {
    id: "visualization-outputs",
    title: "Visualization Outputs and Snapshots",
    tocLabel: "Visualization Outputs and Snapshots",
    lead: "GlassFit may process visualization information created while the customer uses the visualization workspace.",
    listTitle: "This may include:",
    bullets: [
      "uploaded space image;",
      "selected product overlays;",
      "overlay placement and settings;",
      "multiple-overlay information;",
      "visual matching settings;",
      "object-aware layering settings;",
      "shadow settings;",
      "glass visualization settings;",
      "generated visualization output; and",
      "saved visualization snapshot.",
    ],
    paragraphs: [
      "Visualization settings may initially be maintained within the customer's current session. When the customer chooses to save a consultation reference, the relevant visualization information may be stored as part of the saved consultation record.",
    ],
  },
  {
    id: "quotation-estimate-data",
    title: "Quotation Estimate Data",
    tocLabel: "Quotation Estimate Data",
    lead: "GlassFit may process product and configuration information to generate a quotation estimate.",
    listTitle: "Information used for quotation estimation may include:",
    bullets: [
      "selected product;",
      "selected product variations;",
      "dimensions;",
      "material or finish;",
      "quantity;",
      "base price;",
      "applicable additional costs; and",
      "quotation-estimation rules maintained by authorized business personnel.",
    ],
    paragraphs: [
      "Quotation estimates are approximate consultation references and are not final formal quotations.",
    ],
  },
  {
    id: "saved-consultation-info",
    title: "Information Saved for Consultation",
    tocLabel: "Information Saved for Consultation",
    lead: "When an authenticated customer chooses to save a consultation reference, GlassFit may store information associated with that consultation.",
    listTitle: "The saved information may include:",
    bullets: [
      "customer account reference;",
      "selected product configuration;",
      "selected product variations;",
      "uploaded space image;",
      "visualization snapshot;",
      "visualization settings;",
      "quotation estimate;",
      "signed consultation reference information; and",
      "consultation or request status.",
    ],
    paragraphs: [
      "Authorized business personnel may access relevant consultation records through the administrative functions of GlassFit for consultation review and customer follow-up.",
    ],
  },
  {
    id: "shared-reference-links",
    title: "Information Shared Through Reference Links",
    tocLabel: "Information Shared Through Reference Links",
    paragraphs: [
      "GlassFit may generate a signed consultation reference link associated with a customer's saved configuration.",
      "The reference may provide access to information needed for consultation, including the selected product configuration, visualization snapshot, quotation estimate, and related reference information.",
      "Customers should share signed consultation reference links only with intended recipients.",
      "Signed consultation reference links may become unavailable if they expire, become invalid, or can no longer be retrieved by the system.",
    ],
  },
  {
    id: "why-we-process-info",
    title: "Why We Process Information",
    tocLabel: "Why We Process Information",
    listTitle: "Information processed through GlassFit may be used to:",
    bullets: [
      "authenticate customer accounts;",
      "provide product browsing and configuration features;",
      "process uploaded space images;",
      "perform image analysis;",
      "generate photo-based visualization previews;",
      "manage product overlays and visualization settings;",
      "generate visualization outputs;",
      "generate quotation estimates;",
      "save visualization snapshots and product configurations;",
      "generate signed consultation reference links;",
      "support customer-business consultation;",
      "allow authorized Admin personnel to review consultation records;",
      "maintain system functionality and security; and",
      "support customer follow-up through the documented consultation workflow.",
    ],
    paragraphs: [
      "Information should be used only as reasonably necessary to provide and operate the GlassFit system and its consultation-support features.",
    ],
  },
  {
    id: "authorized-business-access",
    title: "Authorized Business Access",
    tocLabel: "Authorized Business Access",
    lead: "Authorized Admin personnel may access administrative functions necessary to manage GlassFit and review customer consultation records.",
    listTitle:
      "Depending on their authorized functions, Admin personnel may access information such as:",
    bullets: [
      "customer consultation or booking records;",
      "visualization snapshots;",
      "selected product configurations;",
      "quotation estimates;",
      "signed consultation reference information; and",
      "consultation request status.",
    ],
    paragraphs: [
      "Administrative access should be limited to authorized personnel and used only for appropriate system-management and consultation purposes.",
    ],
  },
  {
    id: "protecting-information",
    title: "Protecting Information",
    tocLabel: "Protecting Information",
    paragraphs: [
      "GlassFit uses account authentication and controlled administrative access to support the protection of customer and consultation information.",
      "Reasonable technical and administrative safeguards should be applied to protect stored information from unauthorized access, alteration, disclosure, or loss.",
      "However, no web-based system or electronic storage method can guarantee absolute security.",
      "Customers are also responsible for protecting their account credentials and signed consultation reference links.",
    ],
  },
  {
    id: "data-retention",
    title: "How Long Information Is Kept",
    tocLabel: "How Long Information Is Kept",
    paragraphs: [
      "Information should be retained only for as long as reasonably necessary to provide the relevant GlassFit feature, maintain saved consultation references, support legitimate consultation follow-up, maintain appropriate system records, or meet applicable requirements.",
      "Specific retention periods for customer accounts, uploaded space images, visualization snapshots, consultation records, and related system information should be finalized according to the business's actual operational and technical requirements.",
    ],
  },
  {
    id: "external-communication",
    title: "External Communication Platforms",
    tocLabel: "External Communication Platforms",
    paragraphs: [
      "GlassFit may prepare consultation messages and signed consultation references that customers can send through Messenger or Viber.",
      "Messenger and Viber operate outside GlassFit.",
      "When a customer chooses to continue through one of these platforms, information sent through that platform becomes subject to the selected platform's own privacy practices, terms, and security procedures.",
      "GlassFit does not control how Messenger or Viber processes information after the customer leaves the GlassFit system.",
    ],
  },
  {
    id: "questions-requests",
    title: "Questions and Requests About Your Information",
    tocLabel: "Questions and Requests About Your Information",
    paragraphs: [
      "Customers may contact the business regarding questions or concerns about personal information associated with their GlassFit account or saved consultation records.",
      "Requests concerning access, correction, deletion, or other handling of personal information should be evaluated according to applicable requirements and the business's established procedures.",
    ],
    listTitle: "Contact Information:",
    contacts: [
      { label: "Business Name:", value: "[Participating Business Name]" },
      { label: "Privacy Contact:", value: "[Authorized Contact / Position]" },
      { label: "Email Address:", value: "[Privacy or Business Email]" },
      { label: "Contact Number:", value: "[Business Contact Number]" },
      { label: "Business Address:", value: "[Business Address]" },
    ],
  },
  {
    id: "policy-updates",
    title: "Privacy Policy Updates",
    tocLabel: "Privacy Policy Updates",
    paragraphs: [
      "This Privacy Policy may be updated when GlassFit features, data-handling practices, technical implementation, or applicable requirements change.",
      "The current version should display an updated effective date whenever revisions are made.",
    ],
  },
  {
    id: "contact-business",
    title: "Contact the Business",
    tocLabel: "Contact the Business",
    lead: "For questions about this Privacy Policy or the use of GlassFit, please contact:",
    listTitle: "Contact Information:",
    contacts: [
      { label: "Business Name:", value: "[Participating Business Name]" },
      { label: "Privacy Contact:", value: "[Authorized Contact / Position]" },
      { label: "Email Address:", value: "[Privacy or Business Email]" },
      { label: "Contact Number:", value: "[Business Contact Number]" },
      { label: "Business Address:", value: "[Business Address]" },
    ],
  },
];

export const CLOSING_DISCLAIMER =
  "By using GlassFit, you acknowledge that visualization outputs and quotation estimates are consultation references only. Final measurements, specifications, pricing, fabrication requirements, and installation details must be confirmed by the business.";
