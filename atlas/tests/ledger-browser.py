"""Ongoing Life Ledger journeys in isolated profiles; never real records."""
import datetime as dt
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('LEDGER_BASE_URL', 'http://127.0.0.1:8765')
ENGINE = os.getenv('LEDGER_BROWSER', 'chromium')
OUT = Path('artifacts/ledger-ui')
OUT.mkdir(parents=True, exist_ok=True)
DAY = '2026-10-08'
records = [{'date': DAY, 'units': {'Read': 25, 'LinkedIn Strategy': 1},
            'leisure': {'gamingMinutes': 40, 'readingDone': False}},
           {'date': '2025-10-02', 'units': {'Read': 10}, 'note': 'Historical note'}]
seed = {'lifeledger:v2': json.dumps(records), 'atlas.appearance.v1': 'dark'}
with sync_playwright() as pw:
    browser = getattr(pw, ENGINE).launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                                  has_touch=True, timezone_id='America/Winnipeg', reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(10000)
    page.clock.set_fixed_time(dt.datetime(2026, 10, 8, 17, tzinfo=dt.timezone.utc))
    page.add_init_script("""(() => {if(!localStorage.getItem('ledger-ui-fixture')){
      for(const [k,v]of Object.entries(SEED))localStorage.setItem(k,v);
      localStorage.setItem('ledger-ui-fixture','1');}})();""".replace('SEED', json.dumps(seed)))
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
    def no_overflow():
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Horizontal overflow'
    def go_card(habit):
        while page.get_by_role('button', name='Previous habit', exact=True).is_enabled():
            page.get_by_role('button', name='Previous habit', exact=True).click()
        for _ in range(13):
            if page.locator('.ledger-habit-card:not([inert]) [data-habit="' + habit + '"]').count():
                return
            page.get_by_role('button', name='Next habit', exact=True).click()
        raise AssertionError('Habit missing from deck: ' + habit)
    def dismiss_rewards():
        for _ in range(40):
            dialog = page.locator('.ledger-reward[open]')
            if not dialog.count():
                break
            if dialog.get_by_role('button', name='Continue', exact=True).count():
                dialog.get_by_role('button', name='Continue', exact=True).click()
            else:
                dialog.locator('[data-act="achvNext"]').click()
    try:
        page.goto(BASE + '/life-ledger.html', wait_until='networkidle')
        page.wait_for_function('!!window.LedgerDays && !!window.LedgerRhythm')
        expect(page.locator('#ledger-rhythm')).to_be_visible()
        assert page.evaluate('localStorage.getItem("lifeledger:v2")') == seed['lifeledger:v2']
        assert not page.locator('[data-habit="LinkedIn Strategy"]').count()
        assert page.locator('#ledger-rhythm .ledger-rhythm-row').count() == 3
        assert page.locator('.ledger-card-xp').count() == 13
        expect(page.locator('.ledger-habit-card:not([inert]) .ledger-card-xp')).to_have_text('+100 XP per check-in')
        assert page.locator('.ledger-habit-card').count() == 13
        expect(page.locator('#deckCounter')).to_have_text('1 / 13')
        assert page.evaluate('''(() => {const deck=document.querySelector('.ledger-log-wrap'),focus=document.querySelector('#ledger-rhythm');return !!(deck.compareDocumentPosition(focus)&Node.DOCUMENT_POSITION_FOLLOWING);})()''')
        no_overflow()
        page.screenshot(path=str(OUT / f'{ENGINE}-today.png'), full_page=True)
        page.locator('#rhythm-week-reduced').click()
        expect(page.locator('#rhythm-week-reduced')).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate('compute(state.days,state.goals).habit.Read.total') == 35
        page.get_by_role('button', name='Choose focus habits', exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        no_overflow()
        expect(page.locator('#ledger-focus-count')).to_contain_text('3 of 3 selected')
        assert page.get_by_role('dialog').get_by_role('checkbox').count() == 13
        page.get_by_role('button', name='Save focus', exact=True).click()
        expect(page.get_by_role('dialog')).to_have_count(0)
        expect(page.locator('#ledger-choose-focus')).to_be_focused()
        page.get_by_role('button', name='Edit goal for Read', exact=True).click()
        expect(page.locator('#rhythm-goal-normal')).to_have_attribute('step','1')
        expect(page.locator('#rhythm-goal-normal')).to_have_attribute('max','7')
        no_overflow()
        expect(page.locator('#rhythm-goal-target')).to_be_hidden()
        expect(page.locator('#rhythm-goal-due')).to_be_hidden()
        page.locator('#rhythm-goal-type').select_option('deadline')
        page.locator('#rhythm-goal-target').fill('100')
        page.locator('#rhythm-goal-due').fill('2027-02-01')
        page.get_by_role('button', name='Save goal', exact=True).click()
        expect(page.locator('#ledger-rhythm')).to_contain_text('Due')
        page.get_by_role('button', name='Quick catch-up', exact=True).first.click()
        page.locator('#rhythm-catchup-week').select_option('2026-10-05')
        page.locator('#rhythm-catchup-habit').select_option('Read')
        page.locator('#rhythm-catchup-amount').fill('50')
        page.locator('#rhythm-catchup-sessions').fill('2')
        page.get_by_role('button', name='Save weekly total', exact=True).click()
        expect(page.locator('#rhythm-catchup-title')).to_have_count(0)
        dismiss_rewards()
        assert page.evaluate('compute(state.days,state.goals).habit.Read.total') == 60
        assert len(json.loads(page.evaluate('localStorage.getItem("lifeledger:v2")'))) == 2
        page.locator('#ledger-leisure-preview').click()
        expect(page.locator('#ledger-leisure-sheet')).to_be_visible()
        expect(page.locator('#ledger-leisure')).to_contain_text('total unknown')
        for minutes, outcome in [(59, 1), (60, 0)]:
            page.locator('#leisure-minutes').click()
            page.locator('#leisure-manual-minutes').fill(str(minutes))
            page.get_by_role('button', name='Confirm total', exact=True).click()
            page.wait_for_function('!document.getElementById("leisure-manual-minutes")')
            assert page.evaluate('state.draft["Screen Discipline"]') == outcome
            assert page.evaluate('state.draft.Read') == 25
        page.locator('#ledger-leisure-close').click()
        page.locator('[data-act="commit"]').first.click()
        page.wait_for_function('JSON.parse(localStorage.getItem("lifeledger:v2")).some(d=>d.leisure?.screenMinutes===60)')
        dismiss_rewards()
        saved = json.loads(page.evaluate('localStorage.getItem("lifeledger:v2")'))
        assert next(d for d in saved if d['date'] == DAY)['units']['LinkedIn Strategy'] == 1
        for view in ['progress', 'history', 'today']:
            page.locator('#ledger-nav-' + view).click()
            expect(page.locator('#ledger-view-' + view)).to_be_visible()
            no_overflow()
            page.screenshot(path=str(OUT / f'{ENGINE}-{view}.png'), full_page=True)
        page.reload(wait_until='networkidle')
        page.wait_for_function('!!window.LedgerDays')
        expect(page.locator('#rhythm-week-reduced')).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate('compute(state.days,state.goals).habit.Read.total') == 60
        expect(page.locator('#ledger-life-level')).to_contain_text('Life Level 0')
        go_card('Read')
        page.get_by_role('textbox', name='Amount for Read', exact=True).fill('1000')
        expect(page.locator('.ledger-habit-card:not([inert]) .ledger-habit-status')).to_have_text('Recorded')
        page.get_by_role('textbox', name='Amount for Read', exact=True).press('Tab')
        page.locator('[data-act="commit"]').first.click()
        expect(page.get_by_role('dialog', name='Life · Level 1', exact=True)).to_be_visible()
        no_overflow()
        page.screenshot(path=str(OUT / f'{ENGINE}-level-up.png'))
        dismiss_rewards()
        expect(page.locator('#ledger-life-level')).to_contain_text('Life Level 1')
        page.locator('#ledger-nav-progress').click()
        expect(page.locator('#ledger-lifetime-levels')).to_contain_text('4040 lifetime XP')
        assert page.locator('.ledger-value-level').count() == 5
        health=page.locator('.ledger-value-toggle[data-key="HEALTH"]')
        health.press('Enter')
        expect(page.locator('.ledger-value-toggle[data-key="HEALTH"]')).to_have_attribute('aria-expanded','true')
        expect(page.locator('#ledger-value-details-HEALTH')).to_be_visible()
        expect(page.locator('.ledger-value-toggle[data-key="HEALTH"]')).to_be_focused()
        page.screenshot(path=str(OUT / f'{ENGINE}-lifetime-levels.png'), full_page=True)
        page.locator('#ledger-nav-today').click()
        page.reload(wait_until='networkidle')
        expect(page.locator('#ledger-life-level')).to_contain_text('Life Level 1')
        for width in [320, 430, 1024]:
            page.set_viewport_size({'width': width, 'height': 844})
            assert page.locator('.ledger-save-row').bounding_box()['height'] <= 76, 'Daily dock is too tall'
            for index in range(13):
                expect(page.locator('#deckCounter')).to_have_text(f'{index + 1} / 13')
                assert page.locator('.ledger-habit-card:not([inert])').count() == 1
                no_overflow()
                assert page.locator('.ledger-habit-card:not([inert])').evaluate('''card => [...card.querySelectorAll('button,input')].every(el=>{const r=el.getBoundingClientRect(),v=document.getElementById('deckViewport').getBoundingClientRect();return r.width>=44 && r.height>=44 && r.left>=v.left && r.right<=v.right;})'''), 'Clipped or undersized card control'
                if index < 12:
                    page.get_by_role('button', name='Next habit', exact=True).click()
            expect(page.get_by_role('button', name='Next habit', exact=True)).to_be_disabled()
            for _ in range(12):
                page.get_by_role('button', name='Previous habit', exact=True).click()
            page.screenshot(path=str(OUT / f'{ENGINE}-cards-{width}.png'), full_page=True)
        page.get_by_role('button', name='What counts for Workouts Complete', exact=True).click()
        expect(page.get_by_role('button', name='What counts for Workouts Complete', exact=True)).to_have_attribute('aria-expanded', 'true')
        page.get_by_role('button', name='Next habit', exact=True).click()
        assert page.locator('.ledger-habit-card[aria-hidden="true"]').count() == 12
        page.get_by_role('button', name='Previous habit', exact=True).click()
        go_card('Read')
        expect(page.locator('.ledger-habit-card:not([inert]) .ledger-card-xp')).to_have_text('+10 pages · +40 XP per tap')
        page.get_by_role('button', name='Did not do: Read', exact=True).click()
        expect(page.get_by_role('button', name='Leave unknown: Read', exact=True)).to_be_visible()
        page.get_by_role('button', name='Leave unknown: Read', exact=True).click()
        # This profile is isolated; visual checks may change its appearance only.
        page.evaluate("localStorage.setItem('atlas.appearance.v1','light')")
        page.reload(wait_until='networkidle')
        page.set_viewport_size({'width': 390, 'height': 844})
        no_overflow()
        page.screenshot(path=str(OUT / f'{ENGINE}-cards-light.png'), full_page=True)
        page.locator('#ledger-nav-progress').click()
        no_overflow()
        page.locator('[aria-label="How lifetime levels work"]').click()
        no_overflow()
        assert page.locator('#ledger-lifetime-levels .ledger-progress-info p').bounding_box()['width'] >= 250
        page.screenshot(path=str(OUT / f'{ENGINE}-progress-light.png'), full_page=True)
        assert page.locator('#ledger-quick-reset').count() == 0
        page.locator('#ledger-nav-history').click()
        assert page.locator('#ledger-quick-reset').count() == 0
        page.get_by_role('button', name='Settings', exact=True).click()
        page.get_by_role('button', name='Reset progress', exact=True).click()
        expect(page.get_by_role('dialog', name='Reset progress?', exact=True)).to_be_visible()
        no_overflow()
        page.get_by_role('button', name='Reset progress', exact=True).click()
        expect(page.locator('#ledger-nav-today')).to_have_attribute('aria-selected', 'true')
        expect(page.locator('#ledger-quick-reset')).to_be_visible()
        assert page.evaluate('JSON.parse(localStorage.getItem("lifeledger:v2")).length') == 0
        page.reload(wait_until='networkidle')
        page.locator('#ledger-nav-progress').click()
        expect(page.locator('#ledger-lifetime-levels h2')).to_have_text('Life Level 0')
        page.locator('#ledger-nav-history').click()
        page.locator('#ledger-progress-archives > summary').click()
        page.locator('#ledger-progress-archives details > summary').click()
        expect(page.locator('#ledger-progress-archives')).to_contain_text('Historical note')
        page.get_by_role('button', name='Restore this progress', exact=True).click()
        page.get_by_role('button', name='Restore backup', exact=True).click()
        assert page.evaluate('JSON.parse(localStorage.getItem("lifeledger:v2")).length') > 0
        no_overflow()
        page.locator('#ledger-nav-today').click()
        for habit, value in [('Sleep', '7'), ('Read', '13'), ('Board Work', '45')]:
            go_card(habit)
            input_field = page.get_by_role('textbox', name='Amount for ' + habit, exact=True)
            input_field.fill(value)
            done = page.get_by_role('button', name='Confirm amount and next habit: ' + habit, exact=True)
            box = done.bounding_box()
            assert box['width'] >= 44 and box['height'] >= 44
            done.press('Enter')
            assert page.locator('.ledger-habit-card:not([inert])').get_attribute('aria-label').split(' · ')[0] != habit
            go_card(habit)
            expect(page.get_by_role('textbox', name='Amount for ' + habit, exact=True)).to_have_value(value)
            no_overflow()
        page.screenshot(path=str(OUT / f'{ENGINE}-amount-done.png'), full_page=True)
        assert not errors, errors
        print(ENGINE + ': ongoing goals, catch-up, screen boundary, lifetime levels, history and responsive journeys passed')
    finally:
        page.screenshot(path=str(OUT / f'{ENGINE}-final.png'), full_page=True)
        browser.close()
