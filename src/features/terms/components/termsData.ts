export interface TermSectionItem {
  id: string;
  title: string;
  tocLabel: string;
  paragraphs?: string[];
  meta?: string;
  lead?: string;
  listTitle?: string;
  bullets?: string[];
  trailing?: string;
  contacts?: { label: string; value: string }[];
}

export const TERMS_SECTIONS: TermSectionItem[] = [
  {
    id: "introduction",
    title: "Terms & Conditions",
    tocLabel: "Introduction",
    paragraphs: [
      "Please review the terms that apply when using GlassFit.",
      "Welcome to GlassFit, a web-based visualization system for customized glass and aluminum client-space fitting using photo-based simulation. By using GlassFit and its features, you agree to use the system in accordance with these Terms & Conditions.",
      "GlassFit is designed to support product visualization and customer consultation. The system provides visual previews, product configuration tools, quotation estimates, saved consultation references, and communication handoff features. It does not replace professional site measurement, structural assessment, fabrication planning, or installation evaluation.",
    ],
    meta: "Effective Date: March 2026  |  Last Updated: March 2026",
  },
  {
    id: "using-glassfit",
    title: "Using GlassFit",
    tocLabel: "Use of GlassFit",
    paragraphs: [
      "GlassFit allows customers to browse available glass and aluminum products, view product previews, inspect interactive 3D product models, upload an image of their actual space, configure product overlays, generate visualization outputs, review quotation estimates, and prepare consultation references.",
      "Customers must use GlassFit only for lawful product visualization and consultation purposes.",
    ],
  },
  {
    id: "product-information",
    title: "Product Information",
    tocLabel: "Product Information and Variations",
    paragraphs: [
      "GlassFit may display product information including product names, categories, images, 2D previews, 3D models, materials, finishes, colors, sizes, design variations, and other available product options.",
      "Available products and variations are based on the product records maintained by the participating glass and aluminum business.",
      "Product information, availability, variations, and pricing rules may be updated by authorized business personnel when necessary.",
    ],
  },
  {
    id: "visualization-reference",
    title: "Visualization is for Reference Only",
    tocLabel: "Photo-Based Visualization",
    paragraphs: [
      "GlassFit uses photo-based simulation rather than real-time augmented reality. Customers upload an image of their actual space and place selected glass and aluminum product overlays within that image.",
      "Depending on the available product and visualization features, customers may adjust product placement, size, scale, rotation, viewing angle, product variations, and layer arrangement. The system may also provide visual matching, object-aware layering, shadow support, glass visualization options, multiple product overlays, and before-and-after previews.",
      "The generated visualization is intended to help customers understand the possible appearance, placement, and spatial compatibility of a selected product. It does not guarantee the exact appearance, dimensions, scale, depth, alignment, lighting, material appearance, or physical fit of the final installed product.",
    ],
  },
  {
    id: "uploaded-images",
    title: "Your Uploaded Images",
    tocLabel: "Uploaded Space Images",
    paragraphs: [
      "Customers may upload images of their actual space for use in GlassFit's photo-based visualization features.",
      "Customers should only upload images they are authorized to use. Customers should avoid uploading images containing unnecessary personal, confidential, or sensitive information.",
      "Uploaded space images may be processed by GlassFit to prepare the image for product placement, image analysis, visual matching, visualization generation, and related consultation features.",
      "The customer retains ownership of their uploaded image. By uploading an image, the customer allows GlassFit to process and store the image as necessary to provide the requested visualization and consultation-reference features.",
    ],
  },
  {
    id: "image-processing",
    title: "Image Processing and Visual Effects",
    tocLabel: "Image Processing and Visual Effects",
    paragraphs: [
      "GlassFit may analyze characteristics of an uploaded image to support the visual consistency of product overlays.",
      "Depending on the available features, this may include image-based lighting analysis, ambient light matching, position-based visual matching, object-aware layering, shadow support, camera-quality matching, and glass visualization options.",
      "These features are intended to improve the visual presentation of the product overlay. They do not guarantee physically accurate lighting, exact depth estimation, exact camera calibration, perfect object detection, perfect object boundaries, or photorealistic rendering.",
      "If an automated image-processing feature cannot produce a reliable result, standard manual overlay controls may still be used where available.",
    ],
  },
  {
    id: "measurements-confirmation",
    title: "Final Measurements Must Be Professionally Confirmed",
    tocLabel: "Measurements and Physical Fitting",
    paragraphs: [
      "GlassFit is a visualization and consultation-support system and should not be used as a substitute for professional measurement or site assessment.",
      "Measurements, dimensions, placement, scale, and fitting shown in a visualization are visual references and do not guarantee exact real-world measurements or installation accuracy.",
      "Final measurements, structural assessment, fabrication requirements, product specifications, and precise fitting must be confirmed by the glass and aluminum business during the appropriate professional consultation or site assessment.",
    ],
  },
  {
    id: "quotation-estimates",
    title: "Quotation Estimates",
    tocLabel: "Quotation Estimates",
    paragraphs: [
      "GlassFit may generate a quotation estimate based on information such as the selected product, product variations, dimensions, materials, finishes, quantities, customization options, and applicable quotation-estimation rules.",
      "The generated amount is an approximate consultation reference only.",
      "A GlassFit quotation estimate is not a final formal quotation, contract, invoice, or guarantee of the final project price.",
      "Final pricing may change depending on actual site measurements, selected materials, material availability, site conditions, labor requirements, negotiation, and approval from the business.",
    ],
  },
  {
    id: "account-authentication",
    title: "Account and Authentication",
    tocLabel: "Customer Accounts",
    paragraphs: [
      "Customers may browse products, create visualization previews, and review quotation estimates before being required to authenticate.",
      "An account or login is required when the customer chooses to save a persistent consultation reference or generate a signed consultation reference link.",
      "Customers are responsible for providing accurate account information and maintaining the confidentiality of their login credentials.",
    ],
  },
  {
    id: "saving-consultation-reference",
    title: "Saving Your Consultation Reference",
    tocLabel: "Saved Consultation References",
    paragraphs: [
      "GlassFit may save information associated with a customer consultation, including the selected product configuration, visualization snapshot, quotation estimate, and related reference information.",
      "Saved consultation references are intended to preserve the customer's selected configuration and visualization for consultation and follow-up with the business.",
      "They do not represent final project approval, a final quotation, a fabrication order, or an installation agreement.",
    ],
  },
  {
    id: "sharing-consultation-reference",
    title: "Sharing a Signed Consultation Reference",
    tocLabel: "Signed Consultation Reference Links",
    paragraphs: [
      "GlassFit may generate a signed consultation reference link associated with a saved visualization and product configuration.",
      "The reference may include information such as the selected product, product variations, visualization snapshot, quotation estimate, and consultation-reference information.",
      "Customers should share signed consultation reference links only with intended recipients.",
      "A signed consultation reference may become unavailable if the link expires, becomes invalid, or can no longer be retrieved by the system.",
    ],
  },
  {
    id: "external-communication",
    title: "External Communication Platforms",
    tocLabel: "Messenger and Viber Consultation Handoff",
    paragraphs: [
      "GlassFit may prepare a consultation message and signed consultation reference that customers can send to the business through Messenger or Viber.",
      "Messenger and Viber are external communication platforms and are not operated or controlled by GlassFit.",
      "When a customer continues through Messenger or Viber, the customer leaves the GlassFit environment and becomes subject to the selected platform's own terms, privacy practices, availability, and security procedures.",
      "GlassFit does not control conversations or activities that occur after the consultation is handed off to an external communication platform.",
    ],
  },
  {
    id: "system-limitations",
    title: "System Limitations",
    tocLabel: "Services Not Provided by GlassFit",
    lead: "GlassFit primarily focuses on product visualization, client-space fitting, quotation estimation, and consultation-reference generation.",
    listTitle: "GlassFit does not provide:",
    bullets: [
      "inventory management;",
      "online payment processing;",
      "delivery tracking;",
      "complete project management;",
      "professional site measurement;",
      "structural assessment;",
      "guaranteed physical fitting;",
      "final fabrication approval; or",
      "complete scheduling management within the system.",
    ],
    trailing:
      "Further project arrangements, including professional measurements, scheduling, negotiation, fabrication, installation, and final pricing, remain subject to confirmation by the business.",
  },
  {
    id: "responsible-use",
    title: "Responsible Use",
    tocLabel: "Acceptable Use",
    paragraphs: [
      "Customers must not use GlassFit to upload unlawful or unauthorized content, interfere with system operation, attempt to gain unauthorized access to other accounts or administrative functions, bypass system security, or use the platform in a way that violates applicable laws or the rights of others.",
    ],
  },
  {
    id: "availability-performance",
    title: "Availability and Performance",
    tocLabel: "System Availability",
    paragraphs: [
      "GlassFit is designed to operate through supported modern web browsers on desktop and mobile devices.",
      "System performance and visualization quality may vary depending on the customer's device, browser capability, internet connection, uploaded image quality and resolution, and the complexity of product models or visualization features.",
      "Continuous or error-free operation cannot be guaranteed.",
    ],
  },
  {
    id: "privacy-personal-information",
    title: "Privacy and Personal Information",
    tocLabel: "Privacy",
    paragraphs: [
      "GlassFit may process customer account information, uploaded space images, product configurations, visualization snapshots, quotation estimates, and consultation-reference information when required to provide its features.",
      "More information about how this information is handled is available in the GlassFit Privacy Policy.",
    ],
  },
  {
    id: "updates-terms",
    title: "Updates to These Terms",
    tocLabel: "Changes to These Terms",
    paragraphs: [
      "These Terms & Conditions may be updated when GlassFit features, system practices, or business requirements change.",
      "The current version should display its effective date so users can identify when the terms were last updated.",
    ],
  },
  {
    id: "contact-business",
    title: "Contact the Business",
    tocLabel: "Contact",
    lead: "For questions about these Terms & Conditions or the use of GlassFit, please contact:",
    contacts: [
      { label: "Business Name:", value: "[Participating Business Name]" },
      { label: "Email Address:", value: "[Business Email]" },
      { label: "Contact Number:", value: "[Business Contact Number]" },
      { label: "Business Address:", value: "[Business Address]" },
    ],
  },
];

export const CLOSING_DISCLAIMER =
  "By using GlassFit, you acknowledge that visualization outputs and quotation estimates are consultation references only. Final measurements, specifications, pricing, fabrication requirements, and installation details must be confirmed by the business.";
