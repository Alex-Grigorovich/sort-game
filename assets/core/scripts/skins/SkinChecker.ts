import { _decorator, Component } from 'cc';
import { SkinsManager } from './SkinsManager';
import playableCore from '../playableCore/playableCore';
import { property } from '../playableCore/property';
import { Main } from '../playableCore/Main';




const { ccclass } = _decorator;

/**
 * Компонент для проверки соответствия текущего скина заданному ключу.
 * Если скин не соответствует ключу, объект будет отключен.
 */
@ccclass('SkinChecker')
export class SkinChecker extends Component {

    @property({
        displayName: "Ключ скина",
        tooltip: "Ключ скина, при котором объект должен быть активен. Если текущий скин не соответствует этому ключу, объект будет отключен."
    })
    private _skinKey: string = "";

    @property({
        displayName: "Инвертировать логику",
        tooltip: "Если включено, объект будет активен только когда скин НЕ соответствует ключу"
    })
    private _invertLogic: boolean = false;

    @property({
        displayName: "Проверять при старте",
        tooltip: "Выполнять проверку скина при старте компонента"
    })
    private _checkOnStart: boolean = true;

    private _originalActiveState: boolean = true;



    /**
    * Установить ключ скина
    */
    public setSkinKey(key: string): void {
        this._skinKey = key;
        this.checkSkin();
    }

    /**
     * Получить текущий ключ скина
     */
    public getSkinKey(): string {
        return this._skinKey;
    }

    /**
     * Установить инвертированную логику
     */
    public setInvertLogic(invert: boolean): void {
        this._invertLogic = invert;
        this.checkSkin();
    }


    /**
     * Принудительно выполнить проверку скина
     */
    public forceCheck(): void {
        this.checkSkin();
    }

    /**
     * Восстановить изначальное состояние активности
     */
    public restoreOriginalState(): void {
        this.node.active = this._originalActiveState;
    }

    /**
     * Получить текущий активный скин (публичный метод)
     */
    public getCurrentSkinName(): string {
        return this.getCurrentSkin();
    }

    /**
     * Проверить, соответствует ли текущий скин заданному ключу (публичный метод)
     */
    public isCurrentSkinMatching(requiredSkin: string): boolean {
        const currentSkin = this.getCurrentSkin();
        return this.isSkinMatching(currentSkin, requiredSkin);
    }

    /**
     * Получить список всех доступных скинов
     */
    public getAvailableSkins(): string[] {
        const skinnedAssets = Main.instance.skinnedAssets;
        if (!skinnedAssets) {
            return [];
        }

        const assetKeys = Object.keys(skinnedAssets);
        const skins = new Set<string>();

        // Извлекаем названия скинов из ключей ресурсов
        assetKeys.forEach(key => {
            // Ищем паттерны типа "skin_name_resource" или "name_resource"
            const match = key.match(/(?:skin_)?([a-zA-Z]+)_/);
            if (match && match[1]) {
                skins.add(match[1]);
            }
        });

        return Array.from(skins);
    }

    /**
     * Установить несколько ключей скинов (объект будет активен если текущий скин соответствует любому из них)
     */
    public setSkinKeys(keys: string[]): void {
        this._skinKey = keys.join(',');
        this.checkSkin();
    }

    protected override onLoad(): void {
        // Сохраняем изначальное состояние активности
        this._originalActiveState = this.node.active;
    }

    protected override start(): void {
        // Подписываемся на события смены скинов
        SkinsManager.eventTarget.on(SkinsManager.skinsLoaded, this.onSkinsLoaded.bind(this), this);
        SkinsManager.eventTarget.on(SkinsManager.skinChanged, this.onSkinChanged.bind(this), this);

        // Выполняем проверку при старте, если включено
        if (this._checkOnStart) {
            this.checkSkin();
        }
    }

    protected override onDestroy(): void {
        // Отписываемся от событий
        SkinsManager.eventTarget.off(SkinsManager.skinsLoaded, this.onSkinsLoaded.bind(this), this);
        SkinsManager.eventTarget.off(SkinsManager.skinChanged, this.onSkinChanged.bind(this), this);
    }

    private onSkinsLoaded(): void {
        this.checkSkin();
    }

    private onSkinChanged(): void {
        this.checkSkin();
    }

    /**
     * Проверяет соответствие текущего скина заданному ключу
     */
    private checkSkin(): void {
        if (!this._skinKey) {

            return;
        }

        const currentSkin = this.getCurrentSkin();

        // Проверяем, содержит ли ключ несколько скинов (разделенных запятыми)
        const isSkinMatch = this._skinKey.includes(',')
            ? this.isSkinMatchingAny(currentSkin, this._skinKey)
            : this.isSkinMatching(currentSkin, this._skinKey);

        // Применяем логику (обычную или инвертированную)
        const shouldBeActive = this._invertLogic ? !isSkinMatch : isSkinMatch;

        // Устанавливаем активность узла
        this.node.active = shouldBeActive;


    }

    /**
     * Получает текущий активный скин (аналогично SkinsCore)
     */
    private getCurrentSkin(): string {
        try {
            // Получаем defaultSkin из Main.instance (как в SkinsCore)
            const defaultSkin = Main.instance ? Main.instance.defaultSkin : 'default';
            let skinToUse = defaultSkin;

            // Проверяем параметр prod из playableCore (точно как в SkinsCore)
            const prodParam = playableCore.getParam('prod');

            if (prodParam === false) {
                // Если prod = false, используем defaultSkin из Main (dev режим)
                skinToUse = defaultSkin;
            } else {
                // Если prod = true или не задан, используем стандартную логику
                //@ts-ignore
                skinToUse = window.skinsCore ? window.skinsCore.skin : defaultSkin;
            }

            return skinToUse;
        } catch (error) {

            return 'default';
        }
    }


    /**
     * Проверяет, соответствует ли текущий скин заданному ключу
     */
    private isSkinMatching(currentSkin: string, requiredSkin: string): boolean {
        // Точное совпадение
        if (currentSkin === requiredSkin) {
            return true;
        }

        // Проверка на частичное совпадение (если требуется)
        // Например, если requiredSkin = "halloween", а currentSkin = "halloween_special"
        if (currentSkin.includes(requiredSkin) || requiredSkin.includes(currentSkin)) {
            return true;
        }

        return false;
    }



    /**
     * Проверить, соответствует ли текущий скин любому из заданных ключей
     */
    private isSkinMatchingAny(currentSkin: string, requiredSkins: string): boolean {
        const keys = requiredSkins.split(',').map(key => key.trim());
        return keys.some(key => this.isSkinMatching(currentSkin, key));
    }
}
