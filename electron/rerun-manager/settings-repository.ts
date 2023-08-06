import { defu } from 'defu'
import { platform } from 'node:process'
import * as fs from 'fs'
import { Credentials, Settings } from '../../shared/schema'
import { resolveUser } from '../main/helpers'

const defaults: Settings = {
    version: '1.0.1',
    credentials: null,
    endpoint: 'https://api.rerunmanager.com/v1/',
    deleteOnComplete: true,
    output: {
        video: {
            encoder: 'libx264',
            bitrate: 4500,
        },
        audio: {
            encoder: 'aac',
            bitrate: 128,
        },
        preset: 'fast',
        profile: 'high',
        crf: 23,
    },
}

export class SettingsRepository {
    private settings: Settings | null
    private readonly path: string
    private readonly listeners: Array<(settings: Settings) => void>
    private readonly directory: string

    constructor() {
        this.listeners = []
        this.settings = defaults
        this.directory = this.appdata('/rerunmanager')

        if (!fs.existsSync(this.directory)) {
            console.log('Creating directory', this.directory)
            fs.mkdirSync(this.directory)
        }

        this.path = `${this.directory}/encoder.json`
    }

    async restore() {
        // load settings from path
        // using node's fs module if file does not exist, create it with defaults
        // if file exists, load it into this.settings

        try {
            const data = await fs.promises.readFile(this.path, {encoding: 'utf-8'})

            if (data) {
                const settings = JSON.parse(data) as Settings

                if (settings.version !== defaults.version) {
                    console.log('Settings version mismatch, resetting to defaults')
                    this.settings = defaults
                } else {
                    console.log('Settings version match, merge with defaults')
                    this.settings = defu(settings, defaults)
                }
            } else {
                console.log('Settings file empty, resetting to defaults')
                this.settings = defaults
            }
        } catch (e) {
            console.log('Settings file not found, resetting to defaults', e)
            this.settings = defaults
        }

        // check if settings.credentials.expires_at is in the past
        // if so, set settings.credentials to null
        if (this.isExpired()) {
            console.log('Credentials expired!')
        } else {
            this.reloadUser()
        }

        await this.save()

        return this.settings
    }

    async save() {
        // call all listeners with the current settings
        this.listeners.forEach(
            (listener: (settings: Settings) => void) => listener(this.settings),
        )

        const pretty = JSON.stringify(this.settings, null, 2)

        await fs.promises.writeFile(this.path, pretty, {encoding: 'utf-8'})
    }

    appdata(path: string): string {
        if (process.env.APPDATA) {
            return process.env.APPDATA + path
        }

        if (platform === 'darwin') {
            return process.env.HOME + '/Library/Preferences' + path
        }

        return process.env.HOME + '/.local/share' + path
    }

    getSettings() {
        return this.settings
    }

    watch(callback: (settings: Settings) => void) {
        // add callback to list of listeners
        this.listeners.push(callback)
    }

    setCredentials(credentials: Credentials) {
        this.settings.credentials = credentials
    }

    commitSettings(settings: Settings) {
        console.log('Committing settings', settings)
        this.settings = defu(settings, this.settings)
        this.save()
    }

    async logout() {
        this.settings.credentials = null
        await this.save()
    }

    private isExpired() {
        if (this.settings.credentials) {
            const expiresAt = new Date(this.settings.credentials.expires_at)
            const now = new Date()
            return expiresAt < now
        }

        return true
    }

    reloadUser() {
        try {
            console.debug('Reloading user')
            resolveUser(
                this.settings.credentials.access_token,
                this.settings.credentials.token_type,
            ).then((user) => {
                this.settings.credentials.user = user
                this.save()
            })
        } catch (e) {
            console.error('Failed to reload user', e)
        }
    }
}