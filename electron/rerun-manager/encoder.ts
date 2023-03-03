import {EncoderListeners, EncoderOptions, Video} from "../../shared/schema";
import * as fs from "fs";
import axios, {AxiosInstance} from "axios";
import {SettingsRepository} from "./settings-repository";
import * as path from "path";
import {path as ffmpegPath} from "@ffmpeg-installer/ffmpeg";
import {upload} from "./file-uploader";

export class Encoder {
    private readonly id: string;
    private readonly input: string;
    private readonly output: string;
    private readonly options: EncoderOptions;
    private readonly listeners: EncoderListeners;
    private readonly settingsRepository: SettingsRepository;
    private api: AxiosInstance;
    private s3: AxiosInstance;

    constructor(
        id: string,
        input: string,
        options: EncoderOptions,
        listeners: EncoderListeners,
        settingsRepository: SettingsRepository
    ) {

        this.id = id;
        this.input = input;
        this.output = this.getOutputPath(input, 'flv');
        this.options = options;
        this.listeners = listeners;
        this.settingsRepository = settingsRepository;

        const settings = settingsRepository.getSettings();
        this.api = axios.create({
            baseURL: settings.endpoint,
            headers: {
                Authorization: `${settings.credentials.token_type} ${settings.credentials.access_token}`
            }
        })

        this.s3 = axios.create({});
    }

    encode(): void {
        this.listeners.onStart(this.id)

        if (this.requireEncoding()) {
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
            console.log('ffmpegPath', ffmpegPath)
            const ffmpeg = require('fluent-ffmpeg')
            ffmpeg.setFfmpegPath(ffmpegPath)
            let totalTime = 0;

            ffmpeg(this.input)
                .output(this.output)
                .outputOptions(this.getOutputOptions())
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

    private async requestUpload(filename: string): Promise<void> {
        const user = this.settingsRepository.getSettings().credentials.user;
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

        return response.data as Video;
    }

    private async cancelUpload(video: Video): Promise<void> {
        await this.api.delete(`videos/${video.id}/cancel`)
    }

    private async handleUpload(video: Video, filename: string) {
        if (!video.upload_url) {
            return
        }

        try {
            await upload(video.upload_url, filename, (progress: number) => {
                this.listeners.onUploadProgress(this.id, progress)
            })

            this.settingsRepository.reloadUser();

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
}