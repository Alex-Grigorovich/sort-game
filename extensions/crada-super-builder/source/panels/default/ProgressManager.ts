/**
 * ProgressManager - управление прогрессом сборки
 * Отвечает за отслеживание и отображение прогресса всех этапов сборки
 */

export interface ProgressData {
    percentage: number;
    currentTask: string;
    eta: number;
}

export interface SftpProgressData {
    current: number;
    total: number;
    percentage: number;
    eta: number;
    currentTask: string;
}

export interface SftpCleanInfo {
    path: string;
    totalItems: number;
    items: Array<{
        type: string;
        name: string;
        path: string;
        size?: string;
        permissions?: string;
        modifyTime?: string;
    }>;
}

export interface ProgressManagerUIElements {
    // Checkbox секции для отображения прогресса
    mainBuildSection?: HTMLElement;
    superhtmlSection?: HTMLElement;
    sftpSection?: HTMLElement;
    // Индикаторы прогресса внутри секций
    mainBuildProgress?: HTMLElement;
    superhtmlProgress?: HTMLElement;
    sftpProgress?: HTMLElement;
    // Элементы времени
    mainBuildTime?: HTMLElement;
    superhtmlTime?: HTMLElement;
    sftpTime?: HTMLElement;
    // Статусы прогресса
    mainBuildStatus?: HTMLElement;
    superhtmlStatus?: HTMLElement;
    sftpStatus?: HTMLElement;
    sftpCleanInfo?: HTMLElement;
}

export interface StageTiming {
    start: Date;
    end?: Date;
    duration?: number;
}

export interface StageTimings {
    mainBuild?: StageTiming;
    superHtmlBuild?: StageTiming;
    sftpLoad?: StageTiming;
}

export interface BuiltFileInfo {
    versionName: string;
    langCode: string;
    buildTime: number;
    sizeKB: number;
    fileName?: string;
}

export class ProgressManager {
    private mainBuildProgress: ProgressData = { percentage: 0, currentTask: '', eta: 0 };
    private superHtmlProgress: ProgressData = { percentage: 0, currentTask: '', eta: 0 };
    private sftpProgress: SftpProgressData = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
    private builtFiles: BuiltFileInfo[] = [];
    private sftpCleanInfo: SftpCleanInfo = { path: '', totalItems: 0, items: [] };

    // Время этапов
    private stageTimings: StageTimings = {};

    // Текущее время для отображения
    private mainBuildCurrentTime: string = '0с';
    private superHtmlCurrentTime: string = '0с';
    private sftpCurrentTime: string = '0с';

    // Анимация прогресса SuperHTML
    private superHtmlTargetPercentage: number = 0;
    private superHtmlAnimationInterval: NodeJS.Timeout | null = null;

    // Анимация прогресса SFTP
    private sftpTargetPercentage: number = 0;
    private sftpAnimationInterval: NodeJS.Timeout | null = null;

    // Интервалы для обновления времени в реальном времени
    private progressTimeIntervals: {
        mainBuild?: NodeJS.Timeout;
        superHtmlBuild?: NodeJS.Timeout;
        sftpLoad?: NodeJS.Timeout;
    } = {};

    // Мониторинг застрявшего прогресса
    private stuckProgressTimeout: NodeJS.Timeout | null = null;
    private lastProgressUpdate: number = 0;

    // UI элементы
    private uiElements: ProgressManagerUIElements & {
        // Совместимость со старым кодом (алиасы)
        progressMain?: HTMLElement;
        progressSuperhtml?: HTMLElement;
        progressSftp?: HTMLElement;
        progressMainTime?: HTMLElement;
        progressSuperhtmlTime?: HTMLElement;
        progressSftpTime?: HTMLElement;
        // Элементы прогресс-баров
        mainBuildProgressFill?: HTMLElement;
        superhtmlProgressFill?: HTMLElement;
        sftpProgressFill?: HTMLElement;
        mainBuildPercentage?: HTMLElement;
        superhtmlPercentage?: HTMLElement;
        sftpPercentage?: HTMLElement;
    } = {} as any;

    constructor(uiElements: ProgressManagerUIElements) {
        this.uiElements = uiElements;

        // Устанавливаем алиасы для совместимости со старым кода
        this.uiElements.progressMain = this.uiElements.mainBuildSection;
        this.uiElements.progressSuperhtml = this.uiElements.superhtmlSection;
        // sftpProgress должен указывать на сам прогресс-бар, а не на секцию
        this.uiElements.progressMainTime = this.uiElements.mainBuildTime;
        this.uiElements.progressSuperhtmlTime = this.uiElements.superhtmlTime;
        this.uiElements.progressSftpTime = this.uiElements.sftpTime;
    }

    /**
     * Парсинг прогресса основного билда из логов
     */
    parseMainBuildProgress(msg: string): boolean {
        // Парсим прогресс из строк вида "09.09.2025 21:20:42 - debug: Generate systemJs..., progress: 17%"
        const progressMatch = msg.match(/progress:\s*(\d+)%/);
        if (progressMatch) {
            const newPercentage = parseInt(progressMatch[1]);

            // Обновляем прогресс только если он увеличился (избегаем отката прогресса)
            if (newPercentage >= this.mainBuildProgress.percentage) {
                this.mainBuildProgress.percentage = newPercentage;

                // Извлекаем название текущей задачи из разных форматов
                let taskMatch = msg.match(/debug:\s*(.+?),\s*progress:/);
                if (!taskMatch) {
                    // Пробуем другой формат: "log: run build task ... success in X ms√, progress: Y%"
                    taskMatch = msg.match(/log:\s*run build task\s+(.+?)\s+success/);
                }
                if (!taskMatch) {
                    // Пробуем формат: "debug: TaskName start..., progress: Y%"
                    taskMatch = msg.match(/debug:\s*([^:]+?)\s+start[^,]*,\s*progress:/);
                }

                if (taskMatch) {
                    this.mainBuildProgress.currentTask = taskMatch[1].trim();
                }

                this.updateMainBuildProgress();
                this.updateLastProgressTime();
                return true;
            }
        }

        // Расширенные паттерны для определения завершения билда
        const completionPatterns = [
            'build success',
            'build Task.*Finished',
            'Build completed successfully',
            'Build finished',
            'Compilation completed',
            'Build process completed',
            'web-mobile.*build.*success',
            'build.*success.*in.*ms',
            'Build.*finished.*successfully'
        ];

        for (const pattern of completionPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(msg)) {
                if (this.mainBuildProgress.percentage < 100) {
                    this.mainBuildProgress.percentage = 100;
                    this.mainBuildProgress.currentTask = 'Завершено';
                    this.updateMainBuildProgress();
                    this.updateLastProgressTime();
                    return true;
                }
            }
        }

        // Обрабатываем случай ошибки билда
        const errorPatterns = [
            'build error',
            'build failed',
            'error:.*build',
            'Build failed',
            'Compilation failed',
            'Build process failed'
        ];

        for (const pattern of errorPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(msg)) {
                this.mainBuildProgress.currentTask = 'Ошибка';
                this.updateMainBuildProgress();
                return true;
            }
        }

        // Дополнительная проверка: если прогресс достиг 99% и прошло время, принудительно завершаем
        if (this.mainBuildProgress.percentage >= 99) {
            // Если прогресс застрял на 99%, ждем немного и принудительно завершаем
            setTimeout(() => {
                if (this.mainBuildProgress.percentage >= 99 && this.mainBuildProgress.percentage < 100) {
                    this.mainBuildProgress.percentage = 100;
                    this.mainBuildProgress.currentTask = 'Завершено';
                    this.updateMainBuildProgress();
                }
            }, 2000); // Ждем 2 секунды
        }

        return false;
    }

    /**
     * Парсинг прогресса SuperHTML билда из логов
     */
    parseSuperHtmlProgress(msg: string): boolean {
        // Проверяем, есть ли в сообщении [SUPERHTML_SUCCESS]

        // Парсим структурированные логи с ключами
        const progressMatch = msg.match(/\[SUPERHTML_PROGRESS\] (\d+)% (.+)/);
        if (progressMatch) {
            const targetPercentage = parseInt(progressMatch[1]);
            this.superHtmlProgress.currentTask = progressMatch[2];
            // Используем плавную анимацию для перехода к новому проценту
            this.animateSuperHtmlProgress(targetPercentage, 800);
            return true;
        }

        // Парсим завершение этапа
        const stageCompleteMatch = msg.match(/\[SUPERHTML_STAGE\] (.+) completed/);
        if (stageCompleteMatch) {
            this.superHtmlProgress.currentTask = stageCompleteMatch[1] + ' - завершено';
            this.updateSuperHtmlProgress();
            return true;
        }

        // Парсим ошибки
        const errorMatch = msg.match(/\[SUPERHTML_ERROR\] (.+)/);
        if (errorMatch) {
            this.superHtmlProgress.currentTask = 'Ошибка: ' + errorMatch[1];
            this.updateSuperHtmlProgress();
            return true;
        }

        // Парсим успешное завершение с улучшенными регулярными выражениями
        // Основной паттерн: [SUPERHTML_SUCCESS] versionName (lang) завершен за Xs, размер: YKB
        const successMatch = msg.match(/\[SUPERHTML_SUCCESS\]\s*(.+?)\s*\((\w+)\)\s*завершен\s*за\s*([\d.]+)s,\s*размер:\s*([\d.]+)KB/);
        if (successMatch) {
            const versionName = successMatch[1].trim();
            const langCode = successMatch[2];
            const buildTime = parseFloat(successMatch[3]);
            const sizeKB = parseFloat(successMatch[4]);


            // Сохраняем информацию о собранном файле
            this.builtFiles.push({
                versionName,
                langCode,
                buildTime,
                sizeKB,
                fileName: `${versionName}_${langCode}.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен за ${buildTime}s, размер: ${sizeKB}KB`;
            // Плавно доводим до 100%
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }

        // Парсим сообщения о завершении файлов из логов
        // Ищем паттерн "✓ versionName (lang) завершен за Xs, размер: YkbKB"
        const logCompleteMatch = msg.match(/✓\s*(\w+)\s*\((\w+)\)\s*завершен\s*за\s*([\d.]+)s,\s*размер:\s*([\d.]+)\s*kbKB/);
        if (logCompleteMatch) {
            const versionName = logCompleteMatch[1];
            const langCode = logCompleteMatch[2];
            const buildTime = parseFloat(logCompleteMatch[3]);
            const sizeKB = parseFloat(logCompleteMatch[4]);


            // Сохраняем информацию о собранном файле
            this.builtFiles.push({
                versionName,
                langCode,
                buildTime,
                sizeKB,
                fileName: `${versionName}_${langCode}.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен за ${buildTime}s, размер: ${sizeKB}KB`;
            return true;
        }

        // Парсим сообщения о завершении файлов из других форматов (fallback)
        // Ищем паттерн "versionName (lang) завершен за Xs, размер: YKB"
        const fileCompleteMatch = msg.match(/(\w+)\s*\((\w+)\)\s*завершен\s*за\s*([\d.]+)s,\s*размер:\s*([\d.]+)\s*kbKB/);
        if (fileCompleteMatch) {
            const versionName = fileCompleteMatch[1];
            const langCode = fileCompleteMatch[2];
            const buildTime = parseFloat(fileCompleteMatch[3]);
            const sizeKB = parseFloat(fileCompleteMatch[4]);


            // Сохраняем информацию о собранном файле
            this.builtFiles.push({
                versionName,
                langCode,
                buildTime,
                sizeKB,
                fileName: `${versionName}_${langCode}.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (${langCode}) завершен за ${buildTime}s, размер: ${sizeKB}KB`;
            return true;
        }

        // Дополнительные паттерны для определения размера файла
        // Ищем любые сообщения с размером в KB
        const sizeMatch = msg.match(/размер:\s*([\d.]+)KB/);
        if (sizeMatch && !msg.includes('[SUPERHTML_SUCCESS]') && !msg.includes('✓')) {
            const sizeKB = parseFloat(sizeMatch[1]);

            // Пытаемся извлечь информацию о версии и языке из контекста
            const versionMatch = msg.match(/(\w+)\s*\((\w+)\)/);
            if (versionMatch) {
                const versionName = versionMatch[1];
                const langCode = versionMatch[2];

                // Проверяем, не добавлен ли уже этот файл
                const existingFile = this.builtFiles.find(f => f.versionName === versionName && f.langCode === langCode);
                if (!existingFile) {
                    this.builtFiles.push({
                        versionName,
                        langCode,
                        buildTime: 0, // Время неизвестно
                        sizeKB,
                        fileName: `${versionName}_${langCode}.html`
                    });
                }
            }
        }

        // Fallback для старого формата SUCCESS (без детальной информации)
        const simpleSuccessMatch = msg.match(/\[SUPERHTML_SUCCESS\] (.+)/);
        if (simpleSuccessMatch) {
            this.superHtmlProgress.currentTask = simpleSuccessMatch[1];
            // Плавно доводим до 100%
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }

        // Парсим сообщения SFTP с завершением файлов
        // Формат: ✅ 'versionName' (SFTP) | 🕓 time
        const sftpCompleteMatch = msg.match(/✅\s*'([^']+)'\s*\(SFTP\)\s*\|\s*🕓\s*([\d.]+)s/);
        if (sftpCompleteMatch) {
            const versionName = sftpCompleteMatch[1];
            const buildTime = parseFloat(sftpCompleteMatch[2]);


            // Для SFTP файлов мы не знаем размер, но можем добавить файл с примерным размером
            // или попробовать получить размер из файловой системы
            this.builtFiles.push({
                versionName,
                langCode: 'SFTP', // Указываем что это SFTP файл
                buildTime,
                sizeKB: 0, // Размер неизвестен для SFTP файлов
                fileName: `${versionName}_sftp.html`
            });

            this.superHtmlProgress.currentTask = `${versionName} (SFTP) завершен за ${buildTime}s`;
            return true;
        }

        // Fallback для старых логов (временно)
        if (msg.includes('⏳ Инициализация сборки...')) {
            this.superHtmlProgress.currentTask = 'Инициализация';
            this.animateSuperHtmlProgress(10, 500);
            return true;
        } else if (msg.includes('⏳ Ждем паковки...')) {
            this.superHtmlProgress.currentTask = 'Ожидание паковки';
            this.animateSuperHtmlProgress(20, 500);
            return true;
        } else if (msg.includes('✅') && msg.includes('| 🕓') && msg.includes('| 📦')) {
            this.superHtmlProgress.currentTask = 'Завершено';
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }

        return false;
    }

    /**
     * Парсинг структурированных SFTP логов
     */
    parseSftpLogs(msg: string): boolean {
        let hasUpdates = false;


        // Парсим прогресс загрузки
        const progressMatch = msg.match(/\[SFTP_PROGRESS\] (\d+)\/(\d+) ([\d.]+)% (\d+)s/);
        if (progressMatch) {
            const targetPercentage = parseFloat(progressMatch[3]);
            this.sftpProgress.current = parseInt(progressMatch[1]);
            this.sftpProgress.total = parseInt(progressMatch[2]);
            this.sftpProgress.eta = parseInt(progressMatch[4]);

            // Используем плавную анимацию для перехода к новому проценту
            this.animateSftpProgress(targetPercentage, 800);
            hasUpdates = true;
        }

        // Парсим начало информации о папке
        const cleanInfoStartMatch = msg.match(/\[SFTP_CLEAN_INFO_START\] (.+) (\d+)/);
        if (cleanInfoStartMatch) {
            this.sftpCleanInfo = {
                path: cleanInfoStartMatch[1],
                totalItems: parseInt(cleanInfoStartMatch[2]),
                items: []
            };
            hasUpdates = true;
        }

        // Парсим элементы для удаления
        // Для папок: [SFTP_CLEAN_ITEM] FOLDER name path - permissions modifyTime
        // Для файлов: [SFTP_CLEAN_ITEM] FILE name path size formattedSize permissions modifyTime

        // Обрабатываем все элементы в сообщении (может быть несколько)
        const folderMatches = msg.matchAll(/\[SFTP_CLEAN_ITEM\] FOLDER (.+) (.+) - (.+) (.+)/g);
        for (const match of folderMatches) {
            const item = {
                type: 'FOLDER',
                name: match[1],
                path: match[2],
                size: undefined,
                permissions: match[3],
                modifyTime: match[4]
            };
            this.sftpCleanInfo.items.push(item);
            hasUpdates = true;
        }

        const fileMatches = msg.matchAll(/\[SFTP_CLEAN_ITEM\] FILE (.+) (.+) (.+) (.+) (.+) (.+)/g);
        for (const match of fileMatches) {
            const item = {
                type: 'FILE',
                name: match[1],
                path: match[2],
                size: match[4], // formattedSize
                permissions: match[5],
                modifyTime: match[6]
            };
            this.sftpCleanInfo.items.push(item);
            hasUpdates = true;
        }

        // Парсим статистику
        const cleanStatsMatch = msg.match(/\[SFTP_CLEAN_STATS\] (\d+) (\d+) (\d+) (\d+) (.+)/);
        if (cleanStatsMatch) {
            // Обновляем статистику в интерфейсе
            this.updateSftpCleanInfo();
            hasUpdates = true;
        }

        // Обновляем интерфейс после каждого добавления элемента
        if (hasUpdates) {
            this.updateSftpCleanInfo();
        }


        // Fallback для старых логов SFTP (временно)
        if (msg.includes('SFTP заливка началась')) {
            this.sftpProgress.currentTask = 'Инициализация';
            this.animateSftpProgress(10, 500);
            hasUpdates = true;
        } else if (msg.includes('Подключение к серверу')) {
            this.sftpProgress.currentTask = 'Подключение';
            this.animateSftpProgress(20, 500);
            hasUpdates = true;
        } else if (msg.includes('Загрузка файлов')) {
            this.sftpProgress.currentTask = 'Загрузка файлов';
            this.animateSftpProgress(50, 500);
            hasUpdates = true;
        } else if (msg.includes('SFTP заливка завершена успешно')) {
            this.sftpProgress.currentTask = 'Завершено';
            this.animateSftpProgress(100, 1000);
            hasUpdates = true;
        }

        return hasUpdates;
    }

    /**
     * Обновление прогресса основного билда в интерфейсе
     */
    updateMainBuildProgress(): void {
        const mainBuildTime = this.uiElements.mainBuildTime;
        const mainBuildSection = this.uiElements.mainBuildSection;
        const mainBuildProgress = this.uiElements.mainBuildProgress;
        const mainBuildStatus = this.uiElements.mainBuildStatus;
        const mainBuildProgressFill = this.uiElements.mainBuildProgressFill;
        const mainBuildPercentage = this.uiElements.mainBuildPercentage;

        // Обновляем время
        if (mainBuildTime) {
            mainBuildTime.textContent = `[${this.mainBuildCurrentTime}]`;
        }

        // Обновляем статус
        if (mainBuildStatus) {
            if (this.mainBuildProgress.percentage === 0) {
                mainBuildStatus.textContent = '⏳';
            } else if (this.mainBuildProgress.percentage < 100) {
                mainBuildStatus.textContent = '⏳';
            } else {
                mainBuildStatus.textContent = '✅';
            }
        }

        // Обновляем прогресс-бар
        if (mainBuildProgressFill) {
            mainBuildProgressFill.style.width = `${this.mainBuildProgress.percentage}%`;
        }

        // Обновляем процент
        if (mainBuildPercentage) {
            mainBuildPercentage.textContent = `${Math.round(this.mainBuildProgress.percentage)}%`;
        }

        // Обновляем состояние секции
        if (mainBuildSection) {
            // Убираем все классы состояний
            mainBuildSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');

            if (this.mainBuildProgress.percentage === 0) {
                mainBuildSection.classList.add('progress-pending');
            } else if (this.mainBuildProgress.percentage < 100) {
                mainBuildSection.classList.add('progress-active');
            } else {
                mainBuildSection.classList.add('progress-completed');
            }
        }

        // Показываем/скрываем индикатор прогресса
        if (mainBuildProgress) {
            if (this.mainBuildProgress.percentage > 0) {
                mainBuildProgress.classList.remove('hidden');
                mainBuildProgress.classList.remove('pending', 'completed', 'skipped');
                if (this.mainBuildProgress.percentage < 100) {
                    mainBuildProgress.classList.add('active');
                } else {
                    mainBuildProgress.classList.add('completed');
                }
            } else {
                mainBuildProgress.classList.add('hidden');
            }
        }
    }

    /**
     * Обновление прогресса SuperHTML в интерфейсе
     */
    updateSuperHtmlProgress(): void {
        const superhtmlTime = this.uiElements.superhtmlTime;
        const superhtmlSection = this.uiElements.superhtmlSection;
        const superhtmlProgress = this.uiElements.superhtmlProgress;
        const superhtmlStatus = this.uiElements.superhtmlStatus;
        const superhtmlProgressFill = this.uiElements.superhtmlProgressFill;
        const superhtmlPercentage = this.uiElements.superhtmlPercentage;

        // Обновляем время
        if (superhtmlTime) {
            superhtmlTime.textContent = `[${this.superHtmlCurrentTime}]`;
        }

        // Обновляем статус
        if (superhtmlStatus) {
            if (this.superHtmlProgress.percentage === 0) {
                superhtmlStatus.textContent = '⏳';
            } else if (this.superHtmlProgress.percentage < 100) {
                superhtmlStatus.textContent = '⏳';
            } else {
                superhtmlStatus.textContent = '✅';
            }
        }

        // Обновляем прогресс-бар
        if (superhtmlProgressFill) {
            superhtmlProgressFill.style.width = `${this.superHtmlProgress.percentage}%`;
        }

        // Обновляем процент
        if (superhtmlPercentage) {
            superhtmlPercentage.textContent = `${Math.round(this.superHtmlProgress.percentage)}%`;
        }

        // Обновляем состояние секции
        if (superhtmlSection) {
            // Убираем все классы состояний
            superhtmlSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');

            if (this.superHtmlProgress.percentage === 0) {
                superhtmlSection.classList.add('progress-pending');
            } else if (this.superHtmlProgress.percentage < 100) {
                superhtmlSection.classList.add('progress-active');
            } else {
                superhtmlSection.classList.add('progress-completed');
            }
        }

        // Показываем/скрываем индикатор прогресса
        if (superhtmlProgress) {
            if (this.superHtmlProgress.percentage > 0) {
                superhtmlProgress.classList.remove('hidden');
                superhtmlProgress.classList.remove('pending', 'completed', 'skipped');
                if (this.superHtmlProgress.percentage < 100) {
                    superhtmlProgress.classList.add('active');
                } else {
                    superhtmlProgress.classList.add('completed');
                }
            } else {
                superhtmlProgress.classList.add('hidden');
            }
        }
    }

    /**
     * Обновление прогресса SFTP в интерфейсе
     */
    updateSftpProgress(): void {
        const sftpTime = this.uiElements.sftpTime;
        const sftpSection = this.uiElements.sftpSection;
        const sftpProgress = this.uiElements.sftpProgress;
        const sftpStatus = this.uiElements.sftpStatus;
        const sftpProgressFill = this.uiElements.sftpProgressFill;
        const sftpPercentage = this.uiElements.sftpPercentage;

        // Обновляем время
        if (sftpTime) {
            // Обновляем время только если у нас есть данные о прогрессе
            if (this.sftpProgress.total > 0) {
                sftpTime.textContent = `[${this.sftpCurrentTime}] [${this.sftpProgress.current}/${this.sftpProgress.total}] ${Math.round(this.sftpProgress.percentage)}%`;
            } else {
                sftpTime.textContent = `[${this.sftpCurrentTime}]`;
            }
        }

        // Обновляем статус
        if (sftpStatus) {
            if (this.sftpProgress.percentage === 0) {
                sftpStatus.textContent = '⏳';
            } else if (this.sftpProgress.percentage < 100) {
                sftpStatus.textContent = '⏳';
            } else {
                sftpStatus.textContent = '✅';
            }
        }

        // Обновляем прогресс-бар
        if (sftpProgressFill) {
            sftpProgressFill.style.width = `${this.sftpProgress.percentage}%`;
        }

        // Обновляем процент
        if (sftpPercentage) {
            sftpPercentage.textContent = `${Math.round(this.sftpProgress.percentage)}%`;
        }

        // Обновляем состояние секции
        if (sftpSection) {
            // Убираем все классы состояний
            sftpSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');

            if (this.sftpProgress.percentage === 0) {
                sftpSection.classList.add('progress-pending');
            } else if (this.sftpProgress.percentage < 100) {
                sftpSection.classList.add('progress-active');
            } else {
                sftpSection.classList.add('progress-completed');
            }
        }

        // Показываем/скрываем индикатор прогресса
        if (sftpProgress) {
            // Показываем прогресс-бар если есть данные о прогрессе (total > 0) или если процент > 0
            if (this.sftpProgress.total > 0 || this.sftpProgress.percentage > 0) {
                sftpProgress.classList.remove('hidden');
                sftpProgress.classList.remove('pending', 'completed', 'skipped');
                if (this.sftpProgress.percentage === 0 && this.sftpProgress.total > 0) {
                    // Состояние ожидания - показываем как pending
                    sftpProgress.classList.add('pending');
                } else if (this.sftpProgress.percentage < 100) {
                    sftpProgress.classList.add('active');
                } else {
                    sftpProgress.classList.add('completed');
                }
            } else {
                sftpProgress.classList.add('hidden');
            }
        }
    }

    /**
     * Обновление информации о папках для удаления
     */
    updateSftpCleanInfo(): void {
        const sftpCleanInfoElement = this.uiElements.sftpCleanInfo;
        if (sftpCleanInfoElement && this.sftpCleanInfo.items.length > 0) {
            let html = `<div class="sftp-clean-header">
                <h4>Folder: ${this.sftpCleanInfo.path}</h4>
                <p>Total items: ${this.sftpCleanInfo.totalItems}</p>
            </div>`;

            // Группируем по типам
            const folders = this.sftpCleanInfo.items.filter(item => item.type === 'FOLDER');
            const files = this.sftpCleanInfo.items.filter(item => item.type === 'FILE');


            if (folders.length > 0) {
                html += '<div class="sftp-clean-group">';
                html += `<h5>Folders (${folders.length}):</h5>`;
                folders.forEach(folder => {
                    html += `<div class="sftp-clean-item folder">
                        <div class="item-name">${folder.name}</div>
                    </div>`;
                });
                html += '</div>';
            }

            if (files.length > 0) {
                html += '<div class="sftp-clean-group">';
                html += `<h5>Files (${files.length}):</h5>`;
                files.forEach(file => {
                    html += `<div class="sftp-clean-item file">
                        <div class="item-name">${file.name}</div>
                    </div>`;
                });
                html += '</div>';
            }

            // Добавляем предупреждение
            html += '<div class="sftp-clean-warning">';
            html += '<div class="warning-text">All these items will be deleted!</div>';
            html += '</div>';


            sftpCleanInfoElement.innerHTML = html;
        }
    }

    /**
     * Плавная анимация прогресса SuperHTML
     */
    animateSuperHtmlProgress(targetPercentage: number, duration: number = 1000): void {
        // Останавливаем предыдущую анимацию
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
        }

        const startPercentage = this.superHtmlProgress.percentage;
        const difference = targetPercentage - startPercentage;
        const startTime = Date.now();

        this.superHtmlAnimationInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Используем easing функцию для плавности
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPercentage = startPercentage + (difference * easeProgress);

            this.superHtmlProgress.percentage = currentPercentage;
            this.updateSuperHtmlProgress();

            if (progress >= 1) {
                this.superHtmlProgress.percentage = targetPercentage;
                this.updateSuperHtmlProgress();
                if (this.superHtmlAnimationInterval) {
                    clearInterval(this.superHtmlAnimationInterval);
                    this.superHtmlAnimationInterval = null;
                }
            }
        }, 16); // ~60 FPS
    }

    /**
     * Плавная анимация прогресса SFTP
     */
    animateSftpProgress(targetPercentage: number, duration: number = 1000): void {
        // Останавливаем предыдущую анимацию
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
        }

        const startPercentage = this.sftpProgress.percentage;
        const difference = targetPercentage - startPercentage;
        const startTime = Date.now();

        this.sftpAnimationInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Используем easing функцию для плавности
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPercentage = startPercentage + (difference * easeProgress);

            this.sftpProgress.percentage = currentPercentage;
            this.updateSftpProgress();

            if (progress >= 1) {
                this.sftpProgress.percentage = targetPercentage;
                this.updateSftpProgress();
                if (this.sftpAnimationInterval) {
                    clearInterval(this.sftpAnimationInterval);
                    this.sftpAnimationInterval = null;
                }
            }
        }, 16); // ~60 FPS
    }

    /**
     * Запуск отслеживания времени этапа
     */
    startStageTiming(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        this.stageTimings[stage] = { start: new Date() };

        // Запускаем обновление времени в реальном времени
        this.startProgressTimeUpdate(stage);
    }

    /**
     * Завершение отслеживания времени этапа
     */
    endStageTiming(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        if (this.stageTimings[stage]) {
            this.stageTimings[stage].end = new Date();
            this.stageTimings[stage].duration = Math.round(
                (this.stageTimings[stage].end!.getTime() - this.stageTimings[stage].start.getTime()) / 1000
            );
        }

        // Останавливаем обновление времени в реальном времени
        this.stopProgressTimeUpdate(stage);
    }

    /**
     * Форматирование времени этапа
     */
    formatStageTime(duration: number): string {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}м ${seconds}с`;
    }

    /**
     * Запуск обновления времени в реальном времени
     */
    private startProgressTimeUpdate(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        let timeElement: HTMLElement | null = null;

        switch (stage) {
            case 'mainBuild':
                timeElement = this.uiElements.mainBuildTime || null;
                break;
            case 'superHtmlBuild':
                timeElement = this.uiElements.superhtmlTime || null;
                break;
            case 'sftpLoad':
                timeElement = this.uiElements.sftpTime || null;
                break;
        }

        if (!timeElement) return;

        // Очищаем предыдущий интервал если есть
        if (this.progressTimeIntervals[stage]) {
            clearInterval(this.progressTimeIntervals[stage]);
        }

        // Запускаем новый интервал
        this.progressTimeIntervals[stage] = setInterval(() => {
            if (this.stageTimings[stage] && this.stageTimings[stage].start) {
                const now = new Date();
                const elapsed = Math.round((now.getTime() - this.stageTimings[stage].start.getTime()) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                const timeString = `${minutes}м ${seconds}с`;

                // Сохраняем время для соответствующего этапа
                if (stage === 'sftpLoad') {
                    this.sftpCurrentTime = timeString;
                    // Обновляем прогресс если есть данные
                    if (this.sftpProgress.total > 0) {
                        this.updateSftpProgress();
                    } else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                } else if (stage === 'mainBuild') {
                    // Сохраняем время для основного билда
                    this.mainBuildCurrentTime = timeString;
                    // Обновляем прогресс если есть данные
                    if (this.mainBuildProgress.percentage > 0) {
                        this.updateMainBuildProgress();
                    } else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                } else if (stage === 'superHtmlBuild') {
                    // Сохраняем время для SuperHTML билда
                    this.superHtmlCurrentTime = timeString;
                    timeElement.textContent = `[${timeString}]`;
                }
            }
        }, 1000);
    }

    /**
     * Остановка обновления времени в реальном времени
     */
    private stopProgressTimeUpdate(stage: 'mainBuild' | 'superHtmlBuild' | 'sftpLoad'): void {
        if (this.progressTimeIntervals[stage]) {
            clearInterval(this.progressTimeIntervals[stage]);
            this.progressTimeIntervals[stage] = undefined;
        }
    }

    /**
     * Очистка всех интервалов времени
     */
    clearAllProgressTimeIntervals(): void {
        Object.keys(this.progressTimeIntervals).forEach(stage => {
            if (this.progressTimeIntervals[stage as keyof typeof this.progressTimeIntervals]) {
                clearInterval(this.progressTimeIntervals[stage as keyof typeof this.progressTimeIntervals]);
            }
        });
        this.progressTimeIntervals = {};

        // Очищаем анимацию прогресса SuperHTML
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
            this.superHtmlAnimationInterval = null;
        }

        // Очищаем анимацию прогресса SFTP
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
            this.sftpAnimationInterval = null;
        }

        // Останавливаем мониторинг застрявшего прогресса
        this.stopStuckProgressMonitoring();
    }

    /**
     * Сброс всех прогрессов
     */
    resetAllProgress(): void {
        // Сбрасываем SFTP прогресс
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
        this.sftpCurrentTime = '0с';

        // Сбрасываем прогресс-бар SFTP
        const sftpSection = this.uiElements.sftpSection;
        if (sftpSection) {
            sftpSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Сбрасываем прогресс основного билда
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.mainBuildCurrentTime = '0с';

        // Сбрасываем прогресс-бар основного билда
        const mainBuildSection = this.uiElements.mainBuildSection;
        if (mainBuildSection) {
            mainBuildSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Останавливаем анимацию прогресса SuperHTML
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
            this.superHtmlAnimationInterval = null;
        }

        // Останавливаем анимацию прогресса SFTP
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
            this.sftpAnimationInterval = null;
        }

        // Сбрасываем прогресс SuperHTML билда
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlCurrentTime = '0с';

        // Сбрасываем прогресс-бар SuperHTML билда
        const superhtmlSection = this.uiElements.superhtmlSection;
        if (superhtmlSection) {
            superhtmlSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Сбрасываем время в прогресс-барах
        const timeElements = [
            this.uiElements.mainBuildTime,
            this.uiElements.superhtmlTime,
            this.uiElements.sftpTime
        ];

        timeElements.forEach(timeElement => {
            if (timeElement) {
                timeElement.textContent = '[0s]';
            }
        });

        // Очищаем список собранных файлов
        this.clearBuiltFiles();
    }

    /**
     * Сброс только прогресса (без очистки данных о файлах)
     */
    resetProgressOnly(): void {
        // Сбрасываем SFTP прогресс
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
        this.sftpCurrentTime = '0с';

        // Сбрасываем прогресс-бар SFTP
        const sftpSection = this.uiElements.sftpSection;
        if (sftpSection) {
            sftpSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Сбрасываем прогресс основного билда
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.mainBuildCurrentTime = '0с';

        // Сбрасываем прогресс-бар основного билда
        const mainBuildSection = this.uiElements.mainBuildSection;
        if (mainBuildSection) {
            mainBuildSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Останавливаем анимацию прогресса SuperHTML
        if (this.superHtmlAnimationInterval) {
            clearInterval(this.superHtmlAnimationInterval);
            this.superHtmlAnimationInterval = null;
        }

        // Останавливаем анимацию прогресса SFTP
        if (this.sftpAnimationInterval) {
            clearInterval(this.sftpAnimationInterval);
            this.sftpAnimationInterval = null;
        }

        // Сбрасываем прогресс SuperHTML билда
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlCurrentTime = '0с';

        // Сбрасываем прогресс-бар SuperHTML билда
        const superhtmlSection = this.uiElements.superhtmlSection;
        if (superhtmlSection) {
            superhtmlSection.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Сбрасываем время в прогресс-барах
        const timeElements = [
            this.uiElements.mainBuildTime,
            this.uiElements.superhtmlTime,
            this.uiElements.sftpTime
        ];

        timeElements.forEach(timeElement => {
            if (timeElement) {
                timeElement.textContent = '[0s]';
            }
        });

        // НЕ очищаем список собранных файлов - они должны сохраняться между сборками
    }

    /**
     * Получение данных о времени этапов
     */
    getStageTimings(): StageTimings {
        return this.stageTimings;
    }

    /**
     * Получение данных о прогрессе основного билда
     */
    getMainBuildProgress(): ProgressData {
        return this.mainBuildProgress;
    }

    /**
     * Получение данных о прогрессе SuperHTML билда
     */
    getSuperHtmlProgress(): ProgressData {
        return this.superHtmlProgress;
    }

    /**
     * Получение данных о прогрессе SFTP
     */
    getSftpProgress(): SftpProgressData {
        return this.sftpProgress;
    }

    /**
     * Получение данных о clean-info SFTP
     */
    getSftpCleanInfo(): SftpCleanInfo {
        return this.sftpCleanInfo;
    }

    /**
     * Очистка данных о clean-info SFTP
     */
    clearSftpCleanInfo(): void {
        this.sftpCleanInfo = { path: '', totalItems: 0, items: [] };
    }

    /**
     * Принудительное завершение прогресса основного билда
     */
    forceCompleteMainBuild(): void {
        if (this.mainBuildProgress.percentage < 100) {
            this.mainBuildProgress.percentage = 100;
            this.mainBuildProgress.currentTask = 'Завершено';
            this.updateMainBuildProgress();
        }

        // Скрываем прогресс-бар после завершения
        setTimeout(() => {
            this.resetSectionState('mainBuild');
        }, 2000); // Даем время показать завершенное состояние
    }

    /**
     * Принудительное завершение прогресса SuperHTML билда
     */
    forceCompleteSuperHtmlBuild(): void {
        if (this.superHtmlProgress.percentage < 100) {
            this.superHtmlProgress.percentage = 100;
            this.superHtmlProgress.currentTask = 'Завершено';
            this.updateSuperHtmlProgress();
        }

        // Скрываем прогресс-бар после завершения
        setTimeout(() => {
            this.resetSectionState('superHtml');
        }, 2000); // Даем время показать завершенное состояние
    }

    /**
     * Принудительное завершение прогресса SFTP
     */
    forceCompleteSftpProgress(): void {
        if (this.sftpProgress.percentage < 100) {
            this.sftpProgress.percentage = 100;
            this.sftpProgress.currentTask = 'Завершено';
            this.updateSftpProgress();
        }

        // Скрываем прогресс-бар после завершения
        setTimeout(() => {
            this.resetSectionState('sftp');
        }, 2000); // Даем время показать завершенное состояние
    }

    /**
     * Запуск мониторинга застрявшего прогресса
     */
    startStuckProgressMonitoring(): void {
        this.lastProgressUpdate = Date.now();

        if (this.stuckProgressTimeout) {
            clearTimeout(this.stuckProgressTimeout);
        }

        this.stuckProgressTimeout = setInterval(() => {
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastProgressUpdate;

            // Если прогресс не обновлялся более 30 секунд и он больше 0, принудительно завершаем
            if (timeSinceLastUpdate > 30000 && this.mainBuildProgress.percentage > 0) {
                this.forceCompleteMainBuild();
                this.stopStuckProgressMonitoring();
            }
        }, 5000); // Проверяем каждые 5 секунд
    }

    /**
     * Остановка мониторинга застрявшего прогресса
     */
    stopStuckProgressMonitoring(): void {
        if (this.stuckProgressTimeout) {
            clearTimeout(this.stuckProgressTimeout);
            this.stuckProgressTimeout = null;
        }
    }

    /**
     * Обновление времени последнего обновления прогресса
     */
    updateLastProgressTime(): void {
        this.lastProgressUpdate = Date.now();
    }

    /**
     * Сброс всех состояний секций к начальному состоянию
     */
    resetAllSections(): void {
        // Сбрасываем данные прогресса
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };

        // Сбрасываем время
        this.mainBuildCurrentTime = '0с';
        this.superHtmlCurrentTime = '0с';
        this.sftpCurrentTime = '0с';

        // Сбрасываем состояния секций
        this.resetSectionState('mainBuild');
        this.resetSectionState('superHtml');
        this.resetSectionState('sftp');
    }

    /**
     * Показ прогресс-бара для конкретной секции
     */
    showSectionProgress(section: 'mainBuild' | 'superHtml' | 'sftp'): void {
        let sectionElement: HTMLElement | undefined;
        let progressElement: HTMLElement | undefined;
        let statusElement: HTMLElement | undefined;

        switch (section) {
            case 'mainBuild':
                sectionElement = this.uiElements.mainBuildSection;
                progressElement = this.uiElements.mainBuildProgress;
                statusElement = this.uiElements.mainBuildStatus;
                break;
            case 'superHtml':
                sectionElement = this.uiElements.superhtmlSection;
                progressElement = this.uiElements.superhtmlProgress;
                statusElement = this.uiElements.superhtmlStatus;
                break;
            case 'sftp':
                sectionElement = this.uiElements.sftpSection;
                progressElement = this.uiElements.sftpProgress;
                statusElement = this.uiElements.sftpStatus;
                break;
        }

        // Устанавливаем состояние "ожидание" для секции
        if (sectionElement) {
            sectionElement.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
            sectionElement.classList.add('progress-pending');
        }

        // Показываем индикатор прогресса
        if (progressElement) {
            progressElement.classList.remove('hidden');
            progressElement.classList.remove('pending', 'active', 'completed', 'skipped');
            progressElement.classList.add('pending');
        }

        // Устанавливаем статус ожидания
        if (statusElement) {
            statusElement.textContent = '⏳';
        }
    }

    /**
     * Сброс состояния конкретной секции
     */
    resetSectionState(section: 'mainBuild' | 'superHtml' | 'sftp'): void {
        let sectionElement: HTMLElement | undefined;
        let progressElement: HTMLElement | undefined;
        let statusElement: HTMLElement | undefined;

        switch (section) {
            case 'mainBuild':
                sectionElement = this.uiElements.mainBuildSection;
                progressElement = this.uiElements.mainBuildProgress;
                statusElement = this.uiElements.mainBuildStatus;
                break;
            case 'superHtml':
                sectionElement = this.uiElements.superhtmlSection;
                progressElement = this.uiElements.superhtmlProgress;
                statusElement = this.uiElements.superhtmlStatus;
                break;
            case 'sftp':
                sectionElement = this.uiElements.sftpSection;
                progressElement = this.uiElements.sftpProgress;
                statusElement = this.uiElements.sftpStatus;
                break;
        }

        // Сбрасываем классы состояний секции
        if (sectionElement) {
            sectionElement.classList.remove('progress-pending', 'progress-active', 'progress-completed', 'progress-skipped');
        }

        // Скрываем индикатор прогресса
        if (progressElement) {
            progressElement.classList.add('hidden');
            progressElement.classList.remove('pending', 'active', 'completed', 'skipped');
        }

        // Сбрасываем статус
        if (statusElement) {
            statusElement.textContent = '⏳';
        }
    }

    /**
     * Получение списка собранных файлов
     */
    getBuiltFiles(): BuiltFileInfo[] {
        return [...this.builtFiles];
    }

    /**
     * Очистка списка собранных файлов
     */
    clearBuiltFiles(): void {
        this.builtFiles = [];
    }

    /**
     * Получение максимального размера файла
     */
    getMaxFileSize(): { sizeKB: number; fileName: string } | null {
        if (this.builtFiles.length === 0) {
            return null;
        }

        // Фильтруем файлы с известным размером (больше 0)
        const filesWithSize = this.builtFiles.filter(file => file.sizeKB > 0);

        if (filesWithSize.length === 0) {
            // Если нет файлов с известным размером, возвращаем первый файл
            const firstFile = this.builtFiles[0];
            return {
                sizeKB: firstFile.sizeKB,
                fileName: firstFile.fileName || `${firstFile.versionName}_${firstFile.langCode}.html`
            };
        }

        const maxFile = filesWithSize.reduce((max, file) =>
            file.sizeKB > max.sizeKB ? file : max
        );

        return {
            sizeKB: maxFile.sizeKB,
            fileName: maxFile.fileName || `${maxFile.versionName}_${maxFile.langCode}.html`
        };
    }
}
