'use client';

import {useLayoutEffect,useRef} from 'react';

export function useCareDialog(open=true){
 const ref=useRef<HTMLDialogElement>(null);

 useLayoutEffect(()=>{
  const dialog=ref.current;
  if(!open||!dialog)return;

  const {body,documentElement}=document;
  const scrollTop=window.scrollY;
  const scrollbarWidth=window.innerWidth-documentElement.clientWidth;

  // Keep the page in place while the native dialog moves focus.
  body.style.setProperty('--care-dialog-page-top',`-${scrollTop}px`);
  body.style.setProperty('--care-dialog-scrollbar',`${scrollbarWidth}px`);
  body.classList.add('care-dialog-open');
  window.scrollTo({top:0,behavior:'instant'});

  const focusTarget=dialog.querySelector('[data-dialog-autofocus]')??dialog.querySelector('[data-dialog-heading]');
  focusTarget?.setAttribute('autofocus','');
  dialog.showModal();

  return ()=>{
   dialog.close();
   focusTarget?.removeAttribute('autofocus');
   body.classList.remove('care-dialog-open');
   body.style.removeProperty('--care-dialog-page-top');
   body.style.removeProperty('--care-dialog-scrollbar');
   window.scrollTo({top:scrollTop,behavior:'instant'});
  };
 },[open]);

 return ref;
}
