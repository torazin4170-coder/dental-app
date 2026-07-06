/** UiShell と同様：ダークモード FOUC 防止 */
try {
  if (localStorage.getItem('darkMode') === '1') {
    document.documentElement.classList.add('dark-mode-boot')
    const s = document.createElement('style')
    s.textContent =
      'html.dark-mode-boot body{background:#0f172a}html.dark-mode-boot #boot-loading{background:rgba(15,23,42,.95)!important;color:#93c5fd!important}'
    document.head.appendChild(s)
  }
} catch {
  /* ignore */
}
