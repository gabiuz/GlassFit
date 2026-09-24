/** Approved quotation appendix copy. Traceability: fix-MS-14, partial PRD-F11, SDD-C7, QAD-TC11. */
export interface QuotationTermsContent {
  readonly terms: readonly string[];
  readonly warranty: readonly string[];
}

export const QUOTATION_TERMS_CONTENT = {
  terms: [
    "These Terms and Conditions accompany this preliminary consultation estimate for review by the Customer and R.R.D. Aluminum and Glass Works. This preliminary estimate does not by itself create a binding contract.",
    "These Terms and Conditions apply only when incorporated into a final written quotation or agreement accepted by both parties. Any amendment must be agreed upon in writing by both the Customer and R.R.D. Aluminum and Glass Works.",
    "The final contract consists only of the final quotation and any other written agreement, specification, or document signed or expressly accepted by both parties.",
  ],
  warranty: [
    "R.R.D. Aluminum and Glass Works provides a six (6)-month warranty on defective accessories, commencing from the date of project completion or turnover.",
    "The warranty is subject to inspection and repair by R.R.D. Aluminum and Glass Works. Defective accessories covered under the warranty will be repaired whenever reasonably possible.",
    "The warranty does not cover defects or damage resulting from misuse, improper handling, accidents, unauthorized repairs or modifications, normal wear and tear, or circumstances beyond the control of R.R.D. Aluminum and Glass Works.",
  ],
} as const satisfies QuotationTermsContent;
