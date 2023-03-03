
import {EncoderListeners, EncoderOptions, Settings, User, Video} from "../../shared/schema";
import * as fs from "fs";
import axios, {AxiosInstance} from "axios";

export class Encoder {
    private readonly id: string;
    private readonly input: string;
    private readonly output: string;
    private readonly options: EncoderOptions;
    private readonly listeners: EncoderListeners;
    private readonly settings: Settings;
    private api: AxiosInstance;
    private s3: AxiosInstance;

    constructor(
        id: string,
        input: string,
        options: EncoderOptions,
        listeners: EncoderListeners,
        settings: Settings
    ) {
        this.id = id;
        this.input = input;
        this.output = this.input.replace(/\.mp4$/, '.flv')
        this.options = options;
        this.listeners = listeners;
        this.settings = settings;

        this.api = axios.create({
            baseURL: settings.endpoint,
            headers: {
                Authorization: `${settings.credentials.token_type} ${settings.credentials.access_token}`
            }
        })

        this.s3 = axios.create({});
    }

    async encode(): Promise<void> {
        this.listeners.onStart(this.id)

        const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
        console.log('ffmpegPath', ffmpegPath)
        const ffmpeg = require('fluent-ffmpeg')
        ffmpeg.setFfmpegPath(ffmpegPath)
        let totalTime = 0;
        ffmpeg(this.input)
            .outputOptions(this.getOutputOptions())
            .output(this.output)
            .on('start', () => {
                console.log('start')
            })
            .on('codecData', data => {
                totalTime = parseInt(data.duration.replace(/:/g, ''))
            })
            .on('progress', progress => {
                const time = parseInt(progress.timemark.replace(/:/g, ''))
                const percent = (time / totalTime) * 100
                console.log('progress', percent)
                this.listeners.onProgress(this.id, percent)
            })
            .on('end', async () => {
                console.log('end')
                // @ts-ignore
                try {
                    const video = await this.requestUploadUrl(this.settings.credentials.user)
                    await this.upload(video)
                } catch (error) {
                    console.log('error', error)
                    this.listeners.onError(this.id, error.message)
                }
            })
            .on('error', (error) => {
                console.log('error', error)
                this.listeners.onError(this.id, error.message)
            })
            .run()
    }

    private getOutputOptions() {
        return [
            '-c:v libx264',
            '-preset veryfast',
            '-crf 23',
            '-maxrate 6000k',
            '-bufsize 6000k',
            '-c:a aac',
            '-b:a 128k',
            '-ac 2',
            '-f flv',
            '-movflags +faststart',
            '-y'
        ]
    }

    private async requestUploadUrl(user: User): Promise<Video> {
        const response = await this.api.post(`channels/${user.id}/videos`, {
            title: this.options.title,
            size: fs.statSync(this.output).size,
        })

        return response.data as Video
    }

    private async confirmUpload(video: Video): Promise<Video> {
        const response = await this.api.post(`videos/${video.id}/confirm`, {
            encoded: true,
        })

        console.log('confirm', response.data)

        return response.data as Video;
    }

    private async cancelUpload(video: Video): Promise<void> {
        await this.api.delete(`videos/${video.id}/cancel`)
    }

    private async upload(video: Video) {
        if (!video.upload_url) {
            return
        }

        const stream = fs.createReadStream(this.output)
        stream.on('error', (error) => {
            console.log('upload error', error)
            this.listeners.onError(this.id, error.message)
        })

        const progress = (progress: any) => {
            const progressCompleted = progress.loaded / fs.statSync(this.output).size * 100
            this.listeners.onUploadProgress(this.id, progressCompleted)
        }

        try {
            await this.s3.put(video.upload_url, stream, {
                onUploadProgress: progress,
                headers: {
                    'Content-Type': 'video/x-flv',
                }
            })

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
}