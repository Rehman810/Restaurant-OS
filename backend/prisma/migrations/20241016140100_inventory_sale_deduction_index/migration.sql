CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_order_item_sale_deduction_key"
  ON "StockMovement"("orderId", "itemId")
  WHERE "type" = 'SALE_DEDUCTION' AND "orderId" IS NOT NULL;
