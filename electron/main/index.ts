import {app, BrowserWindow, ipcMain, shell} from 'electron'
import {release} from 'node:os'
import {join} from 'node:path'
import {EncoderOptions, Settings} from "../../shared/schema";
import {SettingsRepository} from "../rerun-manager/settings-repository";
import {Encoder} from "../rerun-manager/encoder";
import {InternalServer} from "../rerun-manager/internal-server";
import {emit} from "./helpers";
import {platform} from "node:process";
import IpcMainInvokeEvent = Electron.IpcMainInvokeEvent;

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, '../public')
    : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit()
}

require('update-electron-app')({
    repo: 'bitinflow/rerun-encoder',
    updateInterval: '1 hour',
    logger: require('electron-log')
})

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
let encoder: Encoder | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow(settings: Settings) {
    win = new BrowserWindow({
        title: 'Rerun Manager - Encoder',
        icon: join(process.env.PUBLIC, 'logo.ico'),
        frame: false,
        maximizable: false,
        resizable: false,
        width: 560,
        height: 300,
        backgroundColor: '#0c0c0e',
        webPreferences: {
            preload,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            nodeIntegration: true,
            contextIsolation: false,
        },
    })

    if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
        await win.loadURL(url)
        // Open devTool if the app is not packaged
        // win.webContents.openDevTools()
    } else {
        await win.loadFile(indexHtml)
    }

    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({url}) => {
        console.log('setWindowOpenHandler', url)
        if (url.startsWith('https:')) shell.openExternal(url)
        return {action: 'deny'}
    })
    // win.webContents.on('will-navigate', (event, url) => { }) #344
}

const settingsRepository = new SettingsRepository();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    settingsRepository.restore().then((settings: Settings) => {
        createWindow(settings)
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (platform !== 'darwin') {
        app.quit()
    }
})

app.on('second-instance', () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(settingsRepository.getSettings())
    }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: false,
        },
    })

    if (process.env.VITE_DEV_SERVER_URL) {
        childWindow.loadURL(`${url}#${arg}`)
    } else {
        childWindow.loadFile(indexHtml, {hash: arg})
    }
})

ipcMain.handle('version', async () => app.getVersion())
ipcMain.handle('settings', async () => settingsRepository.getSettings())
ipcMain.handle('logout', async () => await settingsRepository.logout())
ipcMain.handle('quit', async () => app.quit())
ipcMain.handle('minimize', async () => win.minimize())
ipcMain.handle('encode', async (event: IpcMainInvokeEvent, ...args: any[]) => {
    const arg = args[0] as { id: string, input: string, options: EncoderOptions };
    encoder = new Encoder(arg.id, arg.input, arg.options, {
        onStart: (id) => event.sender.send('encode-start', id),
        onProgress: (id, progress) => event.sender.send('encode-progress', id, progress),
        onUploadProgress: (id, progress) => event.sender.send('encode-upload-progress', id, progress),
        onUploadComplete: (id, video) => event.sender.send('encode-upload-complete', id, video),
        onError: (id, error) => event.sender.send('encode-error', id, error),
    }, settingsRepository);
    return encoder.encode();
})
ipcMain.handle('cancel-encode', async () => encoder.cancel());
ipcMain.handle('commitSettings', async (event: IpcMainInvokeEvent, ...args: any[]) => settingsRepository.commitSettings(args[0]))
settingsRepository.watch((settings: Settings) => emit('settings', settings));

const internalServer = new InternalServer();
internalServer.listen(settingsRepository);