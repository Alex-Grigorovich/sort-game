import { _decorator, EventTarget } from 'cc';
import { Main } from '../playableCore/Main';
const { ccclass } = _decorator;

@ccclass('Localizator')
export class Localizator {


    public static readonly eventTarget: EventTarget = new EventTarget();
    public static readonly localizationLoaded: string = "localizationLoaded";
    public static localizationAlreadyLoaded: boolean = false;

    public static onLocalizationLoaded() {
        console.log("local event");
        Localizator.eventTarget.emit(Localizator.localizationLoaded);
        Localizator.localizationAlreadyLoaded = true;
    }

    public static getLocalizeSprite(name: string) {
        return Main.instance.localizedAssets[name];
    }
}


