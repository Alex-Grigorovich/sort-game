declare global {
    interface Window {
        /** SDK площадки: CTA / установка — только через этот вызов (см. инструкцию теста). */
        install?: () => void;
        /** SDK площадки: конец плейабла (win / lose). */
        gameEnd?: () => void;
    }
}

export class super_html_playable {
    /** Площадка подставляет `window.install`; иначе — fallback на super_html.download. */
    download() {
        //@ts-ignore
        console.log('redirect');
        if (typeof window !== 'undefined' && typeof window.install === 'function') {
            window.install();
            return;
        }
        //@ts-ignore
        window.super_html && super_html.download();
    }

    /**
     * CTA (переход в стор). То же, что {@link download} — отдельное имя для чек-листов
     * с полями вида «CTA Call method».
     */
    ctaCall(): void {
        this.download();
    }

    /** Алиас в snake_case для валидаторов, ожидающих `cta_call`. */
    cta_call(): void {
        this.download();
    }

    /** Площадка подставляет `window.gameEnd`; иначе — fallback на super_html.game_end. */
    game_end() {
        if (typeof window !== 'undefined' && typeof window.gameEnd === 'function') {
            window.gameEnd();
            return;
        }
        //@ts-ignore
        window.super_html && super_html.game_end();
    }

    /** Есть ли хостовый CTA API (редиректы только через него). */
    hasHostInstallApi(): boolean {
        return typeof window !== 'undefined' && typeof window.install === 'function';
    }

    /**
     * Конец плейабла. То же, что {@link game_end} — отдельное имя для чек-листов
     * с полями вида «Game End Call method».
     */
    gameEndCall(): void {
        this.game_end();
    }

    /** Алиас в snake_case для валидаторов, ожидающих `game_end_call`. */
    game_end_call(): void {
        this.game_end();
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

const superHtmlPlayableSingleton = new super_html_playable();

/** Хосты / автотесты часто ищут глобальные имена без импорта модуля. */
if (typeof window !== 'undefined') {
    //@ts-ignore
    window.ctaCall = () => {
        superHtmlPlayableSingleton.ctaCall();
    };
    //@ts-ignore
    window.gameEndCall = () => {
        superHtmlPlayableSingleton.gameEndCall();
    };
}

export default superHtmlPlayableSingleton;