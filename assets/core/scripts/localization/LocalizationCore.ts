import { _decorator, assetManager, SpriteFrame } from 'cc';
import { Main } from '../playableCore/Main';

export class LocalizationCore {

    private localizedAssets!: { [key: string]: SpriteFrame };


    /**
     * Инициализация бандлов локализации, по дефолту грузит бандл "lang_en".
     */

    public async init(): Promise<void> {
        //@ts-ignore
        this.localizedAssets = await loadLocalizedBundle(window.localizationCore ? `lang_${window.localizationCore.lang}` : `lang_${Main.instance.defaultLanguage}`);
    }

    /**
     * Словарь локализированных спрайтов
     */

    get assets(): { [key: string]: SpriteFrame } {
        return this.localizedAssets;
    }
}

/** 
 * Возвращает словарь спрайтов
 * 
 * @param {string} bundleName - Название бандла, e.g. "lang_en"
 * 
 */

const loadLocalizedBundle = async (bundleName: string): Promise<{ [key: string]: SpriteFrame }> => {
    const spriteFrames: { [key: string]: SpriteFrame } = {};

    return new Promise((resolve, reject) => {
        assetManager.loadBundle(bundleName, (err, bundle) => {
            if (err || !bundle) {
                reject(err);
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


export default new LocalizationCore();


