import {EncoderOptions} from "../rerun-manager/encoder";

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
    return new Promise((resolve) => {
        if (condition.includes(document.readyState)) {
            resolve(true)
        } else {
            document.addEventListener('readystatechange', () => {
                if (condition.includes(document.readyState)) {
                    resolve(true)
                }
            })
        }
    })
}

const safeDOM = {
    append(parent: HTMLElement, child: HTMLElement) {
        if (!Array.from(parent.children).find(e => e === child)) {
            return parent.appendChild(child)
        }
    },
    remove(parent: HTMLElement, child: HTMLElement) {
        if (Array.from(parent.children).find(e => e === child)) {
            return parent.removeChild(child)
        }
    },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
    const className = `loaders-css__square-spin`
    const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0c0c0e;
  z-index: 9;
}
    `
    const oStyle = document.createElement('style')
    const oDiv = document.createElement('div')

    oStyle.id = 'app-loading-style'
    oStyle.innerHTML = styleContent
    oDiv.className = 'app-loading-wrap'
    oDiv.innerHTML = `<div class="${className}"><div></div></div>`

    return {
        appendLoading() {
            safeDOM.append(document.head, oStyle)
            safeDOM.append(document.body, oDiv)
        },
        removeLoading() {
            safeDOM.remove(document.head, oStyle)
            safeDOM.remove(document.body, oDiv)
        },
    }
}

// ----------------------------------------------------------------------

const {appendLoading, removeLoading} = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
    ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)


// ----------------------------------------------------------------------

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// boilerplate code for electron...
import {Settings} from "../../shared/schema";

const {
    contextBridge,
    ipcRenderer
} = require('electron')

// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector: string, text: string) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})

// end boilerplate code, on to your stuff..
window.api = {
    invoke: (channel: string, data: any) => {
        let validChannels = [
            'encode-start',
            'encode-progress',
            'encode-upload-progress',
            'encode-upload-complete',
            'encode-error',
        ] // list of ipcMain.handle channels you want access in frontend to
        if (validChannels.includes(channel)) {
            // ipcRenderer.invoke accesses ipcMain.handle channels like 'myfunc'
            // make sure to include this return statement or you won't get your Promise back
            return ipcRenderer.invoke(channel, data)
        }
    },
    on(channel: string, func: any) {
        let validChannels = [
            'encode-start',
            'encode-progress',
            'encode-upload-progress',
            'encode-upload-complete',
            'encode-error',
        ] // list of ipcMain.on channels you want access in frontend to
        if (validChannels.includes(channel)) {
            // ipcRenderer.on accesses ipcMain.on channels like 'myevent'
            // make sure to include this return statement or you won't get your Promise back
            return ipcRenderer.on(channel, func)
        }
    },
    minimize() {
        return ipcRenderer.invoke('minimize')
    },
    quit() {
        return ipcRenderer.invoke('quit')
    },
    getVersion() {
        return ipcRenderer.invoke('version')
    },
    logout: () => {
        return ipcRenderer.invoke('logout')
    },
    cancelEncode: () => {
        return ipcRenderer.invoke('cancel-encode')
},
    encode: (id: string, input: string, options: EncoderOptions) => {
        return ipcRenderer.invoke('encode', {id, input, options})
    },
    commitSettings: (settings: Settings) => {
        return ipcRenderer.invoke('commitSettings', settings)
    },
    getSettings: () => {
        return ipcRenderer.invoke('settings')
    },
    onSettingsChanged: (callback: (settings: Settings) => void) => {
        return ipcRenderer.on('settings', (event: any, ...args: any) => callback(args[0]))
    },
}