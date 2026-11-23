'use client';

import {useEffect,useState} from 'react';
import {useCareDialog} from './use-care-dialog';
import {Monitor,Moon,Smartphone,Sun,Volume2,VolumeX,Waves,X} from 'lucide-react';
import {prefKeys,usePref,writePref,playDrop} from './wonder';

type Appearance='light'|'dark'|'system';
const preferenceKey='atlas.appearance.v1';
const modes=[
 {id:'light',label:'Light',detail:'Warm stone and gold',icon:Sun},
 {id:'dark',label:'Dark',detail:'Deep violet and soft gold',icon:Moon},
 {id:'system',label:'System',detail:'Follow this device',icon:Monitor},
] as const;
function valid(value:string|null):value is Appearance {
 return value==='light'||value==='dark'||value==='system';
}

export default function AppearanceControl(){
 const [open,setOpen]=useState(false);
 const dialog=useCareDialog(open);
 const [preference,setPreference]=useState<Appearance>('system');
 const sound=usePref(prefKeys.sound,'off');
 const tilt=usePref(prefKeys.tilt,'sway');
 useEffect(()=>{
  const root=document.documentElement;
  const initial=root.dataset.atlasAppearance;
  if(valid(initial??null))setPreference(initial as Appearance);
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const apply=(value:Appearance)=>{
   root.dataset.atlasAppearance=value;
   const resolved=value==='system'?(media.matches?'dark':'light'):value;
   root.dataset.atlasTheme=resolved;
   document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta=>{
    meta.content=resolved==='dark'?'#1c1a2b':'#efeae3';
   });
  };
  apply(valid(initial??null)?initial as Appearance:'system');
  const onSystem=()=>{
   const current=root.dataset.atlasAppearance;
   if(current==='system'||!current)apply('system');
  };
  const onStorage=(event:StorageEvent)=>{
   if(event.key!==preferenceKey&&event.key!==null)return;
   const next=valid(event.newValue)?event.newValue:'system';
   setPreference(next);
   apply(next);
  };
  media.addEventListener('change',onSystem);
  window.addEventListener('storage',onStorage);
  return()=>{media.removeEventListener('change',onSystem);window.removeEventListener('storage',onStorage);};
 },[]);
 function choose(value:Appearance){
  setPreference(value);
  try{localStorage.setItem(preferenceKey,value);}catch{/* Keep this choice for the open page. */}
  const resolved=value==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value;
  document.documentElement.dataset.atlasAppearance=value;
  document.documentElement.dataset.atlasTheme=resolved;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta=>{meta.content=resolved==='dark'?'#1c1a2b':'#efeae3';});
 }
 return <>
  <button type="button" className="icon-button appearance-trigger" aria-label="Appearance" aria-haspopup="dialog" onClick={()=>setOpen(true)}><Sun size={19}/></button>
  <dialog ref={dialog} className="appearance-dialog" aria-labelledby="appearance-title" onCancel={event=>{event.preventDefault();setOpen(false);}}>
   <div className="appearance-heading"><h2 id="appearance-title" data-dialog-heading tabIndex={-1}>Appearance</h2><button className="icon-button" aria-label="Close appearance" type="button" onClick={()=>setOpen(false)}><X size={20}/></button></div>
   <fieldset><legend>Colour theme</legend>{modes.map(mode=><label key={mode.id}><input type="radio" name="appearance" value={mode.id} checked={preference===mode.id} onChange={()=>choose(mode.id)}/><mode.icon size={22}/><span><strong>{mode.label}</strong><small>{mode.detail}</small></span></label>)}</fieldset>
   <fieldset><legend>Milk glass motion</legend>{([['sway','Gentle sway','Moves on its own, no permission needed',Waves],['phone','Tilt with my phone','iPhone asks for motion access on each visit',Smartphone]] as const).map(([id,label,detail,Icon])=><label key={id}><input type="radio" name="tilt" value={id} checked={tilt===id} onChange={()=>{writePref(prefKeys.tilt,id);if(id==='phone'){const gate=(window.DeviceOrientationEvent as unknown as {requestPermission?:()=>Promise<string>}|undefined)?.requestPermission;gate?.().catch(()=>{});}}}/><Icon size={22}/><span><strong>{label}</strong><small>{detail}</small></span></label>)}</fieldset>
   <fieldset><legend>Sound</legend>{([['off','Silent','No sound when you save',VolumeX],['on','Water drop','A soft drop when an entry saves',Volume2]] as const).map(([id,label,detail,Icon])=><label key={id}><input type="radio" name="sound" value={id} checked={sound===id} onChange={()=>{writePref(prefKeys.sound,id);if(id==='on')playDrop();}}/><Icon size={22}/><span><strong>{label}</strong><small>{detail}</small></span></label>)}</fieldset>
  </dialog>
 </>;
}
