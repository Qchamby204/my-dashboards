import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyAppState,contentFromApp,connectedState} from '../connected-model.mjs';
const video=()=>({id:'one',title:'A story',script:'A script',fmt:'long',status:'draft',vert:'General'});
const raw=(...videos)=>({...emptyAppState('herald'),videos});
test('planned and actual publication dates round trip independently, including explicit unknown dates',async()=>{
  const first=await contentFromApp(raw({...video(),status:'published',sched:'2026-09-12',publishedDay:'2026-09-02'}),null,'2026-09-07');
  assert.equal(first.items[0].published_day,'2026-09-02');assert.equal(first.items[0].scheduled_day,'2026-09-12');
  const full=connectedState('herald',{herald:[first]},null);assert.equal(full.videos[0].publishedDay,'2026-09-02');
  full.videos[0].script='Retained after publishing';const second=await contentFromApp(full,first,'2026-09-07');assert.equal(second.items[0].published_day,'2026-09-02');
  full.videos[0].publishedDay='';assert.equal((await contentFromApp(full,second,'2026-09-07')).items[0].published_day,null);
  assert.equal((await contentFromApp(raw({...video(),status:'published'}),null,null)).items[0].published_day,null);
});
