/* Prescriptions transcribed without changes from the four supplied plans. */
(()=>{ const plans = {};
plans.bench = {...{"id": "bench", "title": "Bench press", "target": "315", "unit": "lb", "phase": "8-week target", "aim": "Test 315 lb in week 8", "legacyKey": "road315-v1", "color": "gold", "rules": "<p><strong>Days.</strong> Keep at least two days between Day 1 and Day 2, for example Monday and Thursday.</p>\n    <p><strong>RPE.</strong> RPE 8 means you had about two reps left. RPE 9 means one. The top singles should look fast and controlled at RPE 8.</p>\n    <p><strong>Main lift.</strong> If a top set or single goes past RPE 9, repeat that week's loads next week instead of moving on. If you miss reps, stop that exercise for the day. Don't grind extra attempts.</p>\n    <p><strong>Accessories.</strong> Pick a weight you can do for the bottom of the rep range at about RPE 8. When every set reaches the top of the range, add the smallest jump available next session. Leave one or two reps in the tank on everything.</p>\n    <p><strong>Paused reps.</strong> Two full seconds motionless on the chest. If the pause gets shorter, the weight is too heavy.</p>\n    <p><strong>Pain.</strong> Sore shoulders or elbows mean a lighter week, even partway through the block. Swap dips for close grip push-ups if dips bother your shoulders.</p>"}, build(base="28:00"){let state={base};

const WU = "Warm up: bar x 10, 135 x 5, 185 x 3, 225 x 2";
const WU_HEAVY = WU + ", 255 x 1, 270 x 1";
const R_MAIN = "Rest 3 to 4 min", R_SINGLE = "Rest 4 to 5 min", R_ACC = "Rest 90 sec to 2 min", R_ISO = "Rest 60 to 90 sec";

function ex(n, rx, sets, rest, note, main){ return {n, rx, sets, rest, note, main: !!main}; }

function d1Acc(p){
  if (p === "build") return [
    ex("Incline dumbbell press","3 x 8 to 10",3,R_ACC),
    ex("Weighted dips","3 x 6 to 10",3,R_ACC,"Bodyweight is fine to start."),
    ex("Barbell or chest supported row","3 x 8 to 10",3,R_ACC,"Keeps your shoulders balanced with all the pressing."),
    ex("Rope pushdown","3 x 10 to 12",3,R_ISO)];
  if (p === "heavy") return [
    ex("Incline dumbbell press","3 x 6 to 8",3,R_ACC),
    ex("Weighted dips","3 x 6 to 8",3,R_ACC),
    ex("Barbell or chest supported row","3 x 8 to 10",3,R_ACC),
    ex("Rope pushdown","3 x 10 to 12",3,R_ISO)];
  return [
    ex("Incline dumbbell press","2 x 6 to 8",2,R_ACC,"Same weight as week 6. Not to failure."),
    ex("Weighted dips","2 x 6",2,R_ACC),
    ex("Barbell or chest supported row","2 x 8",2,R_ACC),
    ex("Rope pushdown","2 x 10",2,R_ISO)];
}
function d2Acc(p){
  if (p === "build") return [
    ex("Flat dumbbell press","3 x 10 to 12",3,R_ACC),
    ex("Cable fly or pec deck","3 x 12 to 15",3,R_ISO,"Slow stretch at the bottom."),
    ex("Lat pulldown or pull-ups","3 x 8 to 10",3,R_ACC),
    ex("Overhead triceps extension","3 x 10 to 12",3,R_ISO),
    ex("Face pulls","3 x 15 to 20",3,R_ISO)];
  return [
    ex("Flat dumbbell press","3 x 8 to 10",3,R_ACC),
    ex("Cable fly or pec deck","3 x 12 to 15",3,R_ISO),
    ex("Lat pulldown or pull-ups","3 x 8 to 10",3,R_ACC),
    ex("Overhead triceps extension","3 x 10 to 12",3,R_ISO),
    ex("Face pulls","3 x 15 to 20",3,R_ISO)];
}

const PHASES = {
  build:{name:"Build", span:"Weeks 1 to 3"},
  heavy:{name:"Get heavy", span:"Weeks 4 to 6"},
  peak:{name:"Peak", span:"Week 7"},
  test:{name:"Test", span:"Week 8"}
};

function buildWeek(heavy, paused){
  return {phase:"build",
    note:"Moderate weights, lots of good reps. Every set should look the same from first rep to last.",
    d1:[ex("Bench press", "4 x 5 @ "+heavy, 4, R_MAIN, WU, true), ...d1Acc("build")],
    d2:[ex("Paused bench press", "4 x 6 @ "+paused, 4, R_MAIN, WU, true), ...d2Acc("build")]};
}
function heavyWeek(single, backRx, backSets, pausedRx, pausedSets, note){
  return {phase:"heavy", note,
    d1:[ex("Bench press, top single", "1 @ "+single+" (RPE 8)", 1, R_SINGLE, WU_HEAVY, true),
        ex("Bench press, back-off sets", backRx, backSets, R_MAIN, "Drop straight down after the single.", true),
        ...d1Acc("heavy")],
    d2:[ex("Paused bench press", pausedRx, pausedSets, R_MAIN, WU, true), ...d2Acc("heavy")]};
}

const WEEKS = [
  buildWeek("240","225"),
  buildWeek("245","230"),
  buildWeek("250","232.5"),
  heavyWeek("280","4 x 3 @ 265",4,"3 x 5 @ 240",3,
    "First heavy single of the block. It should move fast. Log how it felt, since that's your best read on progress from here."),
  heavyWeek("285 to 290","4 x 3 @ 270",4,"3 x 4 @ 245",3,
    "Take 290 only if last week's 280 was clearly easy."),
  {...heavyWeek("295","3 x 2 @ 280",3,"3 x 4 @ 250",3,""), flag:true,
    note:"Checkpoint. If 295 moves about as easily as it did before the block, you're on track for 315. If it's a grind, set 305 as the week 8 target and save 315 for the next block."},
  {phase:"peak", flag:false,
    note:"Heaviest bench of the block, lower volume everywhere else. Day 2 is deliberately light so you recover.",
    d1:[ex("Bench press, top single","1 @ 305 (RPE 9)",1,R_SINGLE,WU_HEAVY+", 290 x 1",true),
        ex("Bench press, back-off sets","2 x 2 @ 280",2,R_MAIN,null,true),
        ...d1Acc("peak")],
    d2:[ex("Bench press, light","3 x 3 @ 225",3,R_MAIN,"Touch and go, fast reps. Stop there.",true),
        ex("Cable fly or pec deck","2 x 12",2,R_ISO),
        ex("Face pulls","2 x 15",2,R_ISO)]},
  {phase:"test",
    note:"Day 1 early in the week, then two or three full rest days before test day. No accessories on test day.",
    d1:[ex("Bench press, light","3 x 3 @ 225",3,R_MAIN,"Crisp and easy. Leave the gym feeling fresh.",true),
        ex("Face pulls","2 x 15",2,R_ISO)],
    d2:[ex("Warm-up","Bar x 10, 135 x 5, 185 x 3, 225 x 2, 255 x 1",5,"Rest 2 to 3 min",null,true),
        ex("Opener","1 @ 275",1,R_SINGLE,"Should feel easy.",true),
        ex("Second attempt","1 @ 295",1,R_SINGLE,"If this is slow, take 305 next instead of 315.",true),
        ex("Third attempt","1 @ 315",1,R_SINGLE,"Rest a full 5 minutes first. Use a spotter.",true)]}
];

const DAY_INFO = {
  d1:{title:"Day 1: Heavy", purpose:"Top-end strength on the bench, then incline, dips, rows and triceps."},
  d2:{title:"Day 2: Paused", purpose:"Strength off the chest, then dumbbell pressing, flys, back and triceps."}
};
DAY_INFO.test_d1 = {title:"Day 1: Primer", purpose:"A short, light session to stay sharp."};
DAY_INFO.test_d2 = {title:"Day 2: Test day", purpose:"Three attempts. Full rest between each one."};
DAY_INFO.peak_d2 = {title:"Day 2: Light", purpose:"Recovery work before the final week."};



return {weeks:WEEKS,phases:PHASES,days:DAY_INFO};}};
plans.deadlift = {...{"id": "deadlift", "title": "Deadlift", "target": "495 \u00d7 5", "unit": "lb", "phase": "Phase 1", "aim": "Week 8: 455\u2013465 lb \u00d7 5", "legacyKey": "fiveplates-x5-v2", "color": "orange", "rules": "<p><strong>Days.</strong> Keep at least two full days between Day 1 and Day 2, for example Tuesday and Saturday. Don't put Day 2 the day before heavy squats.</p>\n    <p><strong>Every rep is a single.</strong> Set the bar down fully between reps, reset your grip, take a big breath into your belly, brace like you're about to be punched, then pull. No bouncing. This matters more for your back than any accessory.</p>\n    <p><strong>RPE.</strong> RPE 8 means about two reps left, RPE 9 means one. If your back rounds or the bar drifts away from your legs, the set is over, whatever rep you're on.</p>\n    <p><strong>Main lift.</strong> If a top set goes past RPE 9, repeat that week's loads instead of moving on. If you miss a rep, skip the rest of that exercise for the day.</p>\n    <p><strong>Grip.</strong> Use the grip you'll test with (hook or mixed) on top sets. Straps are fine on back-off sets so your grip doesn't cut the work short.</p>\n    <p><strong>Core work.</strong> Each piece trains your trunk to resist a different kind of movement: ab wheel and dead bugs resist arching, Pallof presses resist twisting, and suitcase carries and side planks resist bending sideways. Back extensions build the muscles along your spine directly. Move slowly and keep your ribs down. Add load or time when every set feels controlled.</p>\n    <p><strong>Accessories.</strong> Start at a weight where the bottom of the rep range feels like RPE 8. When every set reaches the top of the range, add the smallest jump available.</p>\n    <p><strong>Pain.</strong> General tiredness in your back is normal. Pain that's sharp, shoots down a leg, or lasts into the next day means stop deadlifting and get it assessed.</p>"}, build(base="28:00"){let state={base};

const WU = "Warm up: 135 x 5, 225 x 3, 315 x 2, 365 x 1";
const WU_HEAVY = WU + ", 405 x 1";
const WU_PAUSE = "Warm up: 135 x 5, 225 x 3, 275 x 2";
const R_TOP = "Rest 4 to 5 min", R_MAIN = "Rest 3 to 4 min", R_ACC = "Rest 90 sec to 2 min", R_CORE = "Rest 60 to 90 sec";

function ex(n, rx, sets, rest, note, main, rl){ return {n, rx, sets, rest, note, main: !!main, rl}; }

const BIG3 = ex("McGill big 3","1 round",1,"Straight into the warm-up sets",
  "5 curl-ups, 5 side planks per side and 5 bird dogs per side, holding each for 10 seconds. Primes your brace before you pull.",false,"Rounds");

// sets: 3 normal, 2 lighter weeks
function d1Acc(n){ return [
  ex("Chest supported row", `${n} x 8 to 10`, n, R_ACC, "Chest on the pad so your lower back gets a break."),
  ex("Ab wheel rollout", `${n} x 8 to 12`, n, R_CORE, "Stop each rep before your lower back starts to sag. Knees are fine to start."),
  ex("Pallof press", `${n} x 10 each side`, n, R_CORE, "Press out, hold 2 seconds, don't let the cable twist you."),
  ex("Suitcase carry", `${n} x 30 m each side`, n, R_CORE, "One heavy dumbbell or kettlebell. Stay perfectly upright.", false, "Metres")]; }
function d2Acc(n){ return [
  ex("45 degree back extension", `${n} x 10 to 12`, n, R_ACC, "Hold a plate once bodyweight gets easy. Squeeze your glutes at the top, don't hyperextend."),
  ex("Hanging leg raise", `${n} x 8 to 12`, n, R_CORE, "Curl your pelvis up, no swinging. Knees bent is fine."),
  ex("Weighted side plank", `${n} x 30 sec each side`, n, R_CORE, "Plate on your hip once 45 seconds is easy.", false, "Seconds"),
  ex("Dead bug", `${n} x 8 each side`, n, R_CORE, "Lower back pressed into the floor the whole time."),
  ex("Farmer carry", `${n} x 30 m`, n, R_CORE, "Heavy. Builds grip and bracing together.", false, "Metres")]; }

const PHASES = {
  build:{name:"Build", span:"Weeks 1 and 2"},
  fives:{name:"Heavy fives", span:"Weeks 3 and 4"},
  push:{name:"Push", span:"Weeks 5 to 7"},
  test:{name:"Test", span:"Week 8"}
};

function buildWeek(load, paused){ return {phase:"build",
  note:"Moderate weights and lots of clean sets of five. Every rep should look the same, from the first set to the last.",
  d1:[BIG3, ex("Deadlift", `4 x 5 @ ${load}`, 4, R_MAIN, WU, true), ...d1Acc(3)],
  d2:[BIG3, ex("Paused deadlift", `3 x 3 @ ${paused}`, 3, R_MAIN, WU_PAUSE+". Pause 2 seconds just below the knee, back flat, then finish the pull.", true), ...d2Acc(3)]}; }

function heavyWeek(phase, top, rpe, back, backSets, paused, pausedSets, note){ return {phase, note,
  d1:[BIG3,
      ex("Deadlift, top set", `1 x 5 @ ${top} (RPE ${rpe})`, 1, R_TOP, WU_HEAVY, true),
      ex("Deadlift, back-off sets", back, backSets, R_MAIN, "Straps are fine here.", true),
      ...d1Acc(3)],
  d2:[BIG3, ex("Paused deadlift", paused, pausedSets, R_MAIN, WU_PAUSE, true), ...d2Acc(3)]}; }

const WEEKS = [
  buildWeek("385","335"),
  buildWeek("400","345"),
  heavyWeek("fives","415","8","3 x 5 @ 385",3,"3 x 3 @ 355",3,
    "One heavy set of five, then back-off work. Log the RPE on the top set every week. That trend is your best read on progress."),
  heavyWeek("fives","425","8","3 x 5 @ 390",3,"3 x 3 @ 365",3,
    "Same pattern, 10 lb heavier on top."),
  {...heavyWeek("push","435","8.5","2 x 5 @ 395",2,"3 x 2 @ 375",3,""), flag:true,
    note:"Checkpoint. If 435 x 5 lands at RPE 8.5 or easier, you're on track for 455 x 5 in week 8. If it's a grind, aim for 445 x 5 and carry the rest into block 2."},
  heavyWeek("push","445","9","1 x 5 @ 400",1,"2 x 2 @ 385",2,
    "RPE 9 is the ceiling. If 445 x 5 goes past that, stop the set at four and move on."),
  {phase:"push",
    note:"A heavy triple to get used to the weight you'll test, then a light Day 2 so you recover.",
    d1:[BIG3,
        ex("Deadlift, top set","1 x 3 @ 455 (RPE 8)",1,R_TOP,WU_HEAVY+", 425 x 1",true),
        ex("Deadlift, back-off sets","2 x 3 @ 405",2,R_MAIN,null,true),
        ...d1Acc(2)],
    d2:[BIG3,
        ex("Deadlift, light","3 x 3 @ 365",3,R_MAIN,"Fast, crisp pulls. Stop there.",true),
        ex("Dead bug","2 x 8 each side",2,R_CORE),
        ex("Weighted side plank","2 x 30 sec each side",2,R_CORE,null,false,"Seconds")]},
  {phase:"test",
    note:"Day 1 early in the week, then three full rest days. One all-out set of five on test day, no accessories after.",
    d1:[BIG3,
        ex("Deadlift, light","3 x 3 @ 365",3,R_MAIN,"Easy and fast. Leave feeling fresh.",true),
        ex("Pallof press","2 x 10 each side",2,R_CORE)],
    d2:[BIG3,
        ex("Warm-up","135 x 5, 225 x 3, 315 x 2, 375 x 1, 415 x 1",5,"Rest 2 to 3 min",null,true),
        ex("Test set","1 x 5 @ 455",1,R_TOP,"Rest a full 5 minutes after the last warm-up. If 415 flew off the floor, take 465 instead.",true)]}
];

const DAY_INFO = {
  d1:{title:"Day 1: Heavy pull", purpose:"The main deadlift work, then rows and core work that resists arching, twisting and leaning."},
  d2:{title:"Day 2: Position and trunk", purpose:"Paused pulls to own the positions, then back extensions, abs and carries."}
};
DAY_INFO.test_d1 = {title:"Day 1: Primer", purpose:"A short, light session to stay sharp."};
DAY_INFO.test_d2 = {title:"Day 2: Test day", purpose:"One set of five. Reset and brace before every rep."};



return {weeks:WEEKS,phases:PHASES,days:DAY_INFO};}};
plans.run = {...{"id": "run", "title": "5K run", "target": "20:00", "unit": "5K", "phase": "Phase 1", "aim": "Week 8: work toward sub-26:00", "legacyKey": "road-to-20-5k-v2", "color": "blue", "rules": "<p><strong>Days.</strong> Keep the two runs at least two days apart. Don't run intervals the day before heavy deadlifts. If you run on a lifting day, lift first, or leave six hours between them.</p>\n    <p><strong>Easy means easy.</strong> You should be able to talk in full sentences. If you can't, slow down, walk breaks included. Most of your aerobic fitness comes from these runs, and running them too hard is the most common mistake.</p>\n    <p><strong>Intervals and tempo.</strong> Hit the target times, not faster. Your last rep should match your first. If you're falling more than five seconds behind, end the session there.</p>\n    <p><strong>Warm-up and cool-down.</strong> Every interval, tempo and time trial session starts with 10 minutes easy and ends with 5 to 10 minutes easy. They aren't listed as separate items.</p>\n    <p><strong>Time trials.</strong> Use a flat route or a track. Start at a pace you're sure you can hold, and speed up over the last kilometre if you have anything left.</p>\n    <p><strong>Your legs.</strong> Shins, knees and Achilles adapt more slowly than your heart and lungs, and your lifting already loads them. Soreness that fades as you warm up is normal. Pain that gets worse during a run, or makes you limp afterwards, means take a few days off running.</p>"}, build(base="28:00"){let state={base};


function toSec(t){ const m = String(t).trim().match(/^(\d{1,2}):([0-5]\d)$/); return m ? (+m[1])*60 + (+m[2]) : null; }
function fmt(sec){ sec = Math.round(sec); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`; }

function paces(){
  const P = (toSec(state.base) || 1680) / 5;
  return { P, easyLo:P+60, easyHi:P+90, tempo:P+15, int:P-5 };
}
function reps(n, m, key, rest){
  const p = paces()[key], label = key === "int" ? "interval pace" : "tempo pace";
  return ex(`${n} x ${m} m`, `${fmt(p*m/1000)} each`, n, rest, `${label}, ${fmt(p)} per km`, true);
}
function tempoBlocks(n, min, rest){
  const p = paces().tempo;
  return ex(`Tempo, ${n} x ${min} min`, `${fmt(p)} per km`, n, rest, "Comfortably hard. You could say a few words, not a sentence.", true);
}
function easy(min, extra){
  const p = paces();
  return ex(`Easy run, ${min} min`, `${fmt(p.easyLo)} to ${fmt(p.easyHi)} per km`, 1, "Conversational", extra || "Walk breaks are fine. Time on your feet is what counts.", true);
}
function strides(n){ return ex(`Strides, ${n} x 20 sec`, "Fast, relaxed", n, "Walk back to recover", "Quick and smooth, not a sprint. Right after the easy run.", false); }
function trial(note){ return ex("5k time trial", "All out, evenly paced", 1, "10 min easy before", note, true); }
function ex(n, rx, sets, rest, note, main){ return {n, rx, sets, rest, note, main: !!main}; }

const PHASES = {
  base:{name:"Baseline", span:"Week 1"},
  build:{name:"Build", span:"Weeks 2 to 4"},
  check:{name:"Checkpoint", span:"Week 5"},
  sharpen:{name:"Sharpen", span:"Weeks 6 and 7"},
  test:{name:"Test", span:"Week 8"}
};

function makeWeeks(){ return [
  {phase:"base", note:"Run the time trial first, enter your time at the top, and every pace below updates to match.",
    d1:[trial("Your starting point. Enter this time above, then tap Update paces.")], d2:[easy(25)]},
  {phase:"build", note:"First interval session. Short reps, long enough rest to keep them even.",
    d1:[reps(6,400,"int","90 sec easy jog between")], d2:[easy(30)]},
  {phase:"build", note:"Tempo running teaches you to hold a hard pace without falling apart.",
    d1:[tempoBlocks(2,8,"2 min easy jog between")], d2:[easy(35)]},
  {phase:"build", note:"Longer interval reps than week 2.",
    d1:[reps(5,600,"int","2 min easy jog between")], d2:[easy(35)]},
  {phase:"check", flag:true, note:"Checkpoint. Run the time trial, enter the new time at the top and update your paces. Somewhere around 27:00 means you're on track for under 26 by week 8. The easy run is shorter this week so you recover.",
    d1:[trial("Update your paces at the top afterwards.")], d2:[easy(30)]},
  {phase:"sharpen", note:"Three tempo blocks, paced off your new time.",
    d1:[tempoBlocks(3,8,"2 min easy jog between")], d2:[easy(40)]},
  {phase:"sharpen", note:"Kilometre reps. The hardest session of the block, and the last hard one before the test.",
    d1:[reps(4,1000,"int","2 min easy jog between")], d2:[easy(35)]},
  {phase:"test", note:"Short easy run early in the week, then two or three days off running before the test.",
    d1:[easy(20, "Keep it short and relaxed."), strides(4)],
    d2:[trial("Aim for 5:12 per km or a bit faster. Hold back for the first kilometre.")]}
]; }
let WEEKS = makeWeeks();

const DAY_INFO = {
  d1:{title:"Run 1: Quality", purpose:"Intervals, tempo or a time trial."},
  d2:{title:"Run 2: Easy", purpose:"A longer easy run to build your aerobic engine."}
};
DAY_INFO.test_d1 = {title:"Run 1: Primer", purpose:"Short and easy, early in the week."};
DAY_INFO.test_d2 = {title:"Run 2: Test day", purpose:"Your end-of-block 5k."};


return {weeks:WEEKS,phases:PHASES,days:DAY_INFO};}};
plans.dunk = {...{"id": "dunk", "title": "Dunk", "target": "Above the rim", "unit": "touch height", "phase": "Phase 1", "aim": "Build and test your best touch", "legacyKey": "road-to-dunk-v2", "color": "green", "rules": "<p><strong>When.</strong> Do each session right before a bench day, when your legs are rested. Never after deadlifts, and not the day after the interval run. Jumping tired only trains you to jump slowly.</p>\n    <p><strong>Every jump is all out.</strong> Unless the plan says otherwise, every rep gets full effort, and you rest until you feel ready again, usually 60 to 90 seconds. If your jumps get noticeably lower, end the exercise. More jumps at lower quality won't help.</p>\n    <p><strong>Landings.</strong> Land softly with your knees over your toes, never caving in. On box jumps, step down instead of jumping down.</p>\n    <p><strong>Depth jumps.</strong> Step off the box, don't jump off it. Leave the ground again as quickly as you can after landing. If you sink deep before jumping, the box is too high.</p>\n    <p><strong>Approach jumps.</strong> Two or three quick steps, a longer last step, then drive up and reach with one hand. Try both a two-foot and a one-foot takeoff in the first weeks and keep whichever goes higher.</p>\n    <p><strong>Tendons.</strong> Achilles and knee tendons are the weak point in jump training, and your running already loads them. Stiffness that eases with the warm-up is normal. Pain at the front of the knee or in the Achilles that gets worse as you jump means drop the jump volume in half for a week.</p>"}, build(base="28:00"){let state={base};

const RIM = 120;

function ex(n, rx, sets, rest, note, opts){ return Object.assign({n, rx, sets, rest, note, main:false}, opts||{}); }
const REACH = {main:true, reach:true};
const R_JUMP = "Full rest, 60 to 90 sec", R_STR = "Rest 90 sec", R_SHORT = "Rest 60 sec";

const WARM = ex("Jump warm-up","1 round",1,"Straight into the jumps",
  "2 min skipping or a light jog, 10 leg swings each way per leg, 10 walking lunges, then 2 x 20 low ankle hops.");

function approach(n, r, note){ return ex("Approach jump", `${n} x ${r}`, n, R_JUMP, note || "Log your best touch from each set.", REACH); }
function test(){ return ex("Approach jump test", "6 attempts", 1, "Full rest between attempts", "Full warm-up first, then six max attempts. Log only your highest touch.", REACH); }

const A = {
  found:(w)=>[WARM,
    ex("Box jump","4 x 3",4,R_JUMP,"Box around knee height. Jump up, land soft, step down.",{main:true}),
    w===0 ? test() : approach(4,3,"First jump of each set at about 80%, the next two all out. Log your best touch."),
    ex("Bulgarian split squat","3 x 6 each leg",3,R_STR,"Rear foot on a bench. Controlled down, fast up."),
    ex("Straight-leg calf raise","3 x 12",3,R_SHORT,"Full stretch at the bottom, pause at the top.")],
  react:(w)=>[WARM,
    ex("Depth jump","4 x 3",4,R_JUMP,"12 inch box to start, 18 inch from week 5. Step off, land, jump straight back up.",{main:true}),
    w===4 ? test() : approach(5,2),
    ex("Bulgarian split squat","3 x 5 each leg",3,R_STR,"Heavier than weeks 1 and 2."),
    ex("Straight-leg calf raise","3 x 10",3,R_SHORT,"Add weight when 12 is easy.")],
  light:()=>[WARM,
    ex("Box jump","3 x 3",3,R_JUMP,"Easy height, crisp reps.",{main:true}),
    approach(3,2,"About 80%. Smooth and fast, not max effort."),
    ex("Bulgarian split squat","2 x 6 each leg",2,R_STR)],
  peak:()=>[WARM,
    ex("Depth jump","3 x 3",3,R_JUMP,"18 inch box. Fewer reps, every one all out.",{main:true}),
    approach(6,1,"One jump per set with full rest. Go for the backboard, or try dunking a volleyball or tennis ball. Log your best touch."),
    ex("Bulgarian split squat","2 x 5 each leg",2,R_STR),
    ex("Straight-leg calf raise","2 x 10",2,R_SHORT)],
  primer:()=>[WARM,
    ex("Box jump","2 x 3",2,R_JUMP,"Easy height.",{main:true}),
    approach(3,1,"About 90%. Leave fresh.")]
};
const B = {
  found:()=>[WARM,
    ex("Pogo hops","3 x 15",3,R_SHORT,"Stiff ankles, bounce off the balls of your feet, minimal knee bend.",{main:true}),
    ex("Broad jump","4 x 3",4,R_JUMP,"Stick each landing for a second before the next jump.",{main:true}),
    ex("Single-leg box jump","3 x 3 each leg",3,R_JUMP,"Low box. Land on the same leg and hold it.",{main:true}),
    ex("Nordic curl or hamstring slide","3 x 5",3,R_STR,"Lower as slowly as you can. Protects your hamstrings for sprinting and jumping."),
    ex("Tibialis raise","2 x 15",2,R_SHORT,"Back against a wall, heels out, lift your toes. Protects shins and knees.")],
  react:()=>[WARM,
    ex("Pogo hops","3 x 20",3,R_SHORT,"Quicker contacts than weeks 1 and 2.",{main:true}),
    ex("Single-leg bounds","3 x 4 each leg",3,R_JUMP,"Hop forward on one leg for distance, springy, no pause between hops.",{main:true}),
    ex("Consecutive broad jumps","3 x 3",3,R_JUMP,"Three in a row, springing straight into the next one.",{main:true}),
    ex("Nordic curl or hamstring slide","3 x 5",3,R_STR),
    ex("Tibialis raise","2 x 15",2,R_SHORT)],
  light:()=>[WARM,
    ex("Pogo hops","2 x 15",2,R_SHORT,null,{main:true}),
    ex("Broad jump","3 x 2",3,R_JUMP,null,{main:true}),
    ex("Tibialis raise","2 x 15",2,R_SHORT)],
  peak:()=>[WARM,
    ex("Pogo hops","2 x 20",2,R_SHORT,null,{main:true}),
    approach(4,2,"Use your weaker takeoff, one foot or two, to keep it progressing too. Log your best touch."),
    ex("Broad jump","3 x 2",3,R_JUMP,null,{main:true}),
    ex("Tibialis raise","2 x 15",2,R_SHORT)],
  test:()=>[WARM, test(),
    ex("Dunk attempts","Up to 6",6,"Full rest","Tennis ball first, then a volleyball or mini ball, then a basketball if the touch height is there. Stop when jumps start dropping.",{main:true})]
};

const PHASES = {
  found:{name:"Foundation", span:"Weeks 1 and 2"},
  react:{name:"Reactive", span:"Weeks 3 to 5"},
  peak:{name:"Peak", span:"Weeks 6 and 7"},
  test:{name:"Test", span:"Week 8"}
};
const NOTES = [
  "Test day on Session A. Your best touch sets the starting point for the whole block.",
  "Learn to land well and jump with full intent. Try to beat last week's touch on the approach jumps.",
  "Depth jumps start now. They teach your legs to store and release energy fast.",
  "Same work. Keep depth jump landings quick and quiet before you think about a higher box.",
  "Checkpoint test on Session A. Any gain over week 1 means the plan is working. Move the depth jump box to 18 inches if landings have been quick and controlled.",
  "Lower volume, highest intent. Every jump is a max attempt.",
  "Last hard week. Short sessions, fully rested jumps.",
  "Light Session A early in the week, then at least two days of rest before the test."
];
function makeWeeks(){
  const plan = ["found","found","react","react","react","peak","peak","test"];
  return plan.map((p,w) => ({
    phase:p, flag: w===4, note: NOTES[w],
    d1: p==="test" ? A.primer() : A[p](w),
    d2: B[p]()
  }));
}
let WEEKS = makeWeeks();

const DAY_INFO = {
  d1:{title:"Session A: Vertical", purpose:"Straight-up jumping and approach jumps, then single-leg strength and calves."},
  d2:{title:"Session B: Elastic", purpose:"Fast, springy jumps, then hamstring and shin work to keep your joints healthy."}
};
DAY_INFO.test_d1 = {title:"Session A: Primer", purpose:"Short and light, early in the week."};
DAY_INFO.test_d2 = {title:"Session B: Test day", purpose:"Your end-of-block jump test, then dunk attempts."};


return {weeks:WEEKS,phases:PHASES,days:DAY_INFO};}};
window.ForgeGoalPlans=Object.freeze(plans);
})();