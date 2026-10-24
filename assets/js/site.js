/* 宁雨晰个人网站 · site.js
 * 来源：阶段 03 方向 C 的 app.js（stages/03-design/dir-c/），参数没有改动。
 * 1. 手机菜单（≤799px）
 * 2. 点击收缩：按下 120ms 缩小，松开 360ms 回到 1，缓动 cubic-bezier(.34,1.56,.64,1)
 *    缩放值按图的显示大小换算：每边收进约 7.5px，限制在 0.92–0.97 之间
 *    （约 300px 的图是 0.95；1003px 宽的大图是 0.97；86px 宽的小图是 0.92；dir-c 第二轮的做法）
 *    鼠标、触屏、键盘 Enter 都触发；图是链接或打开灯箱时，点击后等 240ms 再执行
 *    触屏按下 60ms 后才开始收缩，60ms 内开始滑动页面就不收缩
 *    系统开了「减弱动态效果」时不缩放，只把透明度降到 0.8 再回到 1（200ms），不等待
 * 3. 背景音乐开关（页面上有 .bgm 按钮时才运行；site.json 的 bgm 为 null 时页面上没有这个按钮）
 *    默认不播放，点开关才播放；页面上任何别的视频或音频开始播放时暂停音乐；
 *    访客打开过音乐后换页，下一页尝试从同一位置接着放，浏览器不允许时保持关闭
 * 4. 灯箱（作品页）：不透明白底，淡入 400ms；← → 切换，Esc 关闭；手机左右滑动切换
 *    大图的 sizes 按这张图实际的显示宽度写，浏览器按屏幕像素密度在 _s、_m、_l 里取够用的一档
 */
(function () {
  'use strict';

  var PRESS = {
    travel: 7.5,                         // 每边收进的距离（px），由它换算缩放值
    minScale: 0.92,                      // 小图最多缩到 0.92
    maxScale: 0.97,                      // 大图至少缩到 0.97
    down: 120,                           // 按下：缩小的时长
    up: 360,                             // 松开：回到 1 的时长
    easeDown: 'cubic-bezier(.2,0,.2,1)',
    easeUp: 'cubic-bezier(.34,1.56,.64,1)',
    wait: 240,                           // 点击后到跳转或开灯箱的等待，不超过 250ms
    keyDown: 90,                         // 键盘 Enter 触发时的收缩时长
    touchDelay: 60                       // 触屏按下后延迟开始收缩，滑动页面时不误触发
  };
  var root = document.documentElement;
  var mq = window.matchMedia ? function (q) { return window.matchMedia(q); } : function () { return { matches: false }; };
  var reduceMQ = mq('(prefers-reduced-motion: reduce)');
  var canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  function reduced() { return reduceMQ.matches || !canAnimate; }

  /* ---------------- 1. 手机菜单 ---------------- */
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  function setMenu(open) {
    if (!menuBtn || !nav) return;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('is-open', open);
    root.classList.toggle('menu-lock', open);
  }
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuBtn.focus();
      }
    });
    var deskMQ = mq('(min-width: 800px)');
    var onDesk = function () { if (deskMQ.matches) setMenu(false); };
    if (deskMQ.addEventListener) deskMQ.addEventListener('change', onDesk);
  }

  /* ---------------- 2. 点击收缩 ---------------- */
  function scaleNow(img) {
    var t = getComputedStyle(img).transform;
    if (!t || t === 'none') return 1;
    var m = t.match(/matrix\(([^,]+)/);
    return m ? parseFloat(m[1]) : 1;
  }
  function clearAnims(img) {
    if (img.getAnimations) img.getAnimations().forEach(function (a) { a.cancel(); });
  }
  function animateTo(img, to, duration, easing, done) {
    var from = scaleNow(img);
    clearAnims(img);
    var a = img.animate(
      [{ transform: 'scale(' + from + ')' }, { transform: 'scale(' + to + ')' }],
      { duration: duration, easing: easing, fill: 'forwards' }
    );
    if (done) a.onfinish = function () { done(a); };
    return a;
  }
  // 缩放值：每边收进 PRESS.travel 像素；用显示宽高的几何平均作为图的大小，结果限制在 0.92–0.97
  // offsetWidth / offsetHeight 是排版尺寸，不受正在进行的缩放影响
  function targetScale(img) {
    var size = Math.sqrt(Math.max(1, img.offsetWidth) * Math.max(1, img.offsetHeight));
    var s = 1 - (2 * PRESS.travel) / size;
    return Math.round(Math.min(PRESS.maxScale, Math.max(PRESS.minScale, s)) * 1000) / 1000;
  }
  function shrink(img, duration) {
    return animateTo(img, targetScale(img), duration || PRESS.down, PRESS.easeDown);
  }
  window.NYXPress = { targetScale: targetScale, params: PRESS };
  function rebound(img) {
    return animateTo(img, 1, PRESS.up, PRESS.easeUp, function (a) { a.cancel(); });
  }
  function flash(img) {
    if (!canAnimate) return;
    img.animate([{ opacity: 1 }, { opacity: 0.8 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  }
  function tap(img, downMs) {
    shrink(img, downMs);
    setTimeout(function () { rebound(img); }, downMs);
  }

  var pressed = null;   // { img, id, t0, started, timer }

  function startShrink(p) {
    if (p.started) return;
    p.started = true;
    p.t0 = performance.now();
    shrink(p.img);
  }
  function release(p) {
    if (p.timer) { clearTimeout(p.timer); p.timer = 0; }
    if (!p.started) {               // 触屏轻点：按下和松开都在延迟之内，补一次完整的收缩
      startShrink(p);
    }
    var held = performance.now() - p.t0;
    var rest = Math.max(0, PRESS.down - held);   // 收缩至少走完 120ms 再回弹
    if (rest > 0) setTimeout(function () { rebound(p.img); }, rest);
    else rebound(p.img);
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var el = e.target.closest ? e.target.closest('[data-press]') : null;
    if (!el) return;
    var img = el.querySelector('img');
    if (!img) return;
    if (pressed && pressed.timer) clearTimeout(pressed.timer);
    pressed = { img: img, id: e.pointerId, t0: 0, started: false, timer: 0, touch: e.pointerType !== 'mouse' };
    if (reduced()) return;
    if (pressed.touch) {
      var p = pressed;
      p.timer = setTimeout(function () { p.timer = 0; startShrink(p); }, PRESS.touchDelay);
    } else {
      startShrink(pressed);
    }
  });
  function onPointerEnd(e) {
    if (!pressed || e.pointerId !== pressed.id) return;
    var p = pressed;
    pressed = null;
    if (reduced()) {
      if (e.type === 'pointerup') flash(p.img);
      return;
    }
    if (e.type === 'pointercancel' && !p.started) {   // 触屏开始滑动页面：不收缩
      if (p.timer) clearTimeout(p.timer);
      return;
    }
    release(p);
  }
  document.addEventListener('pointerup', onPointerEnd);
  document.addEventListener('pointercancel', onPointerEnd);

  // 点击：链接和灯箱等收缩播完再执行；键盘 Enter 产生的点击（detail 为 0）先补一次收缩
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    var el = e.target.closest ? e.target.closest('[data-press]') : null;
    if (!el) return;
    var lbIndex = el.getAttribute('data-lb');
    var isLink = el.tagName === 'A' && el.hasAttribute('href');
    if (lbIndex === null && !isLink) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // 新标签页等交给浏览器
    e.preventDefault();
    var img = el.querySelector('img');
    var keyboard = e.detail === 0;
    if (keyboard && img) {
      if (reduced()) flash(img); else tap(img, PRESS.keyDown);
    }
    var go = function () {
      if (lbIndex !== null && window.NYXLightbox) window.NYXLightbox.open(parseInt(lbIndex, 10), el);
      else window.location.href = el.href;
    };
    if (reduced()) go(); else setTimeout(go, PRESS.wait);
  });

  /* ---------------- 3. 背景音乐 ---------------- */
  (function () {
    var btn = document.querySelector('.bgm');
    if (!btn) return;
    var src = btn.getAttribute('data-src');
    var KEY = 'nyx-bgm';
    var audio = null;
    function save(on) {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ on: on, t: audio ? audio.currentTime : 0 }));
      } catch (err) { /* 浏览器不让存时不记，下一页从关闭开始 */ }
    }
    function load() {
      try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (err) { return null; }
    }
    function isOn() { return btn.getAttribute('aria-pressed') === 'true'; }
    function setOn(on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    function ensure() {
      if (!audio) {
        audio = new Audio();
        audio.loop = true;
        audio.preload = 'auto';
        audio.src = src;
      }
      return audio;
    }
    function play() {
      ensure();
      setOn(true);
      var p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { setOn(false); save(false); });   // 浏览器不允许播放或文件打不开
      }
    }
    function pause() {
      if (audio) audio.pause();
      setOn(false);
    }
    btn.addEventListener('click', function () {
      if (isOn()) { pause(); save(false); } else { play(); save(true); }
    });
    // 页面上任何别的视频或音频开始播放时暂停音乐（play 事件不冒泡，用捕获阶段监听）
    document.addEventListener('play', function (e) {
      if (e.target !== audio && isOn()) { pause(); save(false); }
    }, true);
    window.addEventListener('pagehide', function () {
      if (audio && isOn()) save(true);
    });
    var state = load();
    if (state && state.on) {
      ensure();
      if (state.t) {
        audio.addEventListener('loadedmetadata', function () {
          try { audio.currentTime = state.t; } catch (err) { /* 跳不过去就从头放 */ }
        }, { once: true });
      }
      play();
    }
  })();

  /* ---------------- 4. 灯箱 ---------------- */
  var lb = document.getElementById('lb');
  if (!lb) return;
  var lbImg = lb.querySelector('.lb-img');
  var lbCount = lb.querySelector('.lb-count');
  var btnClose = lb.querySelector('.lb-close');
  var btnPrev = lb.querySelector('.lb-prev');
  var btnNext = lb.querySelector('.lb-next');
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-lb]'))
    .sort(function (a, b) { return a.getAttribute('data-lb') - b.getAttribute('data-lb'); })
    .map(function (a) {
      var img = a.querySelector('img');
      return {
        href: a.getAttribute('href'),
        srcset: img.getAttribute('srcset'),
        alt: img.getAttribute('alt'),
        w: img.getAttribute('width'),
        h: img.getAttribute('height'),
        cap: a.getAttribute('data-cap') || ''
      };
    });
  var idx = 0;
  var opener = null;
  var preloaded = {};
  // 大图的显示宽度：受 88vw（手机 100vw − 32px）和可用高度两头限制；sizes 按这张图实际的显示宽度写
  function lbSizes(it) {
    var mobile = window.innerWidth <= 799;
    var maxW = mobile ? window.innerWidth - 32 : window.innerWidth * 0.88;
    var maxH = window.innerHeight - (mobile ? 170 : 150);
    return Math.max(1, Math.round(Math.min(maxW, maxH * it.w / it.h))) + 'px';
  }

  function preload(i) {
    var it = items[(i + items.length) % items.length];
    if (!it || preloaded[it.href]) return;
    var im = new Image();
    im.sizes = lbSizes(it);
    im.srcset = it.srcset;
    im.src = it.href;
    preloaded[it.href] = im;
  }
  function show(i) {
    idx = (i + items.length) % items.length;
    var it = items[idx];
    lbImg.removeAttribute('srcset');
    lbImg.setAttribute('width', it.w);
    lbImg.setAttribute('height', it.h);
    lbImg.setAttribute('sizes', lbSizes(it));
    lbImg.setAttribute('srcset', it.srcset);
    lbImg.setAttribute('src', it.href);
    lbImg.alt = it.alt;
    lbCount.textContent = it.cap;
    preload(idx + 1);
    preload(idx - 1);
  }
  function isOpen() { return !lb.hidden; }
  function open(i, from) {
    opener = from || null;
    show(i);
    lb.hidden = false;
    root.classList.add('lb-lock');
    void lb.offsetWidth;            // 触发重排后再加 is-open，淡入才会生效
    lb.classList.add('is-open');
    btnClose.focus({ preventScroll: true });
  }
  function close() {
    lb.classList.remove('is-open');
    lb.hidden = true;               // 关闭不做动画（参考站同样是下一帧消失）
    root.classList.remove('lb-lock');
    if (opener) opener.focus({ preventScroll: true });
  }
  window.NYXLightbox = { open: open, close: close };

  btnClose.addEventListener('click', function (e) { e.stopPropagation(); close(); });
  btnPrev.addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
  btnNext.addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });

  // 点画面左半边看上一张，右半边看下一张
  var swiped = false;
  lb.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('.lb-btn')) return;
    if (e.clientX < window.innerWidth / 2) show(idx - 1); else show(idx + 1);
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    else if (e.key === 'Tab') {               // 焦点留在灯箱里
      var f = [btnClose, btnPrev, btnNext];
      var k = f.indexOf(document.activeElement);
      e.preventDefault();
      var n = e.shiftKey ? (k <= 0 ? f.length - 1 : k - 1) : (k + 1) % f.length;
      f[n].focus();
    }
  });

  // 手机左右滑
  var sx = 0, sy = 0, sid = null;
  lb.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    sx = e.clientX; sy = e.clientY; sid = e.pointerId;
  });
  lb.addEventListener('pointerup', function (e) {
    if (sid === null || e.pointerId !== sid) return;
    sid = null;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      setTimeout(function () { swiped = false; }, 400);
      if (dx < 0) show(idx + 1); else show(idx - 1);
    }
  });
  lb.addEventListener('pointercancel', function () { sid = null; });
})();


/* 作品列表：瀑布流（照参考站）。按顺序把每件作品放进当前最矮的一栏（高度差 1px 以内取靠左的一栏），
   栏数和间距读 CSS 变量 --cols、--gx、--gy；窗口变化、字体载入、图片载入后重排。没有 JS 时页面是普通网格。 */
(function () {
  var grids = document.querySelectorAll('[data-masonry]');
  if (!grids.length) return;
  function layout(g) {
    var cs = getComputedStyle(g);
    var cols = parseInt(cs.getPropertyValue('--cols'), 10) || 3;
    var gx = parseFloat(cs.getPropertyValue('--gx')) || 0;
    var gy = parseFloat(cs.getPropertyValue('--gy')) || 0;
    var cw = (g.clientWidth - gx * (cols - 1)) / cols;
    g.style.setProperty('--cw', cw + 'px');
    g.classList.add('is-masonry');
    var hs = [];
    for (var i = 0; i < cols; i++) hs.push(0);
    Array.prototype.forEach.call(g.children, function (el) {
      var c = 0;
      for (var k = 1; k < cols; k++) if (hs[k] < hs[c] - 1) c = k;
      el.style.transform = 'translate(' + (c * (cw + gx)) + 'px,' + hs[c] + 'px)';
      hs[c] += el.offsetHeight + gy;
    });
    g.style.height = Math.max(0, Math.max.apply(null, hs) - gy) + 'px';
  }
  function all() { Array.prototype.forEach.call(grids, layout); }
  all();
  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(all, 100); });
  window.addEventListener('load', all);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
})();
