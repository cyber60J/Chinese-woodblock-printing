const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function inlineScript(source) {
    const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1, 'The page must have one playback script');
    return scripts[0][1];
}

function surface() {
    const listeners = new Map();
    return {
        listeners,
        addEventListener(type, callback) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(callback);
        },
        emit(type, event = {}) {
            event.target ??= { closest: () => null };
            for (const callback of listeners.get(type) ?? []) callback(event);
        },
    };
}

function browser({ height = 5000, top = 0 } = {}) {
    let now = 0;
    let scrollY = top;
    let frames = [];
    const elements = {};
    for (const id of ['playback-toggle', 'playback-speed', 'playback-status-text', 'playback-countdown']) {
        elements[id] = Object.assign(surface(), {
            textContent: '', value: id === 'playback-speed' ? '28' : '', hidden: false,
            dataset: {}, attributes: {},
            setAttribute(name, value) { this.attributes[name] = value; },
            closest(selector) { return selector.includes('playback-controls') ? controls : null; },
        });
    }
    const controls = {
        hidden: true, dataset: {},
        setAttribute(name, value) {
            if (name === 'data-playback-state') this.dataset.playbackState = value;
            else this[name] = value;
        },
    };
    const scrollingElement = { scrollHeight: height };
    Object.defineProperty(scrollingElement, 'scrollTop', {
        get: () => scrollY, set: value => { scrollY = value; },
    });
    const document = Object.assign(surface(), {
        hidden: false, scrollingElement,
        querySelector: selector => selector === '.playback-controls' ? controls : null,
        getElementById: id => elements[id] ?? null,
    });
    const window = Object.assign(surface(), {
        innerHeight: 800, innerWidth: 1024,
        scrollTo(x, y) {
            const destination = typeof x === 'object' ? x.top : y;
            // Safari may report integer scrollY while playback needs fractional progress.
            scrollY = Math.floor(Math.max(0, Math.min(destination, scrollingElement.scrollHeight - this.innerHeight)));
            this.emit('scroll');
            document.emit('scroll');
        },
    });
    Object.defineProperty(window, 'scrollY', { get: () => scrollY });
    const requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    window.requestAnimationFrame = requestAnimationFrame;
    vm.runInNewContext(inlineScript(html), {
        document, window, performance: { now: () => now }, requestAnimationFrame,
    }, { timeout: 1000 });

    function frame(milliseconds = 1000 / 60) {
        now += milliseconds;
        const pending = frames;
        frames = [];
        assert.equal(pending.length, 1, 'Playback must use a single animation loop');
        for (const callback of pending) callback(now);
    }
    function run(count = 6) { for (let index = 0; index < count; index++) frame(); }
    function click() { elements['playback-toggle'].emit('click', { target: elements['playback-toggle'] }); }
    function start() { frame(4010); run(); }
    return { window, document, controls, elements, scrollingElement, frame, run, click, start };
}

test('Published and demo pages share playback and expose an accessible status', () => {
    const demo = fs.readFileSync(path.join(root, 'aippi-2026-demo.html'), 'utf8');
    assert.equal(inlineScript(html), inlineScript(demo));
    for (const source of [html, demo]) {
        assert.ok(/<[^>]+(?=[^>]*\bid="playback-status-text")(?=[^>]*\brole="status")[^>]*>/.test(source), 'Playback must expose a screen-reader status');
        assert.ok(/<[^>]+(?=[^>]*\bid="playback-countdown")(?=[^>]*\baria-hidden="true")[^>]*>/.test(source), 'Changing countdown digits must not be announced every frame');
    }
});

test('Startup waits four seconds; Play then resumes within a few display frames', () => {
    const page = browser();
    assert.equal(page.elements['playback-toggle'].listeners.get('click').length, 1);
    page.frame(3990);
    assert.equal(page.window.scrollY, 0);
    page.frame(100);
    page.run();
    assert.ok(page.window.scrollY > 0);
    page.click();
    const stopped = page.window.scrollY;
    page.frame(12000);
    assert.equal(page.window.scrollY, stopped);
    page.click();
    page.run();
    assert.ok(page.window.scrollY > stopped, 'Play must visibly move without the old one-second wait');
    assert.equal(page.controls.dataset.playbackState, 'playing');
    assert.ok(page.elements['playback-status-text'].textContent.length > 0);
});

test('Play clears stale touch/pointer state; late releases cannot add another wait', () => {
    const page = browser();
    page.start();
    page.document.emit('pointerdown', { pointerId: 7 });
    page.document.emit('touchstart', { touches: [{}] });
    page.click();
    page.click();
    const resumed = page.window.scrollY;
    page.document.emit('pointerup', { pointerId: 7 });
    page.document.emit('pointercancel', { pointerId: 7 });
    page.document.emit('touchend', { touches: [] });
    page.document.emit('touchcancel', { touches: [] });
    page.run();
    assert.ok(page.window.scrollY > resumed);
    assert.equal(page.controls.dataset.playbackState, 'playing');
});

test('Repeated height changes retain slow fractional progress; rotation adds no delay', () => {
    const page = browser();
    page.elements['playback-speed'].value = '18';
    page.elements['playback-speed'].emit('change');
    page.start();
    const before = page.window.scrollY;
    for (let index = 0; index < 60; index++) {
        page.window.innerHeight = 800 + index % 2;
        page.window.emit('resize');
        page.frame();
    }
    assert.ok(page.window.scrollY >= before + 15, 'Height resize must not reset subpixel progress or the reading timer');
    page.window.innerWidth = 768;
    page.window.emit('resize');
    const rotated = page.window.scrollY;
    page.run();
    assert.ok(page.window.scrollY > rotated, 'Width changes must resume within display frames');
});

test('Explicit Pause persists through reading, resize and visibility events', () => {
    const page = browser();
    page.start();
    page.click();
    const stopped = page.window.scrollY;
    page.window.emit('resize');
    page.window.emit('hashchange');
    page.document.emit('toggle');
    page.document.emit('wheel');
    page.document.hidden = true;
    page.document.emit('visibilitychange');
    page.frame(12000);
    page.document.hidden = false;
    page.document.emit('visibilitychange');
    page.frame(12000);
    page.run(60);
    assert.equal(page.window.scrollY, stopped);
    assert.equal(page.controls.dataset.playbackState, 'paused');
});

test('Programmatic scroll events do not pause their own animation', () => {
    const page = browser();
    page.start();
    const before = page.window.scrollY;
    page.run(120);
    assert.ok(page.window.scrollY > before + 40);
    assert.equal(page.controls.dataset.playbackState, 'playing');
});

test('A held finger blocks movement and release grants ten seconds to read', () => {
    const page = browser();
    page.start();
    page.document.emit('pointerdown', { pointerId: 8 });
    page.document.emit('touchstart', { touches: [{}] });
    const stopped = page.window.scrollY;
    page.frame(16000);
    page.run();
    assert.equal(page.window.scrollY, stopped);
    page.document.emit('pointerup', { pointerId: 8 });
    page.document.emit('touchend', { touches: [] });
    page.frame(9900);
    assert.equal(page.window.scrollY, stopped);
    page.frame(200);
    page.run();
    assert.ok(page.window.scrollY > stopped);
});

test('Pointer cancellation keeps a held touch paused until touchend and its reading delay', () => {
    const page = browser();
    page.start();
    page.document.emit('pointerdown', { pointerId: 9 });
    page.document.emit('touchstart', { touches: [{}] });
    page.document.emit('pointercancel', { pointerId: 9 });
    const stopped = page.window.scrollY;
    page.frame(16000);
    page.run();
    assert.equal(page.window.scrollY, stopped, 'A remaining touch must block movement after the pointer is cancelled');
    assert.equal(page.controls.dataset.playbackState, 'reading');
    page.document.emit('touchend', { touches: [] });
    page.frame(9900);
    assert.equal(page.window.scrollY, stopped);
    page.frame(200);
    page.run();
    assert.ok(page.window.scrollY > stopped);
    assert.equal(page.controls.dataset.playbackState, 'playing');
});

test('Bottom pauses before looping; explicit Play at the bottom restarts immediately', () => {
    const page = browser({ height: 1000, top: 200 });
    page.frame(4010);
    assert.equal(page.controls.dataset.playbackState, 'bottom');
    page.frame(3900);
    assert.equal(page.window.scrollY, 200);
    page.frame(200);
    assert.equal(page.window.scrollY, 0);
    page.frame(4100);
    page.run();
    assert.ok(page.window.scrollY > 0);

    const atBottom = browser({ height: 1000, top: 200 });
    atBottom.frame(4010);
    atBottom.click();
    atBottom.click();
    atBottom.run();
    assert.ok(atBottom.window.scrollY > 0 && atBottom.window.scrollY < 10);
});

test('Lazy image growth extends the current pass instead of returning to the top', () => {
    const page = browser({ height: 1000, top: 200 });
    page.frame(4010);
    page.frame(2000);
    page.scrollingElement.scrollHeight = 2000;
    page.run();
    assert.ok(page.window.scrollY > 200);
    assert.equal(page.controls.dataset.playbackState, 'playing');
    page.frame(4100);
    assert.ok(page.window.scrollY > 200);
});
