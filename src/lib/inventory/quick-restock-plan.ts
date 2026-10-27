// Phase 52 (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md, D1/D2/D4): the single mapping
// from what staff mean ("in xong", "nhập hàng ngoài", "kiểm kê", "hàng hỏng") to an inventory movement
// type and its sign. Pure — imported by the server service (which decides) and by the dialog (which only
// previews "Tồn cũ ± SL = Tồn mới"), so the preview can never disagree with what gets written.

export type QuickRestockIntentValue = 'PRINTED' | 'PURCHASED' | 'COUNTED' | 'DAMAGED';

export type StockEventPlan =
  | { kind: 'MOVE'; movementType: 'PRODUCTION_IN' | 'PURCHASE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE_OUT'; signedQuantity: number; onHandAfter: number }
  | { kind: 'NO_CHANGE'; onHandAfter: number };

/**
 * @param quantity staff input: units to add/remove (PRINTED/PURCHASED/DAMAGED, > 0) or the physical
 *   count (COUNTED, ≥ 0).
 * @param onHand current on-hand of the variant in the chosen warehouse.
 */
export function planStockEvent(intent: QuickRestockIntentValue, quantity: number, onHand: number): StockEventPlan {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('quantity must be a non-negative integer');
  switch (intent) {
    case 'PRINTED':
      return { kind: 'MOVE', movementType: 'PRODUCTION_IN', signedQuantity: quantity, onHandAfter: onHand + quantity };
    case 'PURCHASED':
      return { kind: 'MOVE', movementType: 'PURCHASE', signedQuantity: quantity, onHandAfter: onHand + quantity };
    case 'DAMAGED':
      return { kind: 'MOVE', movementType: 'DAMAGE_OUT', signedQuantity: -quantity, onHandAfter: onHand - quantity };
    case 'COUNTED': {
      const delta = quantity - onHand;
      if (delta === 0) return { kind: 'NO_CHANGE', onHandAfter: onHand };
      return { kind: 'MOVE', movementType: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', signedQuantity: delta, onHandAfter: quantity };
    }
  }
}

/** Movement types a stored quick-restock row may carry for a given intent (used to validate a replay). */
export function movementTypesForIntent(intent: QuickRestockIntentValue): readonly string[] {
  switch (intent) {
    case 'PRINTED': return ['PRODUCTION_IN'];
    case 'PURCHASED': return ['PURCHASE'];
    case 'DAMAGED': return ['DAMAGE_OUT'];
    case 'COUNTED': return ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'];
  }
}

export const QUICK_RESTOCK_INTENT_LABELS: Record<QuickRestockIntentValue, { title: string; hint: string }> = {
  PRINTED: { title: 'In xong nhập kho', hint: 'Món in đạt, đưa lên kệ.' },
  PURCHASED: { title: 'Nhập hàng ngoài', hint: 'Mua thành phẩm từ nơi khác.' },
  COUNTED: { title: 'Kiểm kê thực tế', hint: 'Gõ số đếm được trên kệ, hệ thống tự tính chênh lệch.' },
  DAMAGED: { title: 'Hàng trong kho bị hỏng', hint: 'Món đã ở trên kệ bị vỡ/lỗi. Lỗi khi đang in không ghi ở đây.' },
};
