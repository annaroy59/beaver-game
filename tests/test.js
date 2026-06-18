const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlRaw = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const gameJs = fs.readFileSync(path.join(root, 'src', 'game.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const reviewsJs = fs.readFileSync(path.join(root, 'reviews', 'reviews.js'), 'utf8');
const html = htmlRaw
    .replace('<link rel="stylesheet" href="src/styles.css">', '<style>' + stylesCss + '</style>')
    .replace('<script src="reviews/reviews.js"></script>\n    <script src="src/game.js"></script>', '<script>' + reviewsJs + '\n' + gameJs + '</script>');

let dom, document, window;

function setup() {
    dom = new JSDOM(html, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'http://localhost',
        resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;

    const storage = {};
    window.localStorage = {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; },
        clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    };
}

function teardown() {
    dom.window.close();
}

const results = [];
let testCount = 0;
function test(name) {
    testCount++;
    console.log(`${testCount}. ${name}`);
}
function assert(condition, name) {
    results.push({ name, pass: !!condition });
    if (!condition) console.log(`  FAIL: ${name}`);
}

function getGameState() {
    return window.eval(`({
        snake: JSON.parse(JSON.stringify(beaver)),
        direction: {...direction},
        food: {...food},
        score: score,
        gameOver: gameOver,
        gameWon: gameWon,
        gameRunning: gameRunning,
        settings: JSON.parse(JSON.stringify(settings)),
        GRID: GRID,
        TILE: TILE,
        currentSpeed: currentSpeed
    })`);
}

function pressKey(key) {
    window.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true }))`);
}

function runGameTicks(n) {
    window.eval(`for(let i=0;i<${n};i++) gameTick()`);
}

// === Tests ===

console.log('\n=== Beaver Game Tests ===\n');

// 1. Initial state
test('Initial state');
setup();
const s1 = getGameState();
assert(s1.snake.length === 1, 'beaver starts with 1 segment');
assert(s1.snake[0].x === 6 && s1.snake[0].y === 6, 'beaver starts at center');
assert(s1.direction.x === 1 && s1.direction.y === 0, 'initial direction is right');
assert(s1.score === 0, 'score starts at 0');
assert(s1.gameOver === false, 'gameOver is false');
assert(s1.gameWon === false, 'gameWon is false');
assert(s1.gameRunning === false, 'gameRunning is false before keypress');
assert(s1.food.x >= 0 && s1.food.x < s1.GRID, 'food x in range');
assert(s1.food.y >= 0 && s1.food.y < s1.GRID, 'food y in range');
teardown();

// 2. Game starts on movement key
test('Game starts on movement key');
setup();
pressKey('ArrowRight');
const s2 = getGameState();
assert(s2.gameRunning === true, 'gameRunning is true after keypress');
assert(s2.direction.x === 1 && s2.direction.y === 0, 'direction is right after ArrowRight');
teardown();

// 3. Start direction matches key
test('Start direction matches key');
setup();
pressKey('ArrowLeft');
const s3 = getGameState();
assert(s3.direction.x === -1 && s3.direction.y === 0, 'ArrowLeft sets direction left');
teardown();

setup();
pressKey('ArrowUp');
const s3b = getGameState();
assert(s3b.direction.x === 0 && s3b.direction.y === -1, 'ArrowUp sets direction up');
teardown();

setup();
pressKey('ArrowDown');
const s3c = getGameState();
assert(s3c.direction.x === 0 && s3c.direction.y === 1, 'ArrowDown sets direction down');
teardown();

setup();
pressKey('w');
const s3d = getGameState();
assert(s3d.direction.x === 0 && s3d.direction.y === -1, 'w sets direction up');
teardown();

// 4. Beaver moves correctly
test('Beaver movement');
setup();
window.eval(`beaver = [{x:3,y:6}]`);
pressKey('ArrowRight');
runGameTicks(3);
const s4 = getGameState();
assert(s4.snake[0].x === 6, 'beaver head moves right by 3');
assert(s4.snake[0].y === 6, 'y unchanged');
teardown();

// 5. Beaver can reverse with 1 segment
test('Beaver can reverse with 1 segment');
setup();
window.eval(`settings.teleportersEnabled = false; teleporters = [];`);
pressKey('ArrowRight');
runGameTicks(1);
pressKey('ArrowLeft');
runGameTicks(1);
const s5 = getGameState();
assert(s5.direction.x === -1, 'can reverse from right to left with 1 segment');
teardown();

// 6. Wall collision
test('Wall collision');
setup();
window.eval(`beaver = [{x: 11, y: 10}]; direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;`);
runGameTicks(1);
const s6 = getGameState();
assert(s6.gameOver === true, 'game over on wall collision');
assert(s6.gameRunning === false, 'gameRunning false after game over');
teardown();

// 7. Self collision
test('Self collision');
setup();
window.eval(`
    beaver = [{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5}];
    direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;
`);
runGameTicks(1);
const s7 = getGameState();
assert(s7.gameOver === true, 'game over on self collision');
teardown();

// 8. Food eating
test('Food eating');
setup();
pressKey('ArrowRight');
window.eval(`food = {x: 7, y: 6}`);
runGameTicks(1);
const s8 = getGameState();
assert(s8.score === 1, 'score increments on eating food');
assert(s8.snake.length === 2, 'beaver grows by 1');
teardown();

// 9. Food respawns away from snake
test('Food respawns away from beaver');
setup();
pressKey('ArrowRight');
window.eval(`food = {x: 7, y: 6};`);
runGameTicks(1);
const s9 = getGameState();
const onSnake = s9.snake.some(s => s.x === s9.food.x && s.y === s9.food.y);
assert(!onSnake, 'new food not on beaver');
teardown();

// 10. Default settings
test('Default settings');
setup();
const s10 = getGameState();
assert(s10.settings.startSpeed === 150, 'default start speed is 150');
assert(s10.settings.speedUp === true, 'default speedUp is true');
assert(s10.settings.winEnabled === false, 'default winEnabled is false');
assert(s10.settings.winLength === 20, 'default winLength is 20');
assert(s10.settings.gridSize === 12, 'default gridSize is 12');
teardown();

// 11. Speed increase every 3 foods
test('Speed increases every 3 foods');
setup();
window.eval(`beaver = [{x:3,y:6}]`);
pressKey('ArrowRight');
for (let i = 0; i < 3; i++) {
    window.eval(`food = {x: beaver[0].x + 1, y: beaver[0].y}`);
    runGameTicks(1);
}
const s11 = getGameState();
assert(s11.currentSpeed === 140, 'speed decreased by 10 after 3 foods');
teardown();

// 12. Win condition
test('Win condition');
setup();
window.eval(`
    settings.winEnabled = true;
    settings.winLength = 5;
    beaver = [{x:3,y:6}];
    gameRunning = true;
    direction = {x:1,y:0}; nextDirection = {x:1,y:0};
`);
for (let i = 0; i < 4; i++) {
    window.eval(`food = {x: beaver[0].x + 1, y: beaver[0].y}`);
    runGameTicks(1);
}
const s12 = getGameState();
assert(s12.gameWon === true, 'gameWon is true when reaching win length');
assert(s12.snake.length >= 5, 'beaver length >= win length');
teardown();

// 13. WASD controls
test('WASD controls');
setup();
pressKey('s');
const s13 = getGameState();
assert(s13.direction.x === 0 && s13.direction.y === 1, 's sets direction down');
teardown();

setup();
pressKey('d');
const s13b = getGameState();
assert(s13b.direction.x === 1 && s13b.direction.y === 0, 'd sets direction right');
teardown();

// 14. Game restarts after game over
test('Game restarts after game over');
setup();
window.eval(`
    gameOver = true; gameRunning = false;
    beaver = [{x:0,y:0}]; score = 5;
`);
pressKey('ArrowRight');
const s14 = getGameState();
assert(s14.gameRunning === true, 'game restarts after game over');
assert(s14.snake.length === 1, 'beaver resets to length 1');
assert(s14.score === 0, 'score resets to 0');
teardown();

// 15. Food stays same position on game start
test('Food position preserved on start');
setup();
const foodBefore = getGameState().food;
pressKey('ArrowRight');
const foodAfter = getGameState().food;
assert(foodBefore.x === foodAfter.x && foodBefore.y === foodAfter.y, 'food position unchanged on start');
teardown();

// 16. Speed does not go below 50
test('Speed minimum cap');
setup();
window.eval(`beaver = [{x:3,y:6}]`);
pressKey('ArrowRight');
window.eval(`currentSpeed = 60; settings.startSpeed = 60;`);
for (let i = 0; i < 3; i++) {
    window.eval(`food = {x: beaver[0].x + 1, y: beaver[0].y}`);
    runGameTicks(1);
}
const s16 = getGameState();
assert(s16.currentSpeed === 50, 'speed stops at 50 minimum');
teardown();

// 17. Speed increase disabled in settings
test('Speed increase disabled');
setup();
window.eval(`settings.speedUp = false; beaver = [{x:3,y:6}]`);
pressKey('ArrowRight');
for (let i = 0; i < 6; i++) {
    window.eval(`food = {x: beaver[0].x + 1, y: beaver[0].y}`);
    runGameTicks(1);
}
const s17 = getGameState();
assert(s17.currentSpeed === 150, 'speed unchanged when speedUp disabled');
teardown();

// 18. Win does not trigger when disabled
test('Win disabled ignores length');
setup();
window.eval(`
    settings.winEnabled = false;
    settings.winLength = 3;
    beaver = [{x:3,y:6}];
    gameRunning = true;
    direction = {x:1,y:0}; nextDirection = {x:1,y:0};
`);
for (let i = 0; i < 3; i++) {
    window.eval(`food = {x: beaver[0].x + 1, y: beaver[0].y}`);
    runGameTicks(1);
}
const s18 = getGameState();
assert(s18.gameWon === false, 'gameWon false when win disabled');
assert(s18.snake.length === 4, 'beaver length is 4');
teardown();

// 19. Score persists in game state
test('Multiple food eating');
setup();
window.eval(`beaver = [{x:3,y:6}]`);
pressKey('ArrowRight');
for (let i = 0; i < 5; i++) {
    window.eval(`food = {x: beaver[0].x + 1, y: beaver[0].y}`);
    runGameTicks(1);
}
const s19 = getGameState();
assert(s19.score === 5, 'score tracks multiple foods');
assert(s19.snake.length === 6, 'beaver length after 5 foods');
teardown();

// 20. Game over stops game loop
test('Game over stops updates');
setup();
pressKey('ArrowRight');
runGameTicks(1);
window.eval(`beaver[0].x = 11; beaver[0].y = 10;`);
runGameTicks(1);
const s20 = getGameState();
assert(s20.gameOver === true, 'gameOver is true');
const len = s20.snake.length;
runGameTicks(5);
const s20b = getGameState();
assert(s20b.snake.length === len, 'beaver unchanged after game over');
teardown();

// 21. Direction changes mid-game
test('Direction changes mid-game');
setup();
pressKey('ArrowRight');
runGameTicks(2);
pressKey('ArrowDown');
runGameTicks(2);
const s21 = getGameState();
assert(s21.direction.x === 0 && s21.direction.y === 1, 'direction changed to down');
teardown();

// 22. High score updates on game over
test('High score updates');
setup();
window.eval(`highScore = 0; score = 10; gameOver = false; gameRunning = true;`);
window.eval(`endGame()`);
const s22 = getGameState();
const hs = window.eval(`highScore`);
assert(hs === 10, 'high score updated to 10');
teardown();

// 23. Consecutive losses tracking
test('Consecutive losses tracking');
setup();
window.eval(`gameRunning = true; gameOver = false;`);
window.eval(`endGame()`);
const cl1 = window.eval(`consecutiveLosses`);
assert(cl1 === 1, 'consecutive losses is 1 after first loss');
window.eval(`gameOver = false; gameRunning = true;`);
window.eval(`endGame()`);
const cl2 = window.eval(`consecutiveLosses`);
assert(cl2 === 2, 'consecutive losses is 2 after second loss');
teardown();

// 24. Win resets consecutive losses
test('Win resets consecutive losses');
setup();
window.eval(`consecutiveLosses = 3; gameRunning = true; gameOver = false;`);
window.eval(`endGame()`);
const cl3before = window.eval(`consecutiveLosses`);
assert(cl3before === 4, 'consecutive losses is 4 after endGame');
window.eval(`gameWon = false; gameRunning = true;`);
window.eval(`winGame()`);
const cl3after = window.eval(`consecutiveLosses`);
assert(cl3after === 0, 'consecutive losses reset to 0 after win');
teardown();

// 25. Auto-play AI moves toward food
test('Auto-play AI moves toward food');
setup();
window.eval(`autoPlay = true; beaver = [{x:5,y:5}]; food = {x:8,y:5};`);
window.eval(`direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;`);
window.eval(`aiMove()`);
const nd25 = window.eval(`nextDirection`);
assert(nd25.x === 1 && nd25.y === 0, 'AI moves right toward food');
teardown();

// 26. Auto-play avoids walls
test('Auto-play avoids walls');
setup();
window.eval(`autoPlay = true; beaver = [{x:11,y:5}]; food = {x:11,y:8};`);
window.eval(`direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;`);
window.eval(`aiMove()`);
const nd26 = window.eval(`nextDirection`);
assert(nd26.x === 0, 'AI does not move into wall');
teardown();

// 27. Auto-play avoids self
test('Auto-play avoids self-collision');
setup();
window.eval(`autoPlay = true; beaver = [{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5}]; food = {x:4,y:5};`);
window.eval(`direction = {x:0,y:-1}; nextDirection = {x:0,y:-1}; gameRunning = true;`);
window.eval(`aiMove()`);
const nd27 = window.eval(`nextDirection`);
const headX = window.eval(`beaver[0].x`);
const headY = window.eval(`beaver[0].y`);
const nextX = headX + nd27.x;
const nextY = headY + nd27.y;
    const onBody = window.eval(`beaver.some((s,i) => i > 0 && s.x === ${nextX} && s.y === ${nextY})`);
    const g = window.eval(`GRID`);
    const inBounds = nextX >= 0 && nextX < g && nextY >= 0 && nextY < g;
    assert(inBounds && !onBody, 'AI picks safe direction');
teardown();

// 28. Spacebar starts auto-play
test('Spacebar starts auto-play');
setup();
pressKey(' ');
const s28 = getGameState();
assert(s28.gameRunning === true, 'game running after spacebar');
const ap = window.eval(`autoPlay`);
assert(ap === true, 'autoPlay enabled after spacebar');
teardown();

// 29. Corn spawns randomly
test('Corn spawns randomly');
setup();
window.eval(`gameRunning = true; direction={x:0,y:1}; nextDirection={x:0,y:1}; beaver=[{x:6,y:3}]`);
let cornFound = false;
for (let i = 0; i < 100; i++) {
    window.eval(`gameTick()`);
    if (window.eval(`powerups.some(p=>p.type==="shield")`)) { cornFound = true; break; }
}
assert(cornFound, 'corn spawned after many ticks');
teardown();

// 30. Eating corn gives shield
test('Eating corn gives shield');
setup();
window.eval(`beaver = [{x:5,y:5}]; powerups = [{type:"shield",x:6,y:5,born:Date.now()}]; bonuses.delete("shield"); gameRunning = true; direction={x:1,y:0}; nextDirection={x:1,y:0};`);
runGameTicks(1);
const shieldAfter = window.eval(`bonuses.has("shield")`);
assert(shieldAfter === true, 'hasShield is true after eating corn');
const cornPos = window.eval(`powerups.find(p=>p.type==="shield")`);
const cornEaten = !cornPos || cornPos.x !== 6 || cornPos.y !== 5;
assert(cornEaten, 'original corn at (6,5) was eaten');
teardown();

// 31. Duplicate corn eating doesn't double shield
test('Duplicate corn does not double shield');
setup();
window.eval(`beaver = [{x:5,y:5}]; powerups = [{type:"shield",x:6,y:5,born:Date.now()}]; bonuses.add("shield"); gameRunning = true; direction={x:1,y:0}; nextDirection={x:1,y:0};`);
runGameTicks(1);
const shieldDup = window.eval(`bonuses.has("shield")`);
assert(shieldDup === true, 'shield stays true (not doubled)');
const cornAfterDup = window.eval(`powerups.find(p=>p.type==="shield")`);
const cornConsumedDup = !cornAfterDup || cornAfterDup.x !== 6 || cornAfterDup.y !== 5;
assert(cornConsumedDup, 'corn still consumed even with active shield');
teardown();

// 32. Corn does not spawn when shield is active
test('No corn spawn with active shield');
setup();
window.eval(`bonuses.add("shield"); powerups = []; gameRunning = true; beaver = [{x:6,y:6}]; direction={x:1,y:0}; nextDirection={x:1,y:0};`);
for (let i = 0; i < 5; i++) {
    window.eval(`gameTick()`);
}
const cornWithShield = window.eval(`powerups.find(p=>p.type==="shield")`);
assert(!cornWithShield, 'corn does not spawn when shield active');
teardown();

// 33. Shield prevents wall collision
test('Shield prevents wall collision');
setup();
window.eval(`settings.teleportersEnabled = false; teleporters = []; beaver = [{x:11,y:5}]; bonuses.add("shield"); direction={x:1,y:0}; nextDirection={x:1,y:0}; gameRunning = true;`);
runGameTicks(1);
const s33 = getGameState();
assert(s33.gameOver === false, 'game not over thanks to shield dodge');
const shield33 = window.eval(`bonuses.has("shield")`);
assert(shield33 === false, 'shield consumed after wall dodge');
teardown();

// 34. Shield prevents self collision
test('Shield prevents self collision');
setup();
window.eval(`
    beaver = [{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5}];
    direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;
    bonuses.add("shield");
`);
runGameTicks(1);
const s34 = getGameState();
assert(s34.gameOver === false, 'game not over thanks to shield dodge');
const shield34 = window.eval(`bonuses.has("shield")`);
assert(shield34 === false, 'shield consumed after self-collision dodge');
teardown();

// 35. Shield resets on new game
test('Shield resets on init');
setup();
window.eval(`bonuses.add("shield"); powerups = [{type:"shield",x:3,y:3,born:Date.now()}]`);
window.eval(`init()`);
const afterInit = window.eval(`bonuses.has("shield")`);
const cornInit = window.eval(`powerups.length`);
assert(!afterInit, 'shield removed after init');
assert(cornInit === 0, 'powerups empty after init');
teardown();

// 36. Corn eaten even when collision is about to happen
test('Corn eaten before shield dodge');
setup();
window.eval(`
    beaver = [{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5}];
    powerups = [{type:"shield",x:6,y:5,born:Date.now()}];
    bonuses.delete("shield");
    direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;
`);
runGameTicks(1);
const s36 = getGameState();
assert(s36.gameOver === false, 'game not over after corn + dodge');
const shield36 = window.eval(`bonuses.has("shield")`);
assert(shield36 === false, 'shield consumed after dodge');
teardown();

// 37. Pause toggles on Enter
test('Pause toggles on Enter');
setup();
pressKey('ArrowRight');
const s37a = getGameState();
assert(s37a.gameRunning === true, 'game running before pause');
pressKey('Enter');
const paused37 = window.eval(`paused`);
assert(paused37 === true, 'paused is true after Enter');
pressKey('Enter');
const paused37b = window.eval(`paused`);
assert(paused37b === false, 'paused is false after second Enter');
teardown();

// 38. Cannot reverse direction with multiple segments
test('Cannot reverse with multiple segments');
setup();
window.eval(`beaver = [{x:5,y:5},{x:5,y:6}]; direction={x:1,y:0}; nextDirection={x:1,y:0}; gameRunning = true;`);
pressKey('ArrowLeft');
const nd38 = window.eval(`nextDirection`);
assert(nd38.x === 1 && nd38.y === 0, 'direction unchanged when reversing with 2 segments');
teardown();

// 39. Shift starts game
test('Shift starts game');
setup();
pressKey('Shift');
const s39 = getGameState();
assert(s39.gameRunning === true, 'game running after Shift');
assert(s39.direction.x === 0 && s39.direction.y === -1, 'Shift sets direction up');
teardown();

// 40. findSafeDirection returns null when trapped
test('findSafeDirection returns null when trapped');
setup();
window.eval(`
    settings.teleportersEnabled = false;
    teleporters = [];
    beaver = [{x:0,y:0},{x:1,y:0},{x:0,y:1}];
    direction = {x:1,y:0};
`);
const safeDir = window.eval(`findSafeDirection()`);
assert(safeDir === null, 'findSafeDirection returns null when fully surrounded');
teardown();

// 41. Game over when shield has no safe direction
test('Shield cannot save when trapped');
setup();
window.eval(`
    settings.teleportersEnabled = false;
    teleporters = [];
    beaver = [{x:0,y:0},{x:1,y:0},{x:0,y:1}];
    bonuses.add("shield");
    direction = {x:-1,y:0}; nextDirection = {x:-1,y:0}; gameRunning = true;
`);
runGameTicks(1);
const s41 = getGameState();
assert(s41.gameOver === true, 'game over even with shield when no escape');
teardown();

// 42. Restart after win
test('Restart after win');
setup();
window.eval(`gameWon = true; gameRunning = false;`);
pressKey('ArrowRight');
const s42 = getGameState();
assert(s42.gameRunning === true, 'game restarts after win');
assert(s42.gameWon === false, 'gameWon reset after restart');
assert(s42.snake.length === 1, 'beaver resets to length 1');
teardown();

// 43. Teleporter teleportation
test('Teleporter teleportation');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() },
        { behind: {x:12,y:5}, entry: {x:11,y:5}, dir: {x:-1,y:0}, born: Date.now() }
    ];
    beaver = [{x:11,y:5}]; direction={x:1,y:0}; nextDirection={x:1,y:0}; gameRunning = true;
`);
runGameTicks(1);
const s43 = getGameState();
assert(s43.snake[0].x === 0 && s43.snake[0].y === 5, 'beaver teleported to other entry');
teardown();

// 44. Teleporter isSafe for behind position
test('Teleporter behind position is safe');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() }
    ];
`);
const isSafeTp = window.eval(`isSafe(-1, 5)`);
assert(isSafeTp === true, 'teleporter behind position is safe');
const isSafeWall = window.eval(`isSafe(-2, 5)`);
assert(isSafeWall === false, 'non-teleporter out-of-bounds is not safe');
teardown();

// 45. High score persists in localStorage
test('High score saved to localStorage');
setup();
window.eval(`highScore = 0; score = 7; gameOver = false; gameRunning = true;`);
window.eval(`endGame()`);
const stored = window.eval(`localStorage.getItem('beaverHighScore')`);
assert(stored === '7', 'high score saved to localStorage');
teardown();

// 46. High score does not update when score is lower
test('High score not updated on lower score');
setup();
window.eval(`highScore = 10; score = 5; gameOver = false; gameRunning = true;`);
window.eval(`endGame()`);
const hs46 = window.eval(`highScore`);
assert(hs46 === 10, 'high score stays 10 when score is 5');
teardown();

// 47. Settings save and load
test('Settings save and load');
setup();
window.eval(`settings.startSpeed = 100; settings.speedUp = false; settings.winEnabled = true; settings.winLength = 15; settings.teleportersEnabled = false; settings.gridSize = 14;`);
window.eval(`localStorage.setItem('beaverSettings', JSON.stringify(settings))`);
window.eval(`settings.startSpeed = 150; settings.speedUp = true;`);
const saved47 = window.eval(`JSON.parse(localStorage.getItem('beaverSettings'))`);
assert(saved47.startSpeed === 100, 'saved startSpeed is 100');
assert(saved47.speedUp === false, 'saved speedUp is false');
assert(saved47.winEnabled === true, 'saved winEnabled is true');
assert(saved47.winLength === 15, 'saved winLength is 15');
assert(saved47.teleportersEnabled === false, 'saved teleportersEnabled is false');
assert(saved47.gridSize === 14, 'saved gridSize is 14');
teardown();

// 48. Teleporter teleportation preserves direction
test('Teleporter sets new direction');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() },
        { behind: {x:12,y:5}, entry: {x:11,y:5}, dir: {x:-1,y:0}, born: Date.now() }
    ];
    beaver = [{x:11,y:5}]; direction={x:1,y:0}; nextDirection={x:1,y:0}; gameRunning = true;
`);
runGameTicks(1);
const s48 = getGameState();
assert(s48.snake[0].x === 0 && s48.snake[0].y === 5, 'head teleported');
const dir48 = window.eval(`direction`);
assert(dir48.x === 1 && dir48.y === 0, 'direction set to teleporter exit dir');
teardown();

// 49. Consecutive losses persist across restarts
test('Consecutive losses persist on restart');
setup();
window.eval(`consecutiveLosses = 3; gameRunning = true; gameOver = false;`);
window.eval(`endGame()`);
const cl49 = window.eval(`consecutiveLosses`);
assert(cl49 === 4, 'consecutive losses is 4 after endGame');
window.eval(`gameOver = false; gameWon = false;`);
pressKey('ArrowRight');
const cl49after = window.eval(`consecutiveLosses`);
assert(cl49after === 4, 'consecutive losses stay 4 after restart');
teardown();

// 50. Teleporter enabled setting
test('Teleporters disabled in settings');
setup();
window.eval(`teleporters = []; settings.teleportersEnabled = false;`);
window.eval(`spawnTeleporters()`);
const tp50 = window.eval(`teleporters.length`);
assert(tp50 === 0, 'no teleporters when disabled');
teardown();

// 51. Reviews contain no hieroglyphs
test('Reviews have no hieroglyphs');
setup();
const reviewsData = window.eval(`reviews`);
const latinRe = /[a-zA-Z]/;
const cyrillicRe = /[а-яА-ЯёЁ]/;
const allowedRe = /^[\u0020-\u007E\u00A0-\u00FF\u0400-\u04FF\u2010-\u2027\u2030-\u205E\u2190-\u21FF\u2600-\u26FF\u2700-\u27BF★☆.,:;!?()\-\"'«»]+$/;
let hieroglyphFound = false;
let badReview = '';
for (const r of reviewsData) {
    const text = r.name + ' ' + r.text + ' ' + r.date + ' ' + r.version;
    if (!allowedRe.test(text)) {
        hieroglyphFound = true;
        badReview = r.name + ': ' + text.substring(0, 40);
        break;
    }
}
assert(!hieroglyphFound, hieroglyphFound ? 'hieroglyph found in: ' + badReview : 'no hieroglyphs in reviews');
teardown();

// 52. Magnet spawns randomly
test('Magnet spawns randomly');
setup();
window.eval(`gameRunning = true; direction={x:0,y:1}; nextDirection={x:0,y:1}; beaver=[{x:6,y:3}]`);
let magnetFound = false;
for (let i = 0; i < 100; i++) {
    window.eval(`gameTick()`);
    if (window.eval(`powerups.some(p=>p.type==="magnet")`)) { magnetFound = true; break; }
}
assert(magnetFound, 'magnet spawned after many ticks');
teardown();

// 53. Eating magnet gives magnet bonus
test('Eating magnet gives magnet bonus');
setup();
window.eval(`beaver = [{x:5,y:5}]; powerups = [{type:"magnet",x:6,y:5,born:Date.now()}]; bonuses.delete("magnet"); gameRunning = true; direction={x:1,y:0}; nextDirection={x:1,y:0};`);
runGameTicks(1);
const mag53 = window.eval(`bonuses.has("magnet")`);
assert(mag53 === true, 'hasMagnet is true after eating magnet');
teardown();

// 54. Magnet pulls food directly to head and it gets eaten
test('Magnet pulls food and beaver eats it');
setup();
window.eval(`
    beaver = [{x:5,y:5}]; food = {x:5,y:8};
    bonuses.add("magnet"); magnetBorn = Date.now();
    gameRunning = true; direction={x:0,y:1}; nextDirection={x:0,y:1};
`);
runGameTicks(1);
const s54 = getGameState();
assert(s54.score === 1, 'food eaten after magnet pull');
assert(s54.snake.length === 2, 'beaver grew after magnet pull');
teardown();

// 55. Magnet does not pull food beyond 3 cells
test('Magnet does not pull beyond 3 cells');
setup();
window.eval(`
    beaver = [{x:5,y:5}]; food = {x:5,y:10};
    bonuses.add("magnet"); magnetBorn = Date.now();
    gameRunning = true; direction={x:0,y:1}; nextDirection={x:0,y:1};
`);
runGameTicks(1);
const food55 = window.eval(`food`);
assert(food55.y === 10, 'food not pulled when distance > 3');
teardown();

// 56. Magnet timer expires after 10 seconds
test('Magnet timer expires');
setup();
window.eval(`
    bonuses.add("magnet"); magnetBorn = Date.now() - 10001;
    gameRunning = true; direction={x:0,y:1}; nextDirection={x:0,y:1}; beaver=[{x:5,y:5}];
`);
runGameTicks(1);
const mag56 = window.eval(`bonuses.has("magnet")`);
assert(mag56 === false, 'magnet expired after 10 seconds');
teardown();

// 57. Magnet and shield are independent
test('Magnet and shield are independent');
setup();
window.eval(`bonuses.add("shield"); bonuses.add("magnet"); magnetBorn = Date.now();`);
const both = window.eval(`bonuses.has("shield") && bonuses.has("magnet")`);
assert(both === true, 'both shield and magnet active simultaneously');
teardown();

// 58. Magnet resets timer on re-collect
test('Magnet resets timer on re-collect');
setup();
window.eval(`
    bonuses.add("magnet"); magnetBorn = Date.now() - 5000;
    beaver = [{x:5,y:5}]; powerups = [{type:"magnet",x:6,y:5,born:Date.now()}];
    gameRunning = true; direction={x:1,y:0}; nextDirection={x:1,y:0};
`);
runGameTicks(1);
const magBorn58 = window.eval(`magnetBorn`);
const recent58 = Date.now() - magBorn58 < 1000;
assert(recent58, 'magnet timer reset on re-collect');
teardown();

// 59. Magnet resets on init
test('Magnet resets on init');
setup();
window.eval(`bonuses.add("magnet"); magnetBorn = Date.now()`);
window.eval(`init()`);
const magAfterInit = window.eval(`bonuses.has("magnet")`);
assert(!magAfterInit, 'magnet removed after init');
teardown();

// 60. escapeHtml prevents XSS
test('escapeHtml prevents XSS');
setup();
const xss = window.eval(`escapeHtml('<script>alert(1)</script>')`);
assert(!xss.includes('<'), 'escapeHtml escapes <');
assert(!xss.includes('>'), 'escapeHtml escapes >');
teardown();

// 61. sliderToDelay / delayToSlider round-trip
test('sliderToDelay / delayToSlider conversion');
setup();
const std1 = window.eval(`sliderToDelay(1)`);
assert(std1 === 300, 'sliderToDelay(1) = 300 (clamped)');
const std5 = window.eval(`sliderToDelay(5)`);
assert(std5 === 200, 'sliderToDelay(5) = 200');
const std10 = window.eval(`sliderToDelay(10)`);
assert(std10 === 50, 'sliderToDelay(10) = 50');
const dts1 = window.eval(`delayToSlider(300)`);
assert(dts1 === 2, 'delayToSlider(300) = 2');
const dts5 = window.eval(`delayToSlider(200)`);
assert(dts5 === 5, 'delayToSlider(200) = 5');
teardown();

// 62. Grid size change clamps beaver position
test('Grid size change clamps beaver position');
setup();
window.eval(`beaver = [{x:14,y:14}]; food = {x:13,y:13}; prevBeaver = [{x:14,y:14}];`);
window.eval(`settings.gridSize = 10; applyGridSize()`);
const clamped = window.eval(`beaver[0].x`);
const clampedFood = window.eval(`food.x`);
assert(clamped === 9, 'beaver x clamped to GRID-1');
assert(clampedFood === 9, 'food x clamped to GRID-1');
teardown();

// 63. ESC closes settings overlay
test('ESC closes settings overlay');
setup();
window.eval(`settingsOverlay.classList.add('active')`);
pressKey('Escape');
const closed = window.eval(`settingsOverlay.classList.contains('active')`);
assert(closed === false, 'settings closed on ESC');
teardown();

// 64. ESC closes reviews overlay
test('ESC closes reviews overlay');
setup();
window.eval(`reviewsOverlay.classList.add('active')`);
pressKey('Escape');
const closedR = window.eval(`reviewsOverlay.classList.contains('active')`);
assert(closedR === false, 'reviews closed on ESC');
teardown();

// 65. ESC closes help overlay
test('ESC closes help overlay');
setup();
window.eval(`helpOverlay.classList.add('active')`);
pressKey('Escape');
const closedH = window.eval(`helpOverlay.classList.contains('active')`);
assert(closedH === false, 'help closed on ESC');
teardown();

// 66. Space toggles autoPlay off during game
test('Space toggles autoPlay off during game');
setup();
pressKey(' ');
const ap1 = window.eval(`autoPlay`);
assert(ap1 === true, 'autoPlay on after spacebar');
pressKey(' ');
const ap2 = window.eval(`autoPlay`);
assert(ap2 === false, 'autoPlay off after second spacebar');
teardown();

// 67. Space during game over restarts with auto-play
test('Space restarts with auto-play after game over');
setup();
window.eval(`gameOver = true; gameRunning = false;`);
pressKey(' ');
const s67 = getGameState();
assert(s67.gameRunning === true, 'game running after space restart');
const ap67 = window.eval(`autoPlay`);
assert(ap67 === true, 'autoPlay enabled on space restart');
teardown();

// 68. getTarget prefers nearer powerup over food
test('getTarget prefers nearer powerup');
setup();
window.eval(`
    beaver = [{x:5,y:5}];
    food = {x:10,y:10};
    powerups = [{type:"shield",x:6,y:5,born:Date.now()}];
`);
const target = window.eval(`getTarget()`);
assert(target.type === 'shield', 'getTarget picks closer powerup over distant food');
teardown();

// 69. getTarget ignores already active powerup type
test('getTarget ignores active powerup type');
setup();
window.eval(`
    beaver = [{x:5,y:5}];
    food = {x:7,y:5};
    powerups = [{type:"shield",x:6,y:5,born:Date.now()}];
    bonuses.add("shield");
`);
const target69 = window.eval(`getTarget()`);
assert(target69.x === 7 && target69.y === 5, 'getTarget ignores active shield, picks food');
teardown();

// 70. teleporterShortcut returns entry when faster
test('teleporterShortcut finds faster path');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() },
        { behind: {x:12,y:5}, entry: {x:11,y:5}, dir: {x:-1,y:0}, born: Date.now() }
    ];
    beaver = [{x:3,y:5}];
    aiTeleporterUsed = 0;
`);
const sc = window.eval(`teleporterShortcut({x:3,y:5}, {x:11,y:5})`);
assert(sc !== null, 'teleporterShortcut returns a shortcut');
assert(sc.target.x === 0 && sc.target.y === 5, 'shortcut targets nearer entry (0,5)');
assert(sc.entryDist === 3, 'entry distance is 3');
teardown();

// 71. teleporterShortcut returns null when already used
test('teleporterShortcut blocked when teleporter used');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() },
        { behind: {x:12,y:5}, entry: {x:11,y:5}, dir: {x:-1,y:0}, born: Date.now() }
    ];
    beaver = [{x:0,y:5}];
    aiTeleporterUsed = 1;
`);
const sc71 = window.eval(`teleporterShortcut({x:0,y:5}, {x:11,y:5})`);
assert(sc71 === null, 'teleporterShortcut returns null when teleporterUsed >= 1');
teardown();

// 72. spawnPowerup blocks duplicate type
test('spawnPowerup blocks duplicate type');
setup();
window.eval(`
    gameRunning = true; beaver = [{x:6,y:6}];
    direction = {x:1,y:0}; nextDirection = {x:1,y:0};
    powerups = [{type:"shield",x:3,y:3,born:Date.now()}];
`);
window.eval(`spawnPowerup('shield')`);
const tp72 = window.eval(`powerups.filter(p=>p.type==="shield").length`);
assert(tp72 === 1, 'no duplicate shield powerup spawned');
teardown();

// 73. spawnTeleporters creates 2 teleporters
test('spawnTeleporters creates 2 teleporters');
setup();
window.eval(`settings.teleportersEnabled = true; teleporters = [];`);
window.eval(`spawnTeleporters()`);
const tpLen = window.eval(`teleporters.length`);
assert(tpLen === 2, 'spawnTeleporters creates 2 teleporters');
const hasColor = window.eval(`teleporters[0].color && teleporters[1].color`);
assert(!!hasColor, 'teleporters have color property');
const hasBorn = window.eval(`typeof teleporters[0].born === 'number'`);
assert(hasBorn, 'teleporters have born timestamp');
teardown();

// 74. init resets lasers, magnetPull, powerups
test('init resets all dynamic state');
setup();
window.eval(`
    bonuses.add("shield"); bonuses.add("magnet");
    powerups = [{type:"shield",x:1,y:1,born:Date.now()}];
    lasers = [{x:1,y:1,dx:1,dy:1,life:1}];
    magnetBorn = Date.now(); magnetPull = {fromX:0,fromY:0,toX:1,toY:1,progress:0.5};
`);
window.eval(`init()`);
const sh74 = window.eval(`bonuses.has("shield")`);
const mg74 = window.eval(`bonuses.has("magnet")`);
const pu74 = window.eval(`powerups.length`);
const lk74 = window.eval(`lasers.length`);
const mp74 = window.eval(`magnetPull`);
assert(!sh74, 'shield removed on init');
assert(!mg74, 'magnet removed on init');
assert(pu74 === 0, 'powerups cleared on init');
assert(lk74 === 0, 'lasers cleared on init');
assert(mp74 === null, 'magnetPull cleared on init');
teardown();

// 75. keyToDirection returns null for unknown key
test('keyToDirection returns null for unknown key');
setup();
const kd = window.eval(`keyToDirection('z')`);
assert(kd === null, 'keyToDirection returns null for "z"');
const kdUp = window.eval(`keyToDirection('ArrowUp')`);
assert(kdUp.x === 0 && kdUp.y === -1, 'keyToDirection returns up for ArrowUp');
teardown();

// 76. Enter does not pause when game not running
test('Enter does not pause when not running');
setup();
pressKey('Enter');
const p76 = window.eval(`paused`);
assert(p76 === false, 'paused stays false when game not running');
teardown();

// 77. AI uses teleporter when shortcut is beneficial
test('AI uses teleporter shortcut');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() },
        { behind: {x:12,y:5}, entry: {x:11,y:5}, dir: {x:-1,y:0}, born: Date.now() }
    ];
    autoPlay = true;
    beaver = [{x:3,y:5}];
    food = {x:11,y:5};
    direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;
    aiTeleporterUsed = 0;
`);
window.eval(`aiMove()`);
const nd77 = window.eval(`nextDirection`);
assert(nd77.x === -1 && nd77.y === 0, 'AI moves left toward nearer teleporter entry');
teardown();

// 78. AI teleporter visit limited to 1 per tick
test('AI limits teleporter visits to 1 per tick');
setup();
window.eval(`
    teleporters = [
        { behind: {x:-1,y:5}, entry: {x:0,y:5}, dir: {x:1,y:0}, born: Date.now() },
        { behind: {x:12,y:5}, entry: {x:11,y:5}, dir: {x:-1,y:0}, born: Date.now() }
    ];
    autoPlay = true;
    beaver = [{x:3,y:5}];
    food = {x:11,y:5};
    direction = {x:1,y:0}; nextDirection = {x:1,y:0}; gameRunning = true;
    aiTeleporterUsed = 1;
`);
window.eval(`aiMove()`);
const nd78 = window.eval(`nextDirection`);
const tpEntry = window.eval(`teleporters.some(t => t.behind.x === ${window.eval('beaver[0].x + nextDirection.x')} && t.behind.y === ${window.eval('beaver[0].y + nextDirection.y')})`);
assert(!tpEntry, 'AI does not enter teleporter when already used this tick');
teardown();

// 79. init sets beaver at grid center
test('init places beaver at grid center');
setup();
window.eval(`settings.gridSize = 10; applyGridSize(); init()`);
const s79 = getGameState();
assert(s79.snake[0].x === 5, 'beaver x at center of 10-grid');
assert(s79.snake[0].y === 5, 'beaver y at center of 10-grid');
teardown();

// 80. init with 16 grid
test('init places beaver at center of 16-grid');
setup();
window.eval(`settings.gridSize = 16; applyGridSize(); init()`);
const s80 = getGameState();
assert(s80.snake[0].x === 8, 'beaver x at center of 16-grid');
assert(s80.snake[0].y === 8, 'beaver y at center of 16-grid');
teardown();

// === Summary ===
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n=== Results: ${passed}/${results.length} assertions passed, ${failed} failed (${testCount} tests) ===`);
process.exit(failed > 0 ? 1 : 0);
