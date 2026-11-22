import {useState} from 'react';
import {Feather, Pencil, Plus} from 'lucide-react';
import {clock, dayKey, prettyDay, type CareEvent} from '@/lib/care';
import {headLabels,headMovements,type TummyObservation} from '@/lib/tummy-observations';
import {tummyPositions} from '@/lib/movement';

export default function PlayJournal({entries,ready,disabled,onAdd,onEdit}:{entries:CareEvent[];ready:boolean;disabled:boolean;onAdd:(observation?:TummyObservation)=>void;onEdit:(entry:CareEvent)=>void}){
  const [selection,setSelection]=useState('');
  const entry=entries.find(e=>e.id===selection)??entries[0];
  const observation=entry?.tummyObservation;
  const position=tummyPositions.find(p=>p.id===entry?.subtype);
  return <section className="field-note">
    <header><Feather size={22}/><h2>Tummy time observations</h2></header>
    <div className="observation-palette" role="group" aria-label="Start an observation">
      {headMovements.map(key=><button key={key} disabled={disabled} onClick={()=>onAdd(key)} aria-label={'Log: '+headLabels[key]}>
        <img src={'/pose-'+key+'.webp'} alt=""/><span>{{rested:'Rested',turned:'Turned',lifted:'Lifted briefly',held:'Held up'}[key]}</span>
      </button>)}
    </div><button className="note-edit" disabled={disabled} onClick={()=>onAdd()}><Plus size={16}/>Log a session without a head observation</button>
    {entry?<div className="note-reading" key={entry.id}>
      <time>{prettyDay(dayKey(entry.startedAt),true)} · {clock(entry.startedAt)}</time>
      <h3>{observation&&observation!=='session'?headLabels[observation]:'Session logged'}</h3>
      <p>{[position?.label,entry.tummyComfort==='comfortable'?'Comfortable':entry.tummyComfort==='break'?'Needed a break':null,entry.actor].filter(Boolean).join(' · ')}</p>
      {entry.notes&&<blockquote>{entry.notes}</blockquote>}
      <button className="note-edit" disabled={disabled} onClick={()=>onEdit(entry)}><Pencil size={15}/>Edit observation</button>
    </div>:<p>{ready?'After play, record what you noticed.':'Loading observations…'}</p>}
    {entries.length>1&&<div className="journal-choices" aria-label="Recent observations">{entries.map(e=><button key={e.id} aria-pressed={entry.id===e.id} onClick={()=>setSelection(e.id)}>{prettyDay(dayKey(e.startedAt),true)} · {clock(e.startedAt)}</button>)}</div>}
  </section>;
}
