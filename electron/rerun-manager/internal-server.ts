import Application from 'koa';
import Router from 'koa-router';
import KoaLogger from 'koa-logger';
import json from 'koa-json';
import koaCors from "koa-cors";
import bodyParser from "koa-bodyparser";
import axios, {AxiosInstance} from "axios";
import {app} from "electron"
import {Credentials, User} from "../../shared/schema";
import {SettingsRepository} from "./settings-repository";
import * as fs from "fs";
import {join} from "node:path";

export class InternalServer {
    private readonly app: Application;
    private readonly axios: AxiosInstance;

    constructor() {
        this.axios = axios.create();
        this.app = new Application();
    }

    listen(settingsRepository: SettingsRepository) {
        const router = new Router()

        router.get("/health", (ctx) => {
            const settings = settingsRepository.getSettings();
            ctx.body = {
                status: 'ok',
                version: app.getVersion(),
                has_credentials: settings.credentials !== null,
            }
        });

        router.get('/oauth', (ctx) => {
            if(process.env.VITE_DEV_SERVER_URL) {
                ctx.body = fs.readFileSync(join(__dirname, '..', '..', 'public', 'callback.html'), {encoding: 'utf8'})
            } else {
                ctx.body = fs.readFileSync(join(process.env.DIST, 'callback.html'), {encoding: 'utf8'})
            }
        });

        router.post('/callback', async (ctx) => {
            // @ts-ignore
            const params = new URLSearchParams(ctx.request.body.hash);

            const credentials: Credentials = {
                access_token: params.get('access_token'),
                token_type: params.get('token_type'),
                expires_in: params.get('expires_in'),
                expires_at: this.calculateExpiresAt(params.get('expires_in')),
                state: params.get('state'),
                user: await this.resolveUser(params.get('access_token'), params.get('token_type')),
            }

            console.log('credentials', credentials);

            settingsRepository.setCredentials(credentials);

            await settingsRepository.save();

            ctx.body = {
                status: 'ok',
            }
        });

        this.app.use(json());
        this.app.use(KoaLogger());
        this.app.use(koaCors());
        this.app.use(bodyParser());

        this.app.use(router.routes());

        this.app.listen(8361, () => {
            console.log(`Server listening http://127.0.0.1:8361/`);
        });
    }

    private async resolveUser(accessToken: string, tokenType: string): Promise<User> {
        const response = await this.axios.get('https://api.rerunmanager.com/v1/channels/me', {
            headers: {
                'Accept': 'application/json',
                'Authorization': `${tokenType} ${accessToken}`,
            }
        });

        return {
            id: response.data.id,
            name: response.data.name,
            config: response.data.config,
            avatar_url: response.data.avatar_url,
        }
    }

    private calculateExpiresAt(expiresIn: string) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + parseInt(expiresIn) * 1000);

        return expiresAt.toISOString();
    }
}