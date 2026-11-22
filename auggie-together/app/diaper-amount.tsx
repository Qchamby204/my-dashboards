'use client';
import type {SoiledSize} from '@/lib/care';
export default function DiaperAmount({value,onChange,quick=false,disabled=false,label='Soiled amount'}:{value?:SoiledSize|null;onChange:(size:SoiledSize)=>void;quick?:boolean;disabled?:boolean;label?:string}){
 return <fieldset className="soiled-amount"><legend>{label}{quick&&<span>Tap to save</span>}</legend><div className="choice-row">{(['small','medium','large'] as const).map(size=><button type="button" key={size} className={value===size?'selected':''} aria-pressed={value===size} disabled={disabled} onClick={()=>onChange(size)}>{size[0].toUpperCase()+size.slice(1)}</button>)}</div></fieldset>;
}
