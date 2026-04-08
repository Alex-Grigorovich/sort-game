import { _decorator, assetManager, SpriteFrame } from 'cc';
import playableCore from '../playableCore/playableCore';

export class SkinsCore {
    private skinnedAssets!: { [key: string]: SpriteFrame };

    /**
     * Инициализация бандлов скинов.
     * @param defaultSkin - Скин по умолчанию из Main.ts
     */
    async init(defaultSkin: string = 'default'): Promise<void> {
        let skinToUse = defaultSkin;

        // Проверяем параметр prod из playableCore
        const prodParam = playableCore.getParam('prod');

        if (prodParam === false) {
            // Если prod = false, используем defaultSkin из Main
            skinToUse = defaultSkin;

        } else {
            // Если prod = true или не задан, используем стандартную логику
            //@ts-ignore
            skinToUse = window.skinsCore ? window.skinsCore.skin : defaultSkin;

        }

        this.skinnedAssets = await loadSkinnedBundle(`skin_${skinToUse}`);
    }

    /**
     * Словарь скиновых спрайтов
     */
    get assets(): { [key: string]: SpriteFrame } {
        return this.skinnedAssets;
    }

    /**
     * Получить скин по ключу
     */
    getSprite(key: string): SpriteFrame | null {
        return this.skinnedAssets[key] || null;
    }

    /**
     * Проверить, загружены ли скины
     */
    isLoaded(): boolean {
        return this.skinnedAssets !== undefined;
    }
}

/** 
 * Возвращает словарь спрайтов скинов
 * 
 * @param {string} bundleName - Название бандла, e.g. "skin_test1"
 * 
 */
const loadSkinnedBundle = async (bundleName: string): Promise<{ [key: string]: SpriteFrame }> => {
    const spriteFrames: { [key: string]: SpriteFrame } = {};

    return new Promise((resolve) => {
        assetManager.loadBundle(bundleName, (err, bundle) => {
            if (err || !bundle) {

                resolve(spriteFrames);
                return;
            }

            const assets = bundle.getDirWithPath('', SpriteFrame);

            let remaining = assets.length;
            if (remaining === 0) {

                resolve(spriteFrames);
                return;
            }



            assets.forEach(asset => {
                bundle.load(asset.path, SpriteFrame, (err, spriteFrame) => {
                    if (!err && spriteFrame) {
                        spriteFrames[spriteFrame.name] = spriteFrame;

                    }

                    remaining--;
                    if (remaining === 0) {

                        resolve(spriteFrames);
                    }
                });
            });
        });
    });
};

export default new SkinsCore();