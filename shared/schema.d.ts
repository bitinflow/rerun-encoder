/**
 * User structure
 */
export interface User {
    id: string
    name: string
    avatar_url: string
    premium: boolean
    config: {
        storage_limit: number
        videos_limit: number
        storage_used: number
    }
}

/**
 * Oauth2 credential structure including user information
 */
export interface Credentials {
    access_token: string
    token_type: string
    expires_in: string
    state: string
    expires_at: string
    user: User
}

/**
 * File structure for user settings
 * Which is stored in %APPDATA%/rerun-manager/encoder.json
 */
export interface Settings {
    version?: string // version of the settings schema (diff will force a reset)
    credentials?: Credentials | null
    endpoint?: string | null
    deleteOnComplete?: boolean
    output?: {
        video: {
            encoder: 'libx264' | 'nvenc_h264'
            bitrate: number
        }
        audio: {
            encoder: 'aac'
            bitrate: number
        }
        preset: 'default' | 'fast' | 'medium' | 'slow'
        profile: 'high' | 'main' | 'baseline'
        crf: number
    }
}

export interface VerifiedGame {
    id: number
    name: string
    publisher: string | null
    notes: string | null
    supported: boolean
    requires_optimization: boolean
    executables: Array<string>
    image_url: string | null
}

export interface EncoderOptions {
    publishOnComplete: boolean;
    title: string
}

export interface EncoderListeners {
    onStart: (id) => void;
    onProgress: (id, progress: number) => void;
    onUploadProgress: (id, progress: number) => void;
    onUploadComplete: (id, video: Video) => void;
    onError: (id, error: string) => void;
}

export interface Video {
    id: string;
    upload_url?: string;
    title: string;
    status: 'created' | 'uploaded'
}