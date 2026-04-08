export class playableCore {

    /**
     * @param {string} name - Название параметра с version.cjs
     */

    getParam(name: string): any | null {
        try {
            //@ts-ignore
            return window.playableCore.version[name];
        }
        catch (error) {
            return null;
        }
    }

    /**
     * Загружает выбранную версию из versions.cjs для не прод режима
     * @param versionsData - Объект versions из versions.cjs (с полем selectedVersion)
     */
    loadSelectedVersion(versionsData: any): void {
        try {
            // Сохраняем текущее значение prod перед загрузкой версии
            //@ts-ignore
            const currentProd = window.playableCore?.version?.prod;
            const isNotProd = currentProd === false || currentProd === null || !currentProd;

            // versionsData - это объект versions из versions.cjs
            // Он является массивом версий, но также имеет свойства: language, selectedVersion, variables
            let versionsArray: any[] = [];
            let selectedVersionName: string | null = null;

            // Проверяем, является ли versionsData массивом (что и есть в versions.cjs)
            if (Array.isArray(versionsData)) {
                versionsArray = versionsData;
                // Проверяем наличие selectedVersion в объекте (versions.selectedVersion)
                //@ts-ignore
                if (versionsData.selectedVersion && typeof versionsData.selectedVersion === 'string') {
                    selectedVersionName = versionsData.selectedVersion;
                } else {
                    // Старый формат: ищем версию с selected = true
                    const selectedVersion = versionsArray.find((v: any) => v.selected === true);
                    if (selectedVersion) {
                        selectedVersionName = selectedVersion.name || selectedVersion.version;
                    }
                }
            } else if (versionsData && typeof versionsData === 'object') {
                // Если это объект, проверяем наличие selectedVersion
                if (versionsData.selectedVersion && typeof versionsData.selectedVersion === 'string') {
                    selectedVersionName = versionsData.selectedVersion;
                }
                // Пытаемся найти массив версий в объекте
                // versionsData может быть объектом с числовыми ключами (массивоподобный объект)
                if (Array.isArray(versionsData)) {
                    versionsArray = versionsData;
                } else {
                    // Фильтруем все значения объекта, которые являются версиями
                    versionsArray = Object.values(versionsData).filter((v: any) =>
                        typeof v === 'object' && v !== null && 'name' in v && !Array.isArray(v)
                    ) as any[];
                }
            }

            // Находим версию по имени
            if (selectedVersionName && versionsArray.length > 0) {
                const selectedVersion = versionsArray.find((v: any) => (v.name || v.version) === selectedVersionName);

                if (selectedVersion) {
                    // Инициализируем window.playableCore если его нет
                    //@ts-ignore
                    if (!window.playableCore) {
                        //@ts-ignore
                        window.playableCore = {};
                    }
                    // Устанавливаем версию (копируем все поля)
                    const versionData: any = {};
                    Object.keys(selectedVersion).forEach(key => {
                        if (key !== 'selected') { // Исключаем старое поле selected
                            versionData[key] = selectedVersion[key];
                        }
                    });
                    //@ts-ignore
                    window.playableCore.version = versionData;

                    // Если мы не в прод режиме, параметр prod должен оставаться false
                    if (isNotProd) {
                        //@ts-ignore
                        window.playableCore.version.prod = false;
                    }

                    console.log('✅ Loaded selected version:', selectedVersionName, versionData);
                } else {
                    console.warn('❌ Selected version not found:', selectedVersionName, 'Available versions:', versionsArray.map((v: any) => v.name || v.version));
                }
            } else {
                console.warn('❌ Could not find selected version. selectedVersionName:', selectedVersionName, 'versionsArray length:', versionsArray.length, 'versionsData type:', typeof versionsData, 'isArray:', Array.isArray(versionsData));
            }
        } catch (error) {
            console.error('❌ Error loading selected version:', error);
        }
    }
    getUrlParam(name: string): string | null {
        try {
            if (typeof window === 'undefined') {
                return null;
            }
            const decode = (v: string) => {
                try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch { return v; }
            };
            const extract = (query: string): Record<string, string> => {
                const map: Record<string, string> = {};
                if (!query) return map;
                const q = query.charAt(0) === '?' || query.charAt(0) === '#' ? query.substring(1) : query;
                const pairs = q.split('&');
                for (let i = 0; i < pairs.length; i++) {
                    const pair = pairs[i];
                    if (!pair) continue;
                    const eqIdx = pair.indexOf('=');
                    if (eqIdx === -1) {
                        const key = decode(pair);
                        if (key && !(key in map)) map[key] = '';
                    } else {
                        const key = decode(pair.substring(0, eqIdx));
                        const val = decode(pair.substring(eqIdx + 1));
                        if (key && !(key in map)) map[key] = val;
                    }
                }
                return map;
            };

            const searchParams = extract(window.location.search || '');
            if (name in searchParams) return searchParams[name];
            // Часто параметры могут попадать в hash-часть
            const hash = window.location.hash || '';
            const hashQueryIndex = hash.indexOf('?');
            if (hashQueryIndex !== -1) {
                const hashParams = extract(hash.substring(hashQueryIndex + 1));
                if (name in hashParams) return hashParams[name];
            }
            return null;
        } catch {
            return null;
        }
    }
}

export default new playableCore();


