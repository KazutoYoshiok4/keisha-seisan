// アクセス解析。Googleタグマネージャー（GTM）を読み込み、GTMからGoogleアナリティクス4へ送る。
// 送るのはページの表示と、操作の種類・人数・回の数など。入力した名前・金額・文面は送らない。
// ・プライバシーポリシーの「この端末での計測を止める」を押した端末では、GTMを読み込まない。
// ・?internal=1 で一度開いた端末は運営者として印をつけ、GA4の集計から除く（?internal=0 で外す）。
// ・公開先（byebye-seisan.com）以外で開いたとき（保存したファイルや手元の確認用サーバー）は送らない。
// index.html はこのファイルがなくても動く。その場合はどこにも送らない。
(function () {
  'use strict';
  var GTM_ID = 'GTM-MVL8DBHK';
  var GA_ID = 'G-9JTCX3DEB7';
  var OPTOUT_KEY = 'byebye-analytics-optout';
  var INTERNAL_KEY = 'byebye-internal';
  function flag(key) { try { return localStorage.getItem(key) === '1'; } catch (_) { return false; } }
  function setFlag(key, on) {
    try { if (on) localStorage.setItem(key, '1'); else localStorage.removeItem(key); return true; } catch (_) { return false; }
  }

  // 運営者の印。URLから ?internal を消してから計測するので、ページのURLには残らない。
  var url = new URL(location.href);
  var internalParam = url.searchParams.get('internal');
  if (internalParam !== null) {
    setFlag(INTERNAL_KEY, internalParam === '1');
    url.searchParams.delete('internal');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }

  // プライバシーポリシーの計測停止ボタン。
  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('analytics-optout');
    var status = document.getElementById('analytics-optout-status');
    if (!button) return;
    var render = function () { button.textContent = flag(OPTOUT_KEY) ? 'この端末での計測を再開する' : 'この端末での計測を止める'; };
    button.addEventListener('click', function () {
      var stop = !flag(OPTOUT_KEY);
      if (!setFlag(OPTOUT_KEY, stop)) { status.textContent = '設定を保存できませんでした。ブラウザの設定で、このサイトのデータの保存を許可してください。'; return; }
      if (stop) {
        // 開いているページからも、できるだけ送らないようにする（Google公式の停止用の変数）。GA4のCookieも消す。
        window['ga-disable-' + GA_ID] = true;
        document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); }).filter(function (name) { return /^_ga(_|$)/.test(name); }).forEach(function (name) {
          ['', '; domain=' + location.hostname, '; domain=.' + location.hostname].forEach(function (domain) {
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + domain;
          });
        });
      }
      render();
      status.textContent = stop ? 'この端末での計測を止めました。次にページを開いたときから送りません。' : 'この端末での計測を再開しました。';
    });
    render();
    button.hidden = false;
  });

  if (flag(OPTOUT_KEY) || location.hostname !== 'byebye-seisan.com') return;

  // LINEなどアプリの中のブラウザで開いたか。保存や共有の動きが外のブラウザと違うため、分けて見る。
  var ua = navigator.userAgent;
  var inApp = /\bLine\//i.test(ua) ? 'line' : /Instagram/.test(ua) ? 'instagram' : /FBAN|FBAV/.test(ua) ? 'facebook' : 'none';
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ traffic_type: flag(INTERNAL_KEY) ? 'internal' : undefined, in_app_browser: inApp });

  // GTMの公式の読み込みコードと同じ処理。
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  document.head.appendChild(script);
})();
