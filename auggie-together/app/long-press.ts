'use client';
import {useRef} from 'react';

// Tap runs onTap; press and hold (about half a second) runs onHold instead.
export function useLongPress<T>(onHold:(value:T)=>void,onTap:(value:T)=>void,delay=480){
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const held=useRef(false);
  const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
  return (value:T)=>({
    onPointerDown:(e:React.PointerEvent)=>{if(e.button!==0)return;held.current=false;clear();timer.current=setTimeout(()=>{held.current=true;timer.current=null;navigator.vibrate?.(12);onHold(value);},delay);},
    onPointerUp:clear,onPointerLeave:clear,onPointerCancel:clear,
    onContextMenu:(e:React.MouseEvent)=>{e.preventDefault();},
    onClick:()=>{if(held.current){held.current=false;return;}clear();onTap(value);},
  });
}
