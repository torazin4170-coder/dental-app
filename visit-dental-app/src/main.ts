import './boot-dark-mode'
import { installGasCallFetch } from './gas-call'

import appStyles from '../../gas-deploy/AppStyles.html?raw'
import appBody from '../../gas-deploy/AppBody.html?raw'
import appScript from '../../gas-deploy/AppScript.html?raw'

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
  const s = document.createElement('script')
  s.textContent = code
  document.body.appendChild(s)
}

injectStyle(appStyles)
injectBody(appBody)
injectScript(appScript)
