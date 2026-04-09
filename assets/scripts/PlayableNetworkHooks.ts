import { _decorator, Component } from 'cc';
import super_html_playable from '../core/scripts/playableCore/super_html_playable';

const { ccclass } = _decorator;

/**
 * Хуки для привязки из редактора (Custom Event / «Call method»): ctaCall, gameEndCall.
 * Дублирует super_html_playable — удобно указать компонент и метод в инспекторе кнопки.
 */
@ccclass('PlayableNetworkHooks')
export class PlayableNetworkHooks extends Component {
    public ctaCall(): void {
        super_html_playable.ctaCall();
    }

    public gameEndCall(): void {
        super_html_playable.gameEndCall();
    }
}
