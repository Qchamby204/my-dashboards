// Browser-local records. The original store and a first-change backup stay private.
export function createLifeMapLocalStore(storage,validate){
  const key='lifemap_v1',backup='lifemap:before-github:v1';
  let expected,raw=null,blocked=false,error='',saved=false;
  function load(){
    try{raw=storage.getItem(key);expected=raw;const value=raw===null?{projects:[],chores:[],checks:{},log:[],planned:{}}:JSON.parse(raw);const checked=validate(value);blocked=false;error='';saved=raw!==null;return {...value,...checked};}
    catch{blocked=true;error='Saved records could not be read. Download the recovery copy before restoring a backup.';return {projects:[],chores:[],checks:{},log:[],planned:{}};}
  }
  function save(value,restore=false){
    if(blocked&&!restore)return false;
    try{
      validate(value);const text=JSON.stringify(value),current=storage.getItem(key);
      if(expected===undefined||current!==expected){error='This board changed in another tab. Download your current work before reopening the page.';return false;}
      if(current!==null&&storage.getItem(backup)===null){storage.setItem(backup,current);if(storage.getItem(backup)!==current)throw Error();}
      storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error();
      expected=text;raw=text;blocked=false;error='';saved=true;return true;
    }catch{error='Changes could not be saved in this browser. Retry or download a backup before closing.';return false;}
  }
  return {load,save,get blocked(){return blocked;},get error(){return error;},get raw(){return raw;},get saved(){return saved;}};
}
