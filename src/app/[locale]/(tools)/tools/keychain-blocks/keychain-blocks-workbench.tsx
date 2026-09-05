'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Font } from 'opentype.js';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import { disposeBlocksScene, generateKeychainBlocksScene, getBlocksExportParts, loadBlocksFont, mergeBlocksGeometry, type BlockFont, type KeychainBlockConfig } from '@/lib/3d-tools/keychain-blocks/keychain-blocks-engine';
import * as C from '@/lib/3d-tools/keychain-blocks/keychain-blocks-constants';
import { exportBlocksStlZip, write3mf } from '@/lib/3d-tools/common/3mf-writer';
import { exportKeychainStl } from '@/lib/keychain/keychain-engine';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { trackKeychainBlocksExportDownload, trackKeychainBlocksExportToRequest, trackKeychainBlocksPreview } from '@/lib/analytics';

const Canvas = dynamic(() => import('./keychain-blocks-canvas'), { ssr: false, loading: () => <p>Đang mở bản xem trước 3D...</p> });
const makeBlock = (char: string, index: number): KeychainBlockConfig => ({ id: `slot-${index+1}`, char, blockColor: C.DEFAULT_BLOCK_COLOR, glyphColor: C.DEFAULT_GLYPH_COLOR });

export default function KeychainBlocksWorkbench() {
  const [name, setName] = useState('BASA');
  const [blocks, setBlocks] = useState(() => Array.from('BASA',makeBlock));
  const [fontName, setFontName] = useState<BlockFont>('Be Vietnam Pro');
  const [font, setFont] = useState<{ name: BlockFont; value: Font } | null>(null);
  const [baseColor, setBaseColor] = useState(C.DEFAULT_BASE_COLOR);
  const [error, setError] = useState(''); const [fontError, setFontError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);
  useEffect(() => {
    let active=true; setFontError('');
    void loadBlocksFont(fontName).then(value=>{if(active)setFont({name:fontName,value});}).catch(reason=>{if(active)setFontError(reason instanceof Error?reason.message:'Không tải được font.');});
    return ()=>{active=false;};
  },[fontName]);
  const result=useMemo(()=>{
    if (!font || font.name!==fontName) return {group:null,error:''};
    try { return {group:generateKeychainBlocksScene(blocks,font.value,baseColor),error:''}; }
    catch(reason) { return {group:null,error:reason instanceof Error?reason.message:'Không thể dựng mẫu.'}; }
  },[blocks,font,fontName,baseColor]);
  const group=result.group;
  useEffect(()=>()=>{if(group)disposeBlocksScene(group);},[group]);
  useEffect(()=>{
    setPrice(null); if(!group)return;
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      trackKeychainBlocksPreview({blockCount:blocks.length});
      const parts=getBlocksExportParts(group);
      const volume=parts.reduce((sum,p)=>sum+calculateMeshVolumeCm3(p.geometry),0); parts.forEach(p=>p.geometry.dispose());
      const weightGrams=estimateMeshWeightGrams(volume);
      try {
        const response=await fetch('/api/public/tool-price-estimate',{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({weightGrams,printMinutes:estimatePrintMinutes(weightGrams)})});
        const value=response.ok?await response.json():null; if(!controller.signal.aborted)setPrice(value);
      } catch { /* Advisory pricing does not prevent export. */ }
    },500);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  },[group,blocks.length]);
  function changeName(value: string) {
    const chars=Array.from(value.normalize('NFC').toUpperCase()).slice(0,C.MAX_BLOCKS);
    setName(chars.join('')); setBlocks(previous=>chars.map((char,i)=>({...previous[i]??makeBlock(char,i),char}))); setError('');
  }
  function changeBlock(index: number, patch: Partial<KeychainBlockConfig>) { setBlocks(previous=>previous.map((block,i)=>i===index?{...block,...patch}:block)); }
  function download(format: 'stl-zip'|'3mf') {
    if(!group)return; const parts=getBlocksExportParts(group);
    try {
      const bytes=format==='3mf'?write3mf(parts):exportBlocksStlZip(parts);
      const blob=new Blob([new Uint8Array(bytes)],{type:format==='3mf'?'model/3mf':'application/zip'});
      const url=URL.createObjectURL(blob),anchor=document.createElement('a'); anchor.href=url;anchor.download=`moc-khoa-khoi.${format==='3mf'?'3mf':'zip'}`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      trackKeychainBlocksExportDownload({blockCount:blocks.length,format}); setError('');
    } catch(reason) {setError(reason instanceof Error?reason.message:'Không thể xuất file.');}
    finally {parts.forEach(p=>p.geometry.dispose());}
  }
  async function sendRequest() {
    if(!group)return;setUploading(true);setError('');
    const parts=getBlocksExportParts(group);
    try {
      // A single assembled STL is accepted by the existing upload endpoint and works before
      // slicer color verification. The description retains every requested color.
      const geometry=mergeBlocksGeometry(parts);
      let blob: Blob; try {blob=exportKeychainStl(geometry);} finally {geometry.dispose();}
      const fileName='moc-khoa-khoi.stl'; const body=new FormData();body.set('file',blob,fileName);
      const response=await fetch('/api/public/custom-requests/attachments',{method:'POST',body});
      if(!response.ok)throw new Error((await response.json().catch(()=>null))?.message??'Không thể tải STL lên.');
      const {path}=await response.json() as {path:string};
      setPrefill({attachmentPath:path,attachmentFileName:fileName,requestedMaterial:'PLA',requestedColor:'Đa màu',description:`Móc khoá khối Compact: ${blocks.map(b=>b.char).join(' ')}; font ${fontName}; màu đế ${baseColor}; ${blocks.map((b,i)=>`khối ${i+1}: ${b.char}, nền ${b.blockColor}, chữ ${b.glyphColor}`).join('; ')}`});
      trackKeychainBlocksExportToRequest({blockCount:blocks.length,format:'stl'});
    } catch(reason) {setError(reason instanceof Error?reason.message:'Không thể chuẩn bị yêu cầu.');}
    finally {parts.forEach(p=>p.geometry.dispose());setUploading(false);}
  }
  useEffect(()=>{if(prefill)document.getElementById('keychain-blocks-request-form')?.scrollIntoView({behavior:'smooth'});},[prefill]);
  return <>
    <div className="grid lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="h-[50dvh] min-h-[360px] bg-slate-100 lg:h-full lg:min-h-0">{group?<Canvas group={group}/>:<p className="p-6">{fontError||result.error?'Điều chỉnh nội dung để xem mẫu.':'Đang tải font...'}</p>}</div>
      <aside className="space-y-4 border-l p-5 lg:overflow-y-auto">
        <h1 className="text-2xl font-bold">Flex Keychain</h1><p className="text-sm">Móc khoá khối chữ nổi, liền đế Compact. Tối đa {C.MAX_BLOCKS} khối.</p>
        <fieldset disabled={uploading} className="space-y-3">
          <label className="block text-sm">Tên trên móc khoá<input className="mt-1 h-10 w-full rounded border bg-background px-2" value={name} onChange={e=>changeName(e.target.value)}/></label>
          <label className="block text-sm">Font chữ<select className="mt-1 h-10 w-full rounded border bg-background px-2" value={fontName} onChange={e=>setFontName(e.target.value as BlockFont)}>{Object.keys(C.FONTS).map(f=><option key={f}>{f}</option>)}</select></label>
          <label className="flex items-center justify-between text-sm">Màu đế chung<input type="color" value={baseColor} onChange={e=>setBaseColor(e.target.value)}/></label>
          <div className="space-y-3">{blocks.map((block,i)=><fieldset key={block.id} className="space-y-2 rounded border p-3"><legend>Khối {i+1}</legend>
            <label className="block text-sm">Ký tự khối {i+1}<input className="ml-2 w-16 rounded border bg-background px-2" value={block.char.startsWith('icon:')?'':block.char} onChange={e=>changeBlock(i,{char:e.target.value.normalize('NFC')})}/></label>
            <label className="block text-sm">Icon khối {i+1}<select className="ml-2 rounded border bg-background" value={block.char.startsWith('icon:')?block.char:''} onChange={e=>changeBlock(i,{char:e.target.value||Array.from(name)[i]||'A'})}><option value="">Chữ</option>{Object.keys(C.ICON_PATHS).map(id=><option key={id} value={`icon:${id}`}>{id}</option>)}</select></label>
            <label className="flex justify-between text-sm">Màu nền khối {i+1}<input type="color" value={block.blockColor} onChange={e=>changeBlock(i,{blockColor:e.target.value})}/></label>
            <label className="flex justify-between text-sm">Màu chữ khối {i+1}<input type="color" value={block.glyphColor} onChange={e=>changeBlock(i,{glyphColor:e.target.value})}/></label>
          </fieldset>)}</div>
        </fieldset>
        {error||fontError||result.error?<p role="alert" className="text-sm text-destructive">{error||fontError||result.error}</p>:null}
        {price?<p>Ước tính: {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / chiếc</p>:<p className="text-sm">Chưa có giá ước tính.</p>}
        <p className="text-xs text-muted-foreground">Giá tham khảo cho PLA. Xưởng sẽ gửi báo giá chính xác sau khi kiểm tra mẫu.</p>
        <div id="tool-quote" className="grid gap-2"><StorefrontButton disabled={!group||uploading} onClick={()=>download('stl-zip')}>Tải STL Zip</StorefrontButton><StorefrontButton disabled={!group||uploading} onClick={()=>download('3mf')}>Tải Bambu 3MF (Màu)</StorefrontButton><StorefrontButton disabled={!group||uploading} onClick={()=>void sendRequest()}>{uploading?'Đang chuẩn bị file...':'Gửi yêu cầu báo giá'}</StorefrontButton></div>
      </aside>
    </div>
    {prefill?<section id="keychain-blocks-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill}/></section>:null}
  </>;
}
