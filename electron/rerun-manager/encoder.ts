import { EncoderListeners, EncoderOptions, Video } from '../../shared/schema'
import * as fs from 'fs'
import axios, { AxiosInstance } from 'axios'
import { SettingsRepository } from './settings-repository'
import * as path from 'path'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import { upload } from './file-uploader'

console.log('ffmpegPath', ffmpegPath)
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)

let ffmpegCommand: any = null

export interface Signal {
    aborted: boolean
}

export class Encoder {
    private readonly id: string
    private readonly input: string
    private readonly output: string
    private readonly options: EncoderOptions
    private readonly listeners: EncoderListeners
    private readonly settingsRepository: SettingsRepository
    private api: AxiosInstance
    private s3: AxiosInstance
    private signal: Signal = {aborted: false}

    constructor(
        id: string,
        input: string,
        options: EncoderOptions,
        listeners: EncoderListeners,
        settingsRepository: SettingsRepository,
    ) {

        this.id = id
        this.input = input
        this.output = this.getOutputPath(input, 'flv')
        this.options = options
        this.listeners = listeners
        this.settingsRepository = settingsRepository

        const settings = settingsRepository.getSettings()
        this.api = axios.create({
            baseURL: settings.endpoint,
            headers: {
                Authorization: `${settings.credentials.token_type} ${settings.credentials.access_token}`,
            },
        })

        this.s3 = axios.create({})
    }

    encode(): void {
        this.signal.aborted = false
        this.listeners.onStart(this.id)

        if (this.requireEncoding()) {
            let totalTime = 0
            const outputOptions = this.getOutputOptions()

            console.log('Using the following output options:', outputOptions)

            ffmpegCommand = ffmpeg(this.input)
            ffmpegCommand
                .output(this.output)
                .outputOptions(outputOptions)
                .on('start', () => console.log('start'))
                .on('codecData', data => totalTime = parseInt(data.duration.replace(/:/g, '')))
                .on('progress', progress => {
                    const time = parseInt(progress.timemark.replace(/:/g, ''))
                    const percent = (time / totalTime) * 100
                    console.log('progress', percent)
                    this.listeners.onProgress(this.id, percent)
                })
                .on('end', async () => this.requestUpload(this.output))
                .on('error', (error) => {
                    console.log('error', error)
                    this.listeners.onError(this.id, error.message)
                })
                .run()
        } else {
            this.requestUpload(this.input)
        }
    }

    private getOutputOptions() {
        const output = this.settingsRepository.getSettings().output

        return [
            `-c:v ${output.video.encoder}`, // libx264 Use NVIDIA NVENC for hardware-accelerated encoding
            `-profile:v ${output.profile}`, // Use the "main" profile for H264 (compatible with most browsers)
            '-x264opts keyint=60:no-scenecut', // Set the key frame interval to 60 seconds (same as the original video)
            `-preset ${output.preset}`, // Use the "fast" preset for faster transcoding
            `-crf ${output.crf}`, // Adjust the Constant Rate Factor for the desired quality (lower values mean higher quality, 18-28 is usually a good range)
            '-sws_flags bilinear', // Use bilinear scaling algorithm for better image quality
            `-maxrate ${output.video.bitrate}k`,
            `-bufsize ${output.video.bitrate}k`,
            `-c:a ${output.audio.encoder}`,
            `-b:a ${output.audio.bitrate}k`,
            '-ac 2',
            '-f flv',
            '-movflags +faststart',
            '-y',
        ]
    }

    private async requestUpload(filename: string): Promise<void> {
        if (this.signal.aborted) {
            console.log('upload aborted, skipping upload request')
            return
        }
        const user = this.settingsRepository.getSettings().credentials.user
        const response = await this.api.post(`channels/${user.id}/videos`, {
            title: this.options.title,
            size: fs.statSync(filename).size,
        })

        const video = response.data as Video

        try {
            await this.handleUpload(video, filename)
        } catch (error) {
            console.log('error', error)
            this.listeners.onError(this.id, error.message)
        }
    }

    private async confirmUpload(video: Video): Promise<Video> {
        const response = await this.api.post(`videos/${video.id}/confirm`, {
            encoded: true,
        })

        console.log('confirm', response.data)

        return response.data as Video
    }

    private async cancelUpload(video: Video): Promise<void> {
        console.log('cancel upload', video.id)
        await this.api.delete(`videos/${video.id}/cancel`)
    }

    private async handleUpload(video: Video, filename: string) {
        if (!video.upload_url) {
            return
        }

        if (this.signal.aborted) {
            console.log('upload aborted, skipping upload handle')
            this.listeners.onError(this.id, `Upload Error: Upload aborted`)
            return
        }

        try {
            await upload(video.upload_url, filename, (progress: number) => {
                this.listeners.onUploadProgress(this.id, progress)
            }, this.signal)

            this.settingsRepository.reloadUser()

            this.listeners.onUploadComplete(this.id, await this.confirmUpload(video))
        } catch (error) {
            console.log('upload error', error)
            try {
                await this.cancelUpload(video)
            } catch (error) {
                console.log('cancel error', error)
            }
            this.listeners.onError(this.id, `Upload Error: ${error.message}`)
        }
    }

    /**
     * This will return the output path for the encoded file.
     * It will have the same name as the input file, but with the given extension.
     * Also, a suffix will be added to the file name to avoid overwriting existing files.
     */
    private getOutputPath(input: string, ext: string) {
        const parsed = path.parse(input)
        return path.join(parsed.dir, `${parsed.name}-rerun.${ext}`)
    }

    /**
     * You can also just upload the file as is, without encoding it.
     * @private
     */
    private requireEncoding() {
        return path.parse(this.input).ext !== '.flv'
    }

    cancel() {
        console.log('cancel rerun encode')
        this.signal.aborted = true
        if (ffmpegCommand) {
            ffmpegCommand.kill()
        }
    }
}