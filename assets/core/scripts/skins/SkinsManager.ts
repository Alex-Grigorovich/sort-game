import { _decorator, EventTarget, SpriteFrame } from 'cc';
import { Main } from '../playableCore/Main';
const { ccclass } = _decorator;

@ccclass('SkinsManager')
export class SkinsManager {

    public static readonly eventTarget: EventTarget = new EventTarget();
    public static readonly skinsLoaded: string = "skinsLoaded";
    public static readonly skinChanged: string = "skinChanged";
    public static skinsAlreadyLoaded: boolean = false;
    /**
     * Уведомляет о том, что скины загружены
     */
    public static onSkinsLoaded() {

        SkinsManager.eventTarget.emit(SkinsManager.skinsLoaded);
        SkinsManager.skinsAlreadyLoaded = true;
    }

    /**
     * Уведомляет о смене скина
     */
    public static onSkinChanged() {

        SkinsManager.eventTarget.emit(SkinsManager.skinChanged);
    }

    /**
     * Получить спрайт скина по ключу
     */
    public static getSkinnedSprite(name: string): SpriteFrame | null {
        const skinnedAssets = Main.instance.skinnedAssets;
        if (!skinnedAssets) {

            return null;
        }

        const result = skinnedAssets[name] || null;
        if (!result) {

        }

        return result;
    }

    /**
     * Проверить, есть ли спрайт скина
     */
    public static hasSkinnedSprite(name: string): boolean {
        if (!Main.instance.skinnedAssets) {
            return false;
        }
        return name in Main.instance.skinnedAssets;
    }

    /**
     * Получить все доступные скины
     */
    public static getAllSkinnedSprites(): { [key: string]: SpriteFrame } {
        return Main.instance.skinnedAssets || {};
    }

    /**
     * Получить все кадры анимации по частичному совпадению ключа
     * Например, для ключа "small_" найдет "small_000", "small_111" и т.д.
     */
    public static getAnimationFramesByKey(framesKey: string): SpriteFrame[] {
        const skinnedAssets = (GameState as any).skinnedAssets;
        if (!skinnedAssets) {

            return [];
        }

        const frames: SpriteFrame[] = [];
        const assetKeys = Object.keys(skinnedAssets);

        // Фильтруем ключи, которые начинаются с framesKey
        const matchingKeys = assetKeys.filter(key => key.startsWith(framesKey));

        // Сортируем ключи для правильного порядка кадров
        matchingKeys.sort();

        // Собираем кадры в правильном порядке
        for (const key of matchingKeys) {
            const frame = skinnedAssets[key];
            if (frame) {
                frames.push(frame);
            }
        }


        return frames;
    }
}
