"""Public Life Ledger journeys in isolated browser profiles; never real records."""
import datetime as dt
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('LEDGER_BASE_URL', 'http://127.0.0.1:8765')
ENGINE = os.getenv('LEDGER_BROWSER', 'chromium')
OUT = Path('artifacts/ledger-ui')
OUT.mkdir(parents=True, exist_ok=True)
DAY = '2026-10-03'
units = {'Read': 25, 'YouTube Strategy': 1, 'Communication Drill': 1,
         'Run / Work Out': 1, 'Supplements': 1, 'Sleep': 7.5,
         'Chambers Wealth': 1, 'LinkedIn Strategy': 1}
records = [{'date': DAY, 'units': units, 'leisure': {'gamingMinutes': 40, 'readingDone': False}},
           {'date': '2026-10-02', 'units': {'Read': 10}, 'note': 'Historical note'}]
seed = {'lifeledger:v2': json.dumps(records), 'atlas.appearance.v1': 'dark',
        'lifeledger:migration:season-20260915:v1': 'done',
        'lifeledger:migration:tap-habits-20260916:v1': 'done'}
with sync_playwright() as pw:
    browser = getattr(pw, ENGINE).launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                                  has_touch=True, timezone_id='America/Winnipeg', reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(7000)
    page.clock.set_fixed_time(dt.datetime(2026, 10, 3, 17, tzinfo=dt.timezone.utc))
    page.add_init_script("""(() => {if(!localStorage.getItem('ledger-ui-fixture')){
      for(const [k,v]of Object.entries(SEED))localStorage.setItem(k,v);
      localStorage.setItem('ledger-ui-fixture','1');}})();""".replace('SEED', json.dumps(seed)))
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(BASE) else route.abort())
    def settle():
        page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
    def no_overflow():
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Horizontal page overflow'
    try:
        page.goto(BASE + '/life-ledger.html', wait_until='networkidle')
        page.wait_for_function('!!window.LedgerDays && !!window.LedgerSimplify20260916')
        settle()
        expect(page.locator('#ledger-view-today')).to_be_visible()
        expect(page.locator('#ledger-view-progress')).to_be_hidden()
        expect(page.locator('#leisure-preview-time')).to_have_text('5:00 remaining')
        assert page.locator('#leisure-preview-meter').evaluate('(el) => el.value / el.max') == 5 / 45
        assert page.locator('#leisure-preview-meter').get_attribute('data-level') == 'low'
        assert page.locator('[data-act="commit"]').is_visible()
        no_overflow()
        page.screenshot(path=str(OUT / f'{ENGINE}-today.png'), full_page=True)
        page.locator('#ledger-leisure-preview').click()
        expect(page.locator('#ledger-leisure-sheet')).to_be_visible()
        page.screenshot(path=str(OUT / f'{ENGINE}-leisure.png'))
        page.get_by_role('button', name='Start gaming timer', exact=True).click()
        page.clock.set_fixed_time(dt.datetime(2026, 10, 3, 17, 2, tzinfo=dt.timezone.utc))
        page.wait_for_function("document.getElementById('leisure-preview-meter').value === 3")
        page.locator('#ledger-leisure-close').click()
        expect(page.locator('#ledger-leisure-sheet')).to_be_hidden()
        page.locator('#ledger-nav-progress').click()
        expect(page.locator('#ledger-view-progress')).to_be_visible()
        expect(page.locator('#ledger-view-today')).to_be_hidden()
        page.screenshot(path=str(OUT / f'{ENGINE}-progress.png'), full_page=True)
        page.locator('#ledger-running-timer').click()
        page.get_by_role('button', name='Stop gaming timer', exact=True).click()
        expect(page.locator('#leisure-usage')).to_have_text('42:00 used · 3:00 remaining')
        page.locator('#leisure-minutes').click()
        expect(page.locator('#leisure-manual-minutes')).to_be_visible()
        page.locator('#leisure-manual-minutes').fill('50')
        page.get_by_role('button', name='Save minutes', exact=True).click()
        expect(page.locator('#ledger-leisure-sheet')).to_be_visible()
        expect(page.locator('#leisure-usage')).to_have_text('50:00 used · 5:00 over budget')
        assert page.locator('#leisure-budget-meter').evaluate('(el) => el.value') == 0
        page.locator('#ledger-leisure-close').click()
        page.locator('#ledger-nav-today').click()
        page.locator('#ledger-filter-remaining').click()
        expect(page.locator('[data-act="num"][data-habit="Read"]')).to_be_hidden()
        page.locator('#ledger-filter-all').click()
        page.locator('[data-act="num"][data-habit="Read"]').fill('30')
        page.locator('[data-act="num"][data-habit="Read"]').blur()
        page.locator('[data-act="commit"]').click()
        page.wait_for_function("JSON.parse(localStorage.getItem('lifeledger:v2')).find(d=>d.date==='2026-10-03').units.Read===30")
        if page.locator('dialog.ledger-reward[open]').count():
            page.keyboard.press('Escape')
        page.locator('#ledger-nav-history').click()
        expect(page.locator('#ledger-history')).to_be_visible()
        page.screenshot(path=str(OUT / f'{ENGINE}-history.png'), full_page=True)
        page.get_by_role('button', name='Oct 2, 2026', exact=False).click()
        expect(page.locator('#ledger-view-today')).to_be_visible()
        assert page.evaluate('state.logDate') == '2026-10-02'
        page.reload(wait_until='networkidle')
        page.wait_for_function('!!window.LedgerDays && !!window.LedgerSimplify20260916')
        assert page.evaluate('state.logDate') == DAY
        assert page.evaluate("JSON.parse(localStorage.getItem('lifeledger:v2')).find(d=>d.date==='2026-10-02').note") == 'Historical note'
        expect(page.locator('#leisure-preview-time')).to_have_text('5:00 over budget')
        # Rotation, narrow phone, desktop and keyboard-sized visual viewport.
        for width, height in [(844, 390), (320, 568), (1280, 800), (390, 460)]:
            page.set_viewport_size({'width': width, 'height': height})
            settle()
            no_overflow()
            page.locator('#ledger-leisure-preview').click()
            page.locator('#leisure-minutes').click()
            box = page.locator('#leisure-manual-minutes').bounding_box()
            assert box and 0 <= box['x'] and box['x'] + box['width'] <= width + 1
            page.get_by_role('button', name='Cancel', exact=True).click()
            page.locator('#ledger-leisure-close').click()
        assert not errors, errors
        print(ENGINE + ': daily flow, time remaining, timer, sheet, edits, saved history and viewport checks passed')
    finally:
        page.screenshot(path=str(OUT / f'{ENGINE}-last-state.png'))
        (OUT / f'{ENGINE}-errors.json').write_text(json.dumps(errors, indent=2))
        context.close()
        browser.close()
