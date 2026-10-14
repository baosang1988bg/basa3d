'use client';

import { useState, type ComponentProps } from 'react';
import { MakerWorldQuotePanel } from '@/components/admin/makerworld-quote-panel';
import { PricingCalculatorPanel } from '@/components/admin/pricing-calculator-panel';

type QuoteTool = 'MAKERWORLD' | 'CALCULATOR' | 'MANUAL';

const TOOL_LABELS: Record<QuoteTool, string> = {
  MAKERWORLD: 'Từ link MakerWorld',
  CALCULATOR: 'Công cụ tính giá (.3mf / nhập tay)',
  MANUAL: 'Tự nhập giá',
};

/**
 * B7: MakerWorldQuotePanel and PricingCalculatorPanel both render hidden `pricingBreakdown` /
 * `pricingConfigId` inputs into the SAME createQuote <form>. Rendering both meant FormData.get()
 * silently picked whichever came first. Exactly one tool is mounted at a time; switching tools
 * unmounts the other (dropping its hidden inputs) and clears the price inputs so a price computed by
 * one tool is never submitted alongside the other tool's snapshot.
 */
export type InitialMakerWorldData = {
  url: string;
  tier: 'ASSEMBLED' | 'KIT';
  specText?: string | null;
  profileTitle?: string | null;
  estimatedPriceVnd?: number | null;
  estimateSource?: 'VERIFIED' | 'AUTO' | 'SPEC' | 'NONE';
  modelTitle?: string | null;
};

export function QuoteToolSwitcher({
  materials,
  config,
  priceInputIds,
  initialMakerWorld = null,
}: {
  initialMakerWorld?: InitialMakerWorldData | null;
  materials: ComponentProps<typeof MakerWorldQuotePanel>['materials'] & ComponentProps<typeof PricingCalculatorPanel>['materials'];
  config: ComponentProps<typeof MakerWorldQuotePanel>['config'] & ComponentProps<typeof PricingCalculatorPanel>['config'];
  priceInputIds: string[];
}) {
  const [tool, setTool] = useState<QuoteTool>('MAKERWORLD');

  function switchTool(next: QuoteTool) {
    if (next === tool) return;
    for (const id of priceInputIds) {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    setTool(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Công cụ báo giá" className="flex flex-wrap gap-2">
        {(Object.keys(TOOL_LABELS) as QuoteTool[]).map((key) => (
          <label
            key={key}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${tool === key ? 'border-primary bg-primary/10 font-medium' : 'border-border'}`}
          >
            <input type="radio" name="__quoteTool" value={key} checked={tool === key} onChange={() => switchTool(key)} className="size-4" />
            {TOOL_LABELS[key]}
          </label>
        ))}
      </div>
      {tool === 'MAKERWORLD' ? (
        <MakerWorldQuotePanel
          materials={materials}
          config={config}
          priceInputIds={priceInputIds}
          initialUrl={initialMakerWorld?.url}
          initialTier={initialMakerWorld?.tier ?? null}
          initialSpecText={initialMakerWorld?.specText ?? null}
          initialProfileTitle={initialMakerWorld?.profileTitle ?? null}
          initialEstimatedPriceVnd={initialMakerWorld?.estimatedPriceVnd ?? null}
          initialEstimateSource={initialMakerWorld?.estimateSource ?? null}
          initialModelTitle={initialMakerWorld?.modelTitle ?? null}
        />
      ) : null}
      {tool === 'CALCULATOR' ? <PricingCalculatorPanel materials={materials} config={config} priceInputIds={priceInputIds} /> : null}
    </div>
  );
}
