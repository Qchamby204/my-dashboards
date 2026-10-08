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
    def dismiss_rewards():
        for _ in range(40):
            dialog = page.locator('.ledger-reward[open]')
            if not dialog.count():
                break
            dialog.locator('[data-act="achvNext"]').click()
    try:
        page.goto(BASE + '/life-ledger.html', wait_until='networkidle')
        page.wait_for_function('!!window.LedgerDays && !!window.LedgerRhythm')
        expect(page.locator('#ledger-rhythm')).to_be_visible()
        assert page.evaluate('localStorage.getItem("lifeledger:v2")') == seed['lifeledger:v2']
        assert not page.locator('[data-habit="LinkedIn Strategy"]').count()
        assert page.locator('#ledger-rhythm .ledger-rhythm-row').count() == 3
        no_overflow()
        page.screenshot(path=str(OUT / f'{ENGINE}-today.png'), full_page=True)
        page.locator('#rhythm-week-reduced').click()
        expect(page.locator('#rhythm-week-reduced')).to_have_attribute('aria-pressed', 'true')
        assert page.evaluate('compute(state.days,state.goals).habit.Read.total') == 35
        page.get_by_role('button', name='Choose focus habits', exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        assert page.get_by_role('dialog').get_by_role('checkbox').count() == 13
        page.get_by_role('button', name='Save focus', exact=True).click()
        expect(page.get_by_role('dialog')).to_have_count(0)
        page.get_by_role('button', name='Edit goal for Read', exact=True).click()
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
        for width in [320, 430, 1024]:
            page.set_viewport_size({'width': width, 'height': 844})
            no_overflow()
        assert not errors, errors
        print(ENGINE + ': ongoing goals, catch-up, screen boundary, history and responsive journeys passed')
    finally:
        page.screenshot(path=str(OUT / f'{ENGINE}-final.png'), full_page=True)
        browser.close()
