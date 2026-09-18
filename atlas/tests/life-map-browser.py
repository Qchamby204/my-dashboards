"""Interaction tests for the assembled Life Map. Run against local HTTP in CI.
An offline, in-memory harness is available for network-restricted workstations.
Neither mode uses real user records. Playwright is a test-only dependency.
"""
import datetime as dt
import json
import os
from pathlib import Path
import re
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
TODAY = '2026-09-17'
OFFLINE = os.getenv('LM_OFFLINE_BROWSER') == '1'
BROWSER = os.getenv('LM_BROWSER', 'chromium')
BASE = os.getenv('LM_BASE_URL', 'http://127.0.0.1:8765').rstrip('/')


def task(id, **extra):
    return {**dict(id=id, task='Task ' + id, status='Not started', area='Home', pri='Med', due='', notes=''), **extra}


def board(tasks=None, chores=None, **extra):
    return dict(projects=tasks or [], chores=chores or [], checks={}, planned={}, log=[], **extra)


def inline_page():
    html = (ROOT / 'life-map.html').read_text()
    def css(m):
        file = ROOT / m[1].split('?')[0]
        return '<style>' + file.read_text() + '</style>' if file.is_file() else ''
    html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="([^" ]+)"[^>]*>', css, html)
    def script(m):
        file = ROOT / m[2].split('?')[0]
        if 'type="module"' in m[1] or not file.is_file():
            return ''
        return '<script>' + file.read_text().replace('</script', '<\\/script') + '</script>'
    html = re.sub(r'<script\s+([^>]*?)src="([^"]+)"[^>]*></script>', script, html)
    return re.sub(r'<link[^>]*href="https?://[^>]+>', '', html)


class LifeMapBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        opts = {'headless': True}
        if OFFLINE:
            opts.update(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        cls.browser = getattr(cls.pw, BROWSER).launch(**opts)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.ctx = self.browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, timezone_id='America/Winnipeg')
        self.errors = []
        self.new_page()

    def new_page(self):
        self.page = self.ctx.new_page()
        self.page.set_default_timeout(5000)
        self.page.clock.set_fixed_time(dt.datetime(2026, 9, 17, 18, tzinfo=dt.timezone.utc))
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())

    def tearDown(self):
        if self.errors:
            print('Browser errors:', self.errors)
        self.ctx.close()

    def load(self, value=None, storage=None):
        if getattr(self, '_loaded', False):
            self.page.close()
            self.new_page()
        self._loaded = True
        seeds = storage if storage is not None else ({} if value is None else {'lifemap_v1': json.dumps(value)})
        if OFFLINE:
            init = '''window.__store=new Map(Object.entries(SEEDS));
            Object.defineProperty(window,'localStorage',{value:{
              getItem:k=>__store.get(k)??null,setItem:(k,v)=>{if(window.__failWrites&&k==='lifemap_v1')throw Error('quota');__store.set(k,String(v));},removeItem:k=>__store.delete(k)}});
            window.__events=[];window.AtlasActivity={meaningful:(type,summary)=>__events.push({type,summary}),log:(type,summary)=>__events.push({type,summary})};'''.replace('SEEDS', json.dumps(seeds))
            html = inline_page().replace('<head>', '<head><script>' + init + '</script>', 1)
            self.page.set_content(html, wait_until='domcontentloaded')
        else:
            self.page.add_init_script('''(() => {
              const seed=SEEDS;for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value);
              const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__failWrites&&k==='lifemap_v1')throw Error('quota');return set.call(this,k,v);};
            })();'''.replace('SEEDS', json.dumps(seeds)))
            self.page.goto(BASE + '/life-map.html', wait_until='networkidle')
        self.page.wait_for_function('!!window.LifeMapWorkflow && !!window.LifeMapLocal')

    def state(self):
        return self.page.evaluate('S')

    def storage(self):
        if OFFLINE:
            return self.page.evaluate('Object.fromEntries(__store)')
        return self.page.evaluate('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))')

    def open_section(self, key):
        toggle = self.page.locator(f'[data-act="section"][data-key="{key}"]')
        if toggle.get_attribute('aria-expanded') != 'true':
            toggle.click()

    def click(self, name):
        self.page.locator('[data-lm="' + name + '"]').first.click()

    def close(self):
        self.page.locator('dialog [data-lm="close"]').click()

    def edit(self, id):
        self.page.evaluate('(id)=>{LifeMapWorkflow.openEditor("proj",S.projects.find(x=>x.id===id));}', id)

    def test_capture_interpretations_multiline_add_another(self):
        self.load()
        self.page.locator('#qaTxt').fill('Email contractor tomorrow')
        self.assertIn('Planned Sep 18', self.page.locator('#lm-quick-hints').inner_text())
        self.click('quick-add')
        p = self.state()['projects'][0]
        self.assertEqual(p['task'], 'Email contractor')
        self.assertEqual(p['plan'], '2026-09-18')
        self.assertEqual(p['due'], '')
        self.page.locator('#lm-capture-launch').click()
        self.page.locator('#lm-capture-text').fill('Review quote\nBook appointment due October 30')
        self.assertEqual(self.page.locator('#lm-capture-preview li').count(), 2)
        self.click('add-another')
        self.assertEqual(len(self.state()['projects']), 3)
        self.assertEqual(self.page.locator('#lm-capture-text').input_value(), '')
        self.page.locator('#lm-capture-text').fill('Prepare packet')
        self.page.locator('[data-lm="capture-when"][data-when="wk"]').click()
        self.click('save-capture')
        self.assertEqual(self.state()['projects'][-1]['planWeek'], '2026-09-14')
        self.assertEqual(self.state()['projects'][-1]['due'], '')
        self.assertFalse(self.errors)

    def test_single_tap_complete_and_undo(self):
        self.load(board([task('one')]))
        self.page.locator('[data-lm="complete"][data-id="one"]').first.click()
        self.assertEqual(self.state()['projects'][0]['status'], 'Done')
        self.assertEqual(len(self.state()['log']), 1)
        self.page.locator('#undoToast button').click()
        self.assertEqual(self.state()['projects'][0]['status'], 'Not started')
        self.assertEqual(len(self.state()['log']), 0)
        self.assertFalse(self.errors)

    def test_project_children_checklist_and_waiting(self):
        self.load()
        self.open_section('proj')
        self.click('new-group')
        self.page.locator('[data-field="title"]').fill('Office refresh')
        self.page.locator('[data-field="area"]').select_option('House — Interior')
        self.click('save-editor')
        self.assertEqual(self.state()['groups'][0]['title'], 'Office refresh')
        self.page.locator('[data-lm="new-task"][data-group]').first.click()
        self.page.locator('[data-field="task"]').fill('Request dimensions')
        self.page.locator('[data-field="status"]').select_option('Waiting')
        self.page.locator('[data-field="waitingFor"]').fill('Contractor')
        self.page.locator('[data-field="followUp"]').fill(TODAY)
        self.page.get_by_text('Notes, checklist & links', exact=True).click()
        self.click('add-check')
        self.page.locator('[data-lm="check-text"]').fill('Specify finish')
        self.page.locator('[data-field="linksText"]').fill('https://example.com/quote')
        self.click('save-editor')
        p = self.state()['projects'][0]
        self.assertEqual(p['status'], 'Waiting')
        self.assertEqual(p['parentId'], self.state()['groups'][0]['id'])
        self.assertEqual(p['checklist'][0]['text'], 'Specify finish')
        self.assertIn('Follow-ups', self.page.locator('.lm-today').inner_text())
        self.assertNotIn('Request dimensions', self.page.locator('.lm-next').inner_text())
        self.assertFalse(self.errors)

    def test_drafts_survive_capture_while_an_editor_is_unfinished(self):
        self.load(board([task('one')]))
        self.edit('one')
        self.page.locator('[data-field="task"]').fill('Edited but not saved')
        self.close()
        self.page.locator('#lm-capture-launch').click()
        self.page.locator('#lm-capture-text').fill('Another thought')
        self.close()
        saved = self.storage()
        self.load(storage=saved)
        self.assertEqual(self.page.locator('#qaTxt').input_value(), 'Another thought')
        self.click('resume-edit')
        self.assertEqual(self.page.locator('[data-field="task"]').input_value(), 'Edited but not saved')
        self.assertEqual(self.state()['projects'][0]['task'], 'Task one')
        self.assertFalse(self.errors)

    def test_failed_save_keeps_capture_and_retry_does_not_duplicate(self):
        self.load(board([task('old')]))
        before = self.storage()['lifemap_v1']
        self.page.locator('#qaTxt').fill('Do not lose this thought')
        self.page.evaluate('window.__failWrites=true')
        self.click('quick-add')
        self.assertEqual(len(self.state()['projects']), 1)
        self.assertEqual(self.page.locator('#qaTxt').input_value(), 'Do not lose this thought')
        self.assertEqual(self.storage()['lifemap_v1'], before)
        self.assertIn('could not be saved', self.page.locator('#lm-save-state').inner_text())
        self.page.evaluate('window.__failWrites=false')
        self.click('retry')
        self.assertEqual(len(self.state()['projects']), 2)
        self.assertEqual(self.page.locator('#qaTxt').input_value(), '')
        self.assertFalse(self.errors)

    def test_other_tab_conflict_never_overwrites_newer_records(self):
        self.load(board([task('old')]))
        newer = board([task('newer')])
        self.page.evaluate('(text)=>localStorage.setItem("lifemap_v1",text)', json.dumps(newer))
        self.page.locator('#qaTxt').fill('This tab draft')
        self.click('quick-add')
        self.assertEqual(json.loads(self.storage()['lifemap_v1'])['projects'][0]['id'], 'newer')
        self.assertIn('another tab', self.page.locator('#lm-save-state').inner_text())
        self.assertEqual(self.page.locator('#qaTxt').input_value(), 'This tab draft')
        self.assertFalse(self.errors)

    def test_fixed_recurrence_skip_reschedule_and_history(self):
        c = dict(id='weekly',chore='Weekly review',cad='Weekly',repeat={'mode':'fixed','unit':'week','every':1,'anchor':'2026-09-13'},nextDue='2026-09-13')
        self.load(board(chores=[c]))
        self.page.locator('[data-lm="chore-complete"][data-id="weekly"]').first.click()
        self.assertEqual(self.state()['chores'][0]['nextDue'], '2026-09-20')
        self.assertEqual(self.state()['choreHistory'][0]['status'], 'done')
        self.page.locator('#undoToast button').click()
        self.page.locator('[data-lm="chore-menu"][data-id="weekly"]').first.click()
        self.click('skip-chore')
        self.assertEqual(self.state()['choreHistory'][0]['status'], 'skipped')
        self.assertEqual(self.page.evaluate('stats().choreDone'), 0)
        self.open_section('chores')
        self.assertIn('Skipped', self.page.locator('.lm-history').text_content())
        self.assertFalse(self.errors)

    def test_create_after_completion_chore(self):
        self.load()
        self.open_section('chores')
        self.click('new-chore')
        self.page.locator('[data-field="chore"]').fill('Maintenance check')
        self.page.locator('[data-field="repeatMode"]').select_option('after')
        self.page.locator('[data-field="repeatEvery"]').fill('3')
        self.page.locator('[data-field="repeatUnit"]').select_option('month')
        self.page.locator('[data-field="repeatAnchor"]').fill(TODAY)
        self.click('save-editor')
        self.assertEqual(self.state()['chores'][0]['repeat']['every'], 3)
        self.page.locator('[data-lm="chore-complete"]').first.click()
        self.assertEqual(self.state()['chores'][0]['nextDue'], '2026-12-17')
        self.assertFalse(self.errors)

    def test_bulk_planning_preserves_deadline_and_moves_area(self):
        p1=task('one');p1['due']='2026-10-30'
        self.load(board([p1,task('two')]))
        self.open_section('proj')
        self.click('selection-mode')
        self.click('select-shown')
        self.click('bulk-menu')
        self.page.locator('[data-field="when"]').select_option('tomorrow')
        self.click('apply-bulk')
        self.assertTrue(all(x['plan']=='2026-09-18' for x in self.state()['projects']))
        self.assertEqual(self.state()['projects'][0]['due'], '2026-10-30')
        self.assertFalse(self.errors)

    def test_template_preview_creates_fresh_uncompleted_tasks(self):
        p=task('one',parentId='group');p['status']='Done';p['checklist']=[{'id':'a','text':'Measure','done':True}]
        self.load(board([p],groups=[{'id':'group','title':'Room refresh','area':'Home'}]))
        self.page.evaluate('LifeMapWorkflow.openEditor("group",S.groups[0])')
        self.click('save-template')
        self.open_section('proj')
        self.click('templates')
        self.click('template-preview')
        self.assertEqual(len(self.state()['groups']), 1)
        self.click('use-template')
        self.assertEqual(len(self.state()['groups']), 2)
        p=self.state()['projects'][-1]
        self.assertEqual(p['status'],'Not started')
        self.assertFalse(p['checklist'][0]['done'])
        self.assertFalse(self.errors)

    def test_search_and_nested_delete_confirmation(self):
        self.load(board([task('one')],chores=[{'id':'c','chore':'File invoice','cad':'Weekly'}]))
        self.click('search')
        self.page.locator('#lm-search').fill('invoice')
        self.assertIn('File invoice',self.page.locator('#lm-search-results').inner_text())
        self.close()
        self.edit('one')
        self.click('delete-editor')
        self.assertTrue(self.page.locator('#uiDlg').evaluate('(el)=>el.matches(":modal")'))
        self.assertEqual(len(self.state()['projects']),1)
        self.page.locator('#uiDlg').get_by_role('button',name='Delete',exact=True).click()
        self.assertEqual(len(self.state()['projects']),0)
        self.page.locator('#undoToast button').click()
        self.assertEqual(len(self.state()['projects']),1)
        self.assertFalse(self.errors)

    def test_mobile_layout_focus_and_rotation(self):
        self.load(board([task('long',notes='A note')]))
        self.page.locator('#lm-capture-launch').click()
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'lm-capture-text')
        self.page.locator('#lm-capture-text').fill('A long task ' * 20)
        for width,height in [(320,740),(844,390),(390,844)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
            self.assertLessEqual(self.page.locator('.lm-sheet').bounding_box()['width'],width)
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('dialog[open]').count(),0)
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'lm-capture-launch')
        self.page.evaluate('window.scrollTo(0,0)')
        out=ROOT/'artifacts/life-map-tests';out.mkdir(parents=True,exist_ok=True)
        self.page.screenshot(path=str(out/f'{BROWSER}-mobile.png'),full_page=True)
        self.assertFalse(self.errors)

    def test_opening_does_not_seed_or_rewrite_existing_board(self):
        raw=json.dumps(board([task('keep')],legacyData={'keep':'exactly'}),indent=2)
        self.load(storage={'lifemap_v1':raw})
        self.assertEqual(self.storage()['lifemap_v1'],raw)
        self.assertNotIn('lifemap:before-github:v1',self.storage())
        self.assertFalse(self.errors)


if __name__=='__main__':
    unittest.main(verbosity=2)
