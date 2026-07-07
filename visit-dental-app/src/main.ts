import './boot-dark-mode'
import { installGasCallFetch } from './gas-call'

import appStyles from '../vendor/gas-deploy/AppStyles.html?raw'
import appBody from '../vendor/gas-deploy/AppBody.html?raw'
import appScript from '../vendor/gas-deploy/AppScript.html?raw'

function injectStyle(css: string): void {
  const s = document.createElement('style')
  s.textContent = css
  document.head.appendChild(s)
}

function injectBody(html: string): void {
  const mount = document.getElementById('app-mount')
  if (mount) {
    mount.insertAdjacentHTML('beforebegin', html)
    mount.remove()
  } else {
    document.body.insertAdjacentHTML('afterbegin', html)
  }
}

function injectScript(code: string): void {
  installGasCallFetch()
  window.addEventListener('error', (ev) => {
    const boot = document.getElementById('boot-loading')
    if (!boot || boot.style.display === 'none') return
    const msg = ev.error instanceof Error ? ev.error.message : String(ev.message || 'unknown')
    boot.style.color = '#b91c1c'
    boot.style.padding = '20px'
    boot.style.whiteSpace = 'pre-wrap'
    boot.style.textAlign = 'center'
    boot.textContent = 'アプリの起動に失敗しました:\n' + msg
  })
  const s = document.createElement('script')
  s.textContent = code
  document.body.appendChild(s)
}

injectStyle(appStyles)
injectBody(appBody)
injectScript(appScript)
