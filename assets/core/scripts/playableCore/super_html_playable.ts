export class super_html_playable {
    download() {
        //@ts-ignore
        console.log('redirect');
        window.super_html && super_html.download();
    }

    game_end() {
        //@ts-ignore
        window.super_html && super_html.game_end();
    }

    is_hide_download() {
        //@ts-ignore
        if (window.super_html && super_html.is_hide_download) {
            //@ts-ignore
            return super_html.is_hide_download();
        }
        return false
    }

    /**
     * 
     * @param callback 
     */
    setAudioCallback(callback: (isAudioEnabled: boolean) => void) {
        //@ts-ignore
        if (window.super_html_channel == "ironsource") {
            //@ts-ignore
            console.log('ironSource audio callback subscribe');
            //@ts-ignore
            window.super_html.on_audio_volume_change(callback);
        }
    }

    /**
     * 
     * @param isAudioEnabled 
     */
    getAudioVolume() {
        //@ts-ignore
        if (window.super_html_channel == "ironsource") {
            //@ts-ignore
            return window.super_html.get_audio_volume();
        }
        return 100;
    }
    getChannel() {
        return window.super_html_channel;
    }

    getMuteOnStart() {
        var channel = this.getChannel();
        return channel == "google" || channel == "applovin" || channel == "moloco"
    }


}
export default new super_html_playable();