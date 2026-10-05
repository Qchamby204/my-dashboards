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

    def load(self, value=None, storage=None, home=False):
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
        self.page.wait_for_function('!!window.LifeMapWorkflow && !!window.LifeMapLocal && !!window.LifeMapDay')
        if not home:
            self.page.evaluate('LifeMapDay.showRecords()')

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



    def test_home_and_category_tabs_preserve_records_and_filter_tasks(self):
        original=board([task('food',area='Food System'),task('work',area='Work — Content')])
        raw=json.dumps(original,indent=2)
        self.load(storage={'lifemap_v1':raw},home=True)
        self.assertTrue(self.page.locator('#lm-day-view-home').is_visible())
        self.assertFalse(self.page.locator('#lm-day-view-board').is_visible())
        self.assertEqual(self.storage()['lifemap_v1'],raw)
        self.page.locator('[data-day="tab"][data-category="food"]').first.click()
        self.assertEqual(self.page.locator('#lm-category-content [data-lm="edit-task"]').count(),1)
        self.assertIn('Task food',self.page.locator('#lm-category-content').inner_text())
        self.page.locator('#lm-category-work').click()
        self.assertIn('Task work',self.page.locator('#lm-category-content').inner_text())
        self.assertNotIn('Task food',self.page.locator('#lm-category-content').inner_text())
        self.page.locator('#lm-day-nav-home').click()
        self.assertEqual(self.storage()['lifemap_v1'],raw)
        self.assertFalse(self.errors)

    def test_dinner_coverage_reminder_skip_extension_and_failure(self):
        self.load(board(),home=True)
        self.page.locator('[data-day="tab"][data-category="food"]').first.click()
        self.page.locator('[data-day-field="food.start"]').fill('2026-09-14')
        self.page.locator('[data-day-field="food.dinners"]').fill('5')
        self.page.locator('[data-day="save-food"]').click()
        self.assertEqual(self.state()['mealCoverage']['dinners'],5)
        self.assertIn('Prep reminder',self.page.locator('.lm-meal-status').inner_text())
        self.assertIn('2 dinners',self.page.locator('.lm-meal-status').inner_text())
        self.page.locator('[data-day="skip-dinner"]').click()
        self.assertIn('2026-09-17',self.state()['mealCoverage']['skipDates'])
        self.assertIn('Sep 19',self.page.locator('.lm-meal-status').inner_text())
        self.page.locator('[data-day-field="extraDinners"]').fill('3')
        self.page.locator('[data-day="add-food"]').click()
        self.assertEqual(self.state()['mealCoverage']['dinners'],8)
        self.assertNotIn('Prep reminder ·',self.page.locator('.lm-meal-status').inner_text())
        with self.page.expect_download() as download:
            self.page.locator('[data-day="meal-reminder"]').click()
        self.assertEqual(download.value.suggested_filename,'life-map-dinner-reminder.ics')
        self.page.evaluate('window.__failWrites=true')
        self.page.locator('[data-day-field="extraDinners"]').fill('2')
        self.page.locator('[data-day="add-food"]').click()
        self.assertEqual(self.state()['mealCoverage']['dinners'],8)
        self.page.evaluate('window.__failWrites=false')
        self.click('retry')
        self.assertEqual(self.state()['mealCoverage']['dinners'],10)
        self.assertFalse(self.errors)

    def test_related_task_scheduling_and_day_board_keep_existing_records(self):
        legacy={'reviewed':True,'blocks':[{'id':'old','title':'Old time block','start':'13:00','minutes':30}]}
        original=board([task('main',task='Business development calls',area='Work — Content',due='2026-10-30'),task('other',task='Client review',area='Work — Content',plan='2026-09-18'),task('today',plan=TODAY)],dayPlans={TODAY:legacy},dayTemplates={'weekday':legacy['blocks']})
        self.load(original,home=True)
        self.assertNotIn('Old time block',self.page.locator('.lm-now-card').inner_text())
        self.page.locator('#lm-day-nav-plan').click()
        self.assertEqual(self.page.locator('[data-day="save-block"]').count(),0)
        self.assertNotIn('Repeat your ideal day',self.page.locator('#lm-day-view-plan').inner_text())
        self.page.locator('[data-day-field="date"]').fill('2026-09-18')
        self.page.get_by_text('Work',exact=True).click()
        self.page.locator('[data-day="related-tasks"][data-index="4"]').click()
        self.assertIn('Business development calls',self.page.locator('[aria-label="Related tasks"]').inner_text())
        self.assertNotIn('Client review',self.page.locator('[aria-label="Related tasks"]').inner_text())
        self.page.locator('[data-day="schedule-related"][data-id="main"]').click()
        self.assertTrue(self.page.locator('#lm-day-view-board').is_visible())
        self.assertIn('Business development calls',self.page.locator('[aria-label="Scheduled tasks"]').inner_text())
        self.assertIn('Client review',self.page.locator('[aria-label="Scheduled tasks"]').inner_text())
        self.assertNotIn('Task today',self.page.locator('[aria-label="Scheduled tasks"]').inner_text())
        main=next(t for t in self.state()['projects'] if t['id']=='main')
        self.assertEqual(main['plan'],'2026-09-18')
        self.assertEqual(main['due'],'2026-10-30')
        self.assertEqual(self.state()['dayPlans'][TODAY]['blocks'],legacy['blocks'])
        self.assertEqual(self.state()['dayTemplates']['weekday'],legacy['blocks'])
        self.page.locator('[data-day="plan-today"]').click()
        self.page.locator('[data-day="focus"][data-id="today"]').last.click()
        self.assertIn('Task today',self.page.locator('.lm-now-card').inner_text())
        self.page.locator('[data-day="view-day-task"][data-id="today"]').click()
        self.assertTrue(self.page.locator('[data-day-row-id="today"]').is_visible())
        self.page.locator('[data-day="complete-task"][data-id="today"]').click()
        self.assertEqual(next(t for t in self.state()['projects'] if t['id']=='today')['status'],'Done')
        self.assertFalse(self.errors)

    def test_life_areas_routines_and_personal_day_starters(self):
        self.load(board(),home=True)
        original=self.storage()['lifemap_v1']
        self.page.locator('#lm-day-nav-areas').click()
        for category in ['household','family','health','work','admin','food']:
            self.page.locator('#lm-category-'+category).click()
            self.assertTrue(self.page.locator('[data-day="area-routine"]').is_visible())
        self.assertEqual(self.storage()['lifemap_v1'],original)
        self.page.locator('#lm-category-health').click()
        self.page.locator('[data-day="area-routine"]').click()
        self.page.locator('[data-field="chore"]').fill('Walk the dog')
        self.click('save-editor')
        self.page.locator('#lm-day-nav-home').click()
        self.assertIn('Walk the dog',self.page.locator('.lm-now-card').inner_text())
        self.page.locator('[data-day="complete-routine"]').click()
        self.assertNotIn('Walk the dog',self.page.locator('.lm-now-card').inner_text())
        self.page.locator('#lm-day-nav-plan').click()
        self.page.get_by_text('Morning',exact=True).click()
        self.page.locator('[data-day="related-tasks"][data-index="2"]').click()
        self.assertFalse(self.state().get('dayPlans'))
        self.page.locator('[data-day="schedule-related"]').click()
        self.assertEqual(self.state()['planned'][self.state()['chores'][0]['id']],TODAY)
        self.assertIn('Walk the dog',self.page.locator('[aria-label="Scheduled routines"]').inner_text())
        self.assertFalse(self.errors)

    def test_spacing_between_copy_actions_headings_and_fields(self):
        self.load(board([task('urgent',due=TODAY)]),home=True)
        out=ROOT/'artifacts/life-map-tests'
        out.mkdir(parents=True,exist_ok=True)
        for theme in ['light','dark']:
            self.page.evaluate('(theme)=>window.AtlasAppearance.set(theme)',theme)
            for width in [320,393]:
                self.page.set_viewport_size({'width':width,'height':852})
                for tab in ['home','plan','areas','board']:
                    self.page.evaluate('(tab)=>window.LifeMapDay.choose(tab,"food")',tab)
                    if tab=='plan':
                        self.page.locator('.lm-block-editor').evaluate_all('els=>els.forEach(el=>el.open=true)')
                    violations=self.page.evaluate('''()=>{
                        const pane=document.querySelector('.lm-day-view:not([hidden])'),errors=[];
                        for(const panel of pane.querySelectorAll('.lm-day-panel')){
                            if(parseFloat(getComputedStyle(panel).paddingLeft)<20)errors.push('tight card padding');
                        }
                        for(const label of pane.querySelectorAll('.lm-foundation .eyebrow')){
                            const css=getComputedStyle(label);
                            if(!/\s/.test(label.textContent.trim())&&label.getBoundingClientRect().height>parseFloat(css.lineHeight)+1)errors.push('broken card label: '+label.textContent);
                        }
                        for(const help of pane.querySelectorAll('.lm-help')){
                            const next=help.nextElementSibling;
                            if(!next||!next.matches('a,button,.lm-inline')||!next.getClientRects().length)continue;
                            const gap=next.getBoundingClientRect().top-help.getBoundingClientRect().bottom;
                            if(gap<12)errors.push('copy touches action: '+help.textContent.slice(0,40)+' ('+gap+'px)');
                        }
                        for(const label of pane.querySelectorAll('.lm-day-field')){
                            if(!label.getClientRects().length)continue;
                            const span=label.querySelector('span'),input=label.querySelector('input,select');
                            if(input&&input.getBoundingClientRect().top-span.getBoundingClientRect().bottom<9)errors.push('label touches field');
                        }
                        return errors;
                    }''')
                    self.assertEqual(violations,[],f'{theme} {width} {tab}')
                    self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
                    if width==393:
                        self.page.screenshot(path=str(out/f'{BROWSER}-spacing-{tab}-{theme}.png'),full_page=True)
        self.assertFalse(self.errors)

    def test_phone_native_fields_fit_cards_without_overlap(self):
        self.page.emulate_media(color_scheme='dark')
        self.page.add_init_script("Object.defineProperty(navigator,'standalone',{value:true});Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});")
        self.load(board(),home=True)
        self.page.evaluate("window.AtlasAppearance.set('dark')")
        self.assertEqual(self.page.locator('html').get_attribute('data-atlas-theme'),'dark')
        out=ROOT/'artifacts/life-map-tests'
        out.mkdir(parents=True,exist_ok=True)
        for width,height in [(320,740),(393,852),(852,393)]:
            self.page.set_viewport_size({'width':width,'height':height})
            for tab in ['plan','areas']:
                self.page.evaluate('(tab)=>window.LifeMapDay.choose(tab,"food")',tab)
                if tab=='plan':
                    self.page.locator('.lm-block-editor').evaluate_all('els=>els.forEach(el=>el.open=true)')
                self.assertFalse(self.page.locator('#lm-capture-launch').is_visible())
                violations=self.page.locator('.lm-day-view:not([hidden]) .lm-day-field input, .lm-day-view:not([hidden]) .lm-day-field select').evaluate_all('''els=>els.filter(el=>el.getClientRects().length).flatMap(el=>{
                    const r=el.getBoundingClientRect(),p=el.closest('label').getBoundingClientRect(),c=el.closest('.lm-day-panel').getBoundingClientRect();
                    const errors=[];
                    if(r.left<p.left-1||r.right>p.right+1||r.left<c.left||r.right>c.right)errors.push(el.id+' leaves its field/card');
                    if(el.scrollWidth>el.clientWidth+2&&el.type!=='select-one')errors.push(el.id+' internal overflow');
                    const pair=el.closest('.lm-two-col');
                    if(pair)for(const other of pair.querySelectorAll('input'))if(other!==el){const b=other.getBoundingClientRect();if(Math.min(r.right,b.right)>Math.max(r.left,b.left)+1&&Math.min(r.bottom,b.bottom)>Math.max(r.top,b.top)+1)errors.push(el.id+' overlaps '+other.id);}
                    return errors;
                })''')
                self.assertEqual(violations,[])
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
                if width==393:
                    self.page.screenshot(path=str(out/f'{BROWSER}-{tab}-phone-fields.png'),full_page=True)
        self.page.evaluate('window.LifeMapDay.showRecords()')
        self.assertTrue(self.page.locator('#lm-capture-launch').is_visible())
        self.assertFalse(self.errors)

    def test_new_navigation_layout_keyboard_and_food_draft_recovery(self):
        self.load(board(),home=True)
        self.page.locator('#lm-day-nav-home').focus()
        self.page.keyboard.press('ArrowRight')
        self.assertTrue(self.page.locator('#lm-day-view-plan').is_visible())
        self.page.locator('#lm-day-nav-areas').click()
        self.page.locator('#lm-category-food').click()
        self.page.locator('[data-day-field="food.note"]').fill('Prepared dinners draft')
        storage=self.storage()
        self.load(storage=storage,home=True)
        self.page.locator('#lm-day-nav-areas').click()
        self.page.locator('#lm-category-food').click()
        self.assertEqual(self.page.locator('[data-day-field="food.note"]').input_value(),'Prepared dinners draft')
        for width,height in [(320,740),(844,390),(390,844)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width+1)
        self.page.locator('#lm-day-nav-home').click()
        out=ROOT/'artifacts/life-map-tests'
        out.mkdir(parents=True,exist_ok=True)
        self.page.screenshot(path=str(out/f'{BROWSER}-priority-home.png'),full_page=True)
        self.page.locator('#lm-day-nav-areas').click()
        self.page.screenshot(path=str(out/f'{BROWSER}-food-coverage.png'),full_page=True)
        self.assertFalse(self.errors)


if __name__=='__main__':
    unittest.main(verbosity=2)
