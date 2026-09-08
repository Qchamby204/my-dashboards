import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Courier publication rejects false success and retries public delivery without generation',()=>{
  const result=spawnSync('python',['-m','unittest','discover','-s','scripts/courier/tests','-p','test_*.py'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
