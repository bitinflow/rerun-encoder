import {BrowserWindow} from "electron";
import {User} from "../../shared/schema";
import axios from "axios";

export function emit(event: any, ...args: any) {
    // Send a message to all windows
    BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(event, ...args)
    });
}

export async function resolveUser(accessToken: string, tokenType: string): Promise<User> {
    const response = await axios.get('https://api.rerunmanager.com/v1/channels/me', {
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
        premium: response.data.premium,
    }
}