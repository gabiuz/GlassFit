-- Migration: 009_quotation_admin_labor_charge.sql
-- Description: Add explicit admin_labor_charge column to quotation_estimates to decouple site labor from product negotiation
-- Upstream Specifications: docs/prd-glassfit.md, docs/erd-glassfit.md, docs/implementation/ms26.md
-- Traceability: PRD-F10, PRD-F14, SDD-C8, ERD-E13, QAD-TC42

ALTER TABLE public.quotation_estimates
  ADD COLUMN IF NOT EXISTS admin_labor_charge NUMERIC(12,2) DEFAULT NULL;

COMMENT ON COLUMN public.quotation_estimates.admin_labor_charge IS
  'Explicit administrative site installation and mobilization labor fee confirmed upon booking review';

-- Add check constraint enforcing nonnegative labor charges within supported range
ALTER TABLE public.quotation_estimates
  ADD CONSTRAINT quotation_admin_labor_charge_range_check
  CHECK (admin_labor_charge IS NULL OR admin_labor_charge BETWEEN 0.00 AND 9999999999.99);

-- Backfill existing quotations where negotiated_amount exceeded calculated final price:
-- If quotation_estimates had a negotiated_amount greater than the calculated product total,
-- the difference represents a legacy confirmed labor charge.
DO $$
DECLARE
  quote RECORD;
  calc_total NUMERIC(12,2);
  diff NUMERIC(12,2);
BEGIN
  FOR quote IN
    SELECT quotation_id, total_estimated_amount, negotiated_amount, quotation_document_snapshot, item_price_overrides
    FROM public.quotation_estimates
    WHERE negotiated_amount IS NOT NULL
  LOOP
    calc_total := quote.total_estimated_amount;
    IF quote.negotiated_amount > calc_total THEN
      diff := quote.negotiated_amount - calc_total;
      UPDATE public.quotation_estimates
      SET admin_labor_charge = diff
      WHERE quotation_id = quote.quotation_id;
    END IF;
  END LOOP;
END $$;
