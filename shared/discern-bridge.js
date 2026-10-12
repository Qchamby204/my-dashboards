/* Explicit, local-only exchange between Life Ledger and the native Discern app. */
(() => {
  'use strict';
  const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const minutes=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1440;
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const safe=p=>{if(!plain(p)||Object.keys(p).some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('Choose a valid Discern exchange.');};
  function timestamp(p,now){
    if(!validDate(p.date)||p.date>dateKey(new Date(now))||typeof p.generatedAt!=='number'||!Number.isFinite(p.generatedAt)||p.generatedAt>now+300000||dateKey(new Date(p.generatedAt))!==p.date)throw Error('The exchange date or timestamp is invalid.');
  }
  function validateAllowance(p,{now=Date.now()}={}){
    safe(p);timestamp(p,now);
    if(p.app!=='life-ledger'||p.kind!=='discern-allowance'||p.version!==1||!uuid(p.id)||p.date!==dateKey(new Date(now))||!Number.isInteger(p.allowanceMinutes)||p.allowanceMinutes<0||p.allowanceMinutes>60||!minutes(p.otherDeviceMinutes)||p.recordedTotalMinutes!==null&&!minutes(p.recordedTotalMinutes))throw Error('Use a valid allowance generated today.');
    return {app:p.app,kind:p.kind,version:1,id:p.id,date:p.date,generatedAt:p.generatedAt,allowanceMinutes:p.allowanceMinutes,otherDeviceMinutes:p.otherDeviceMinutes,recordedTotalMinutes:p.recordedTotalMinutes};
  }
  function makeAllowance({date,allowanceMinutes=60,otherDeviceMinutes=0,recordedTotalMinutes=null},{now=Date.now(),id=globalThis.crypto?.randomUUID?.()}={}){
    if(!uuid(id))throw Error('This browser cannot generate a transfer ID. Open Life Ledger in an updated browser.');
    return validateAllowance({app:'life-ledger',kind:'discern-allowance',version:1,id,date,generatedAt:now,allowanceMinutes,otherDeviceMinutes,recordedTotalMinutes},{now});
  }
  function validateUsage(p,{now=Date.now()}={}){
    safe(p);timestamp(p,now);
    if(p.app!=='discern'||p.kind!=='discern-usage'||p.version!==1||!uuid(p.id)||p.source!=='user-confirmed-native-report'||![p.phoneMinutes,p.otherDeviceMinutes,p.totalMinutes].every(minutes)||Math.abs(p.totalMinutes-p.phoneMinutes-p.otherDeviceMinutes)>0.001||!Number.isInteger(p.observedThresholdLowerBound)||p.observedThresholdLowerBound<0||p.observedThresholdLowerBound>p.phoneMinutes||typeof p.emergencyReleased!=='boolean')throw Error('Use a confirmed Discern report with valid phone and other-device minutes.');
    return {app:p.app,kind:p.kind,version:1,id:p.id,date:p.date,generatedAt:p.generatedAt,phoneMinutes:p.phoneMinutes,otherDeviceMinutes:p.otherDeviceMinutes,totalMinutes:p.totalMinutes,source:p.source,observedThresholdLowerBound:p.observedThresholdLowerBound,emergencyReleased:p.emergencyReleased};
  }
  function parseUsage(text,options){if(typeof text!=='string'||new TextEncoder().encode(text).length>8192)throw Error('Choose a Discern report smaller than 8 KB.');return validateUsage(JSON.parse(text),options);}
  function allowanceURL(p,options){return 'discern://ledger?payload='+encodeURIComponent(JSON.stringify(validateAllowance(p,options)));}
  function effectivePhoneBudget(p,options){p=validateAllowance(p,options);return Math.max(0,Math.min(59,p.allowanceMinutes)-Math.ceil(p.otherDeviceMinutes));}
  globalThis.DiscernBridge=Object.freeze({dateKey,validDate,makeAllowance,validateAllowance,validateUsage,parseUsage,allowanceURL,effectivePhoneBudget});
})();
