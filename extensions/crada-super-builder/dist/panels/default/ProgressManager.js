"use strict";
/**
 * ProgressManager - управление прогрессом сборки
 * Отвечает за отслеживание и отображение прогресса всех этапов сборки
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressManager = void 0;
class ProgressManager {
    constructor(uiElements) {
        this.mainBuildProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.superHtmlProgress = { percentage: 0, currentTask: '', eta: 0 };
        this.sftpProgress = { current: 0, total: 0, percentage: 0, eta: 0, currentTask: '' };
        this.builtFiles = [];
        this.sftpCleanInfo = { path: '', totalItems: 0, items: [] };
        // Время этапов
        this.stageTimings = {};
        // Текущее время для отображения
        this.mainBuildCurrentTime = '0с';
        this.superHtmlCurrentTime = '0с';
        this.sftpCurrentTime = '0с';
        // Анимация прогресса SuperHTML
        this.superHtmlTargetPercentage = 0;
        this.superHtmlAnimationInterval = null;
        // Анимация прогресса SFTP
        this.sftpTargetPercentage = 0;
        this.sftpAnimationInterval = null;
        // Интервалы для обновления времени в реальном времени
        this.progressTimeIntervals = {};
        // Мониторинг застрявшего прогресса
        this.stuckProgressTimeout = null;
        this.lastProgressUpdate = 0;
        // UI элементы
        this.uiElements = {};
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
    parseMainBuildProgress(msg) {
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
    parseSuperHtmlProgress(msg) {
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
        }
        else if (msg.includes('⏳ Ждем паковки...')) {
            this.superHtmlProgress.currentTask = 'Ожидание паковки';
            this.animateSuperHtmlProgress(20, 500);
            return true;
        }
        else if (msg.includes('✅') && msg.includes('| 🕓') && msg.includes('| 📦')) {
            this.superHtmlProgress.currentTask = 'Завершено';
            this.animateSuperHtmlProgress(100, 1000);
            return true;
        }
        return false;
    }
    /**
     * Парсинг структурированных SFTP логов
     */
    parseSftpLogs(msg) {
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
        }
        else if (msg.includes('Подключение к серверу')) {
            this.sftpProgress.currentTask = 'Подключение';
            this.animateSftpProgress(20, 500);
            hasUpdates = true;
        }
        else if (msg.includes('Загрузка файлов')) {
            this.sftpProgress.currentTask = 'Загрузка файлов';
            this.animateSftpProgress(50, 500);
            hasUpdates = true;
        }
        else if (msg.includes('SFTP заливка завершена успешно')) {
            this.sftpProgress.currentTask = 'Завершено';
            this.animateSftpProgress(100, 1000);
            hasUpdates = true;
        }
        return hasUpdates;
    }
    /**
     * Обновление прогресса основного билда в интерфейсе
     */
    updateMainBuildProgress() {
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
            }
            else if (this.mainBuildProgress.percentage < 100) {
                mainBuildStatus.textContent = '⏳';
            }
            else {
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
            }
            else if (this.mainBuildProgress.percentage < 100) {
                mainBuildSection.classList.add('progress-active');
            }
            else {
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
                }
                else {
                    mainBuildProgress.classList.add('completed');
                }
            }
            else {
                mainBuildProgress.classList.add('hidden');
            }
        }
    }
    /**
     * Обновление прогресса SuperHTML в интерфейсе
     */
    updateSuperHtmlProgress() {
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
            }
            else if (this.superHtmlProgress.percentage < 100) {
                superhtmlStatus.textContent = '⏳';
            }
            else {
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
            }
            else if (this.superHtmlProgress.percentage < 100) {
                superhtmlSection.classList.add('progress-active');
            }
            else {
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
                }
                else {
                    superhtmlProgress.classList.add('completed');
                }
            }
            else {
                superhtmlProgress.classList.add('hidden');
            }
        }
    }
    /**
     * Обновление прогресса SFTP в интерфейсе
     */
    updateSftpProgress() {
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
            }
            else {
                sftpTime.textContent = `[${this.sftpCurrentTime}]`;
            }
        }
        // Обновляем статус
        if (sftpStatus) {
            if (this.sftpProgress.percentage === 0) {
                sftpStatus.textContent = '⏳';
            }
            else if (this.sftpProgress.percentage < 100) {
                sftpStatus.textContent = '⏳';
            }
            else {
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
            }
            else if (this.sftpProgress.percentage < 100) {
                sftpSection.classList.add('progress-active');
            }
            else {
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
                }
                else if (this.sftpProgress.percentage < 100) {
                    sftpProgress.classList.add('active');
                }
                else {
                    sftpProgress.classList.add('completed');
                }
            }
            else {
                sftpProgress.classList.add('hidden');
            }
        }
    }
    /**
     * Обновление информации о папках для удаления
     */
    updateSftpCleanInfo() {
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
    animateSuperHtmlProgress(targetPercentage, duration = 1000) {
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
    animateSftpProgress(targetPercentage, duration = 1000) {
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
    startStageTiming(stage) {
        this.stageTimings[stage] = { start: new Date() };
        // Запускаем обновление времени в реальном времени
        this.startProgressTimeUpdate(stage);
    }
    /**
     * Завершение отслеживания времени этапа
     */
    endStageTiming(stage) {
        if (this.stageTimings[stage]) {
            this.stageTimings[stage].end = new Date();
            this.stageTimings[stage].duration = Math.round((this.stageTimings[stage].end.getTime() - this.stageTimings[stage].start.getTime()) / 1000);
        }
        // Останавливаем обновление времени в реальном времени
        this.stopProgressTimeUpdate(stage);
    }
    /**
     * Форматирование времени этапа
     */
    formatStageTime(duration) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes}м ${seconds}с`;
    }
    /**
     * Запуск обновления времени в реальном времени
     */
    startProgressTimeUpdate(stage) {
        let timeElement = null;
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
        if (!timeElement)
            return;
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
                    }
                    else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                }
                else if (stage === 'mainBuild') {
                    // Сохраняем время для основного билда
                    this.mainBuildCurrentTime = timeString;
                    // Обновляем прогресс если есть данные
                    if (this.mainBuildProgress.percentage > 0) {
                        this.updateMainBuildProgress();
                    }
                    else {
                        timeElement.textContent = `[${timeString}]`;
                    }
                }
                else if (stage === 'superHtmlBuild') {
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
    stopProgressTimeUpdate(stage) {
        if (this.progressTimeIntervals[stage]) {
            clearInterval(this.progressTimeIntervals[stage]);
            this.progressTimeIntervals[stage] = undefined;
        }
    }
    /**
     * Очистка всех интервалов времени
     */
    clearAllProgressTimeIntervals() {
        Object.keys(this.progressTimeIntervals).forEach(stage => {
            if (this.progressTimeIntervals[stage]) {
                clearInterval(this.progressTimeIntervals[stage]);
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
    resetAllProgress() {
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
    resetProgressOnly() {
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
    getStageTimings() {
        return this.stageTimings;
    }
    /**
     * Получение данных о прогрессе основного билда
     */
    getMainBuildProgress() {
        return this.mainBuildProgress;
    }
    /**
     * Получение данных о прогрессе SuperHTML билда
     */
    getSuperHtmlProgress() {
        return this.superHtmlProgress;
    }
    /**
     * Получение данных о прогрессе SFTP
     */
    getSftpProgress() {
        return this.sftpProgress;
    }
    /**
     * Получение данных о clean-info SFTP
     */
    getSftpCleanInfo() {
        return this.sftpCleanInfo;
    }
    /**
     * Очистка данных о clean-info SFTP
     */
    clearSftpCleanInfo() {
        this.sftpCleanInfo = { path: '', totalItems: 0, items: [] };
    }
    /**
     * Принудительное завершение прогресса основного билда
     */
    forceCompleteMainBuild() {
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
    forceCompleteSuperHtmlBuild() {
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
    forceCompleteSftpProgress() {
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
    startStuckProgressMonitoring() {
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
    stopStuckProgressMonitoring() {
        if (this.stuckProgressTimeout) {
            clearTimeout(this.stuckProgressTimeout);
            this.stuckProgressTimeout = null;
        }
    }
    /**
     * Обновление времени последнего обновления прогресса
     */
    updateLastProgressTime() {
        this.lastProgressUpdate = Date.now();
    }
    /**
     * Сброс всех состояний секций к начальному состоянию
     */
    resetAllSections() {
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
    showSectionProgress(section) {
        let sectionElement;
        let progressElement;
        let statusElement;
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
    resetSectionState(section) {
        let sectionElement;
        let progressElement;
        let statusElement;
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
    getBuiltFiles() {
        return [...this.builtFiles];
    }
    /**
     * Очистка списка собранных файлов
     */
    clearBuiltFiles() {
        this.builtFiles = [];
    }
    /**
     * Получение максимального размера файла
     */
    getMaxFileSize() {
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
        const maxFile = filesWithSize.reduce((max, file) => file.sizeKB > max.sizeKB ? file : max);
        return {
            sizeKB: maxFile.sizeKB,
            fileName: maxFile.fileName || `${maxFile.versionName}_${maxFile.langCode}.html`
        };
    }
}
exports.ProgressManager = ProgressManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvZ3Jlc3NNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3BhbmVscy9kZWZhdWx0L1Byb2dyZXNzTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFxRUgsTUFBYSxlQUFlO0lBb0R4QixZQUFZLFVBQXFDO1FBbkR6QyxzQkFBaUIsR0FBaUIsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQzdFLHNCQUFpQixHQUFpQixFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDN0UsaUJBQVksR0FBcUIsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUNsRyxlQUFVLEdBQW9CLEVBQUUsQ0FBQztRQUNqQyxrQkFBYSxHQUFrQixFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFFOUUsZUFBZTtRQUNQLGlCQUFZLEdBQWlCLEVBQUUsQ0FBQztRQUV4QyxnQ0FBZ0M7UUFDeEIseUJBQW9CLEdBQVcsSUFBSSxDQUFDO1FBQ3BDLHlCQUFvQixHQUFXLElBQUksQ0FBQztRQUNwQyxvQkFBZSxHQUFXLElBQUksQ0FBQztRQUV2QywrQkFBK0I7UUFDdkIsOEJBQXlCLEdBQVcsQ0FBQyxDQUFDO1FBQ3RDLCtCQUEwQixHQUEwQixJQUFJLENBQUM7UUFFakUsMEJBQTBCO1FBQ2xCLHlCQUFvQixHQUFXLENBQUMsQ0FBQztRQUNqQywwQkFBcUIsR0FBMEIsSUFBSSxDQUFDO1FBRTVELHNEQUFz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QztRQUVGLE9BQU87WUFDSCxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07WUFDdEIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRLElBQUksR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLE9BQU8sQ0FBQyxRQUFRLE9BQU87U0FDbEYsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQXJ4Q0QsMENBcXhDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBQcm9ncmVzc01hbmFnZXIgLSDRg9C/0YDQsNCy0LvQtdC90LjQtSDQv9GA0L7Qs9GA0LXRgdGB0L7QvCDRgdCx0L7RgNC60LhcclxuICog0J7RgtCy0LXRh9Cw0LXRgiDQt9CwINC+0YLRgdC70LXQttC40LLQsNC90LjQtSDQuCDQvtGC0L7QsdGA0LDQttC10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCDQstGB0LXRhSDRjdGC0LDQv9C+0LIg0YHQsdC+0YDQutC4XHJcbiAqL1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQcm9ncmVzc0RhdGEge1xyXG4gICAgcGVyY2VudGFnZTogbnVtYmVyO1xyXG4gICAgY3VycmVudFRhc2s6IHN0cmluZztcclxuICAgIGV0YTogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFNmdHBQcm9ncmVzc0RhdGEge1xyXG4gICAgY3VycmVudDogbnVtYmVyO1xyXG4gICAgdG90YWw6IG51bWJlcjtcclxuICAgIHBlcmNlbnRhZ2U6IG51bWJlcjtcclxuICAgIGV0YTogbnVtYmVyO1xyXG4gICAgY3VycmVudFRhc2s6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTZnRwQ2xlYW5JbmZvIHtcclxuICAgIHBhdGg6IHN0cmluZztcclxuICAgIHRvdGFsSXRlbXM6IG51bWJlcjtcclxuICAgIGl0ZW1zOiBBcnJheTx7XHJcbiAgICAgICAgdHlwZTogc3RyaW5nO1xyXG4gICAgICAgIG5hbWU6IHN0cmluZztcclxuICAgICAgICBwYXRoOiBzdHJpbmc7XHJcbiAgICAgICAgc2l6ZT86IHN0cmluZztcclxuICAgICAgICBwZXJtaXNzaW9ucz86IHN0cmluZztcclxuICAgICAgICBtb2RpZnlUaW1lPzogc3RyaW5nO1xyXG4gICAgfT47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUHJvZ3Jlc3NNYW5hZ2VyVUlFbGVtZW50cyB7XHJcbiAgICAvLyBDaGVja2JveCDRgdC10LrRhtC40Lgg0LTQu9GPINC+0YLQvtCx0YDQsNC20LXQvdC40Y8g0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICBtYWluQnVpbGRTZWN0aW9uPzogSFRNTEVsZW1lbnQ7XHJcbiAgICBzdXBlcmh0bWxTZWN0aW9uPzogSFRNTEVsZW1lbnQ7XHJcbiAgICBzZnRwU2VjdGlvbj86IEhUTUxFbGVtZW50O1xyXG4gICAgLy8g0JjQvdC00LjQutCw0YLQvtGA0Ysg0L/RgNC+0LPRgNC10YHRgdCwINCy0L3Rg9GC0YDQuCDRgdC10LrRhtC40LlcclxuICAgIG1haW5CdWlsZFByb2dyZXNzPzogSFRNTEVsZW1lbnQ7XHJcbiAgICBzdXBlcmh0bWxQcm9ncmVzcz86IEhUTUxFbGVtZW50O1xyXG4gICAgc2Z0cFByb2dyZXNzPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAvLyDQrdC70LXQvNC10L3RgtGLINCy0YDQtdC80LXQvdC4XHJcbiAgICBtYWluQnVpbGRUaW1lPzogSFRNTEVsZW1lbnQ7XHJcbiAgICBzdXBlcmh0bWxUaW1lPzogSFRNTEVsZW1lbnQ7XHJcbiAgICBzZnRwVGltZT86IEhUTUxFbGVtZW50O1xyXG4gICAgLy8g0KHRgtCw0YLRg9GB0Ysg0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICBtYWluQnVpbGRTdGF0dXM/OiBIVE1MRWxlbWVudDtcclxuICAgIHN1cGVyaHRtbFN0YXR1cz86IEhUTUxFbGVtZW50O1xyXG4gICAgc2Z0cFN0YXR1cz86IEhUTUxFbGVtZW50O1xyXG4gICAgc2Z0cENsZWFuSW5mbz86IEhUTUxFbGVtZW50O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFN0YWdlVGltaW5nIHtcclxuICAgIHN0YXJ0OiBEYXRlO1xyXG4gICAgZW5kPzogRGF0ZTtcclxuICAgIGR1cmF0aW9uPzogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFN0YWdlVGltaW5ncyB7XHJcbiAgICBtYWluQnVpbGQ/OiBTdGFnZVRpbWluZztcclxuICAgIHN1cGVySHRtbEJ1aWxkPzogU3RhZ2VUaW1pbmc7XHJcbiAgICBzZnRwTG9hZD86IFN0YWdlVGltaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWx0RmlsZUluZm8ge1xyXG4gICAgdmVyc2lvbk5hbWU6IHN0cmluZztcclxuICAgIGxhbmdDb2RlOiBzdHJpbmc7XHJcbiAgICBidWlsZFRpbWU6IG51bWJlcjtcclxuICAgIHNpemVLQjogbnVtYmVyO1xyXG4gICAgZmlsZU5hbWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQcm9ncmVzc01hbmFnZXIge1xyXG4gICAgcHJpdmF0ZSBtYWluQnVpbGRQcm9ncmVzczogUHJvZ3Jlc3NEYXRhID0geyBwZXJjZW50YWdlOiAwLCBjdXJyZW50VGFzazogJycsIGV0YTogMCB9O1xyXG4gICAgcHJpdmF0ZSBzdXBlckh0bWxQcm9ncmVzczogUHJvZ3Jlc3NEYXRhID0geyBwZXJjZW50YWdlOiAwLCBjdXJyZW50VGFzazogJycsIGV0YTogMCB9O1xyXG4gICAgcHJpdmF0ZSBzZnRwUHJvZ3Jlc3M6IFNmdHBQcm9ncmVzc0RhdGEgPSB7IGN1cnJlbnQ6IDAsIHRvdGFsOiAwLCBwZXJjZW50YWdlOiAwLCBldGE6IDAsIGN1cnJlbnRUYXNrOiAnJyB9O1xyXG4gICAgcHJpdmF0ZSBidWlsdEZpbGVzOiBCdWlsdEZpbGVJbmZvW10gPSBbXTtcclxuICAgIHByaXZhdGUgc2Z0cENsZWFuSW5mbzogU2Z0cENsZWFuSW5mbyA9IHsgcGF0aDogJycsIHRvdGFsSXRlbXM6IDAsIGl0ZW1zOiBbXSB9O1xyXG5cclxuICAgIC8vINCS0YDQtdC80Y8g0Y3RgtCw0L/QvtCyXHJcbiAgICBwcml2YXRlIHN0YWdlVGltaW5nczogU3RhZ2VUaW1pbmdzID0ge307XHJcblxyXG4gICAgLy8g0KLQtdC60YPRidC10LUg0LLRgNC10LzRjyDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRj1xyXG4gICAgcHJpdmF0ZSBtYWluQnVpbGRDdXJyZW50VGltZTogc3RyaW5nID0gJzDRgSc7XHJcbiAgICBwcml2YXRlIHN1cGVySHRtbEN1cnJlbnRUaW1lOiBzdHJpbmcgPSAnMNGBJztcclxuICAgIHByaXZhdGUgc2Z0cEN1cnJlbnRUaW1lOiBzdHJpbmcgPSAnMNGBJztcclxuXHJcbiAgICAvLyDQkNC90LjQvNCw0YbQuNGPINC/0YDQvtCz0YDQtdGB0YHQsCBTdXBlckhUTUxcclxuICAgIHByaXZhdGUgc3VwZXJIdG1sVGFyZ2V0UGVyY2VudGFnZTogbnVtYmVyID0gMDtcclxuICAgIHByaXZhdGUgc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWw6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgLy8g0JDQvdC40LzQsNGG0LjRjyDQv9GA0L7Qs9GA0LXRgdGB0LAgU0ZUUFxyXG4gICAgcHJpdmF0ZSBzZnRwVGFyZ2V0UGVyY2VudGFnZTogbnVtYmVyID0gMDtcclxuICAgIHByaXZhdGUgc2Z0cEFuaW1hdGlvbkludGVydmFsOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgIC8vINCY0L3RgtC10YDQstCw0LvRiyDQtNC70Y8g0L7QsdC90L7QstC70LXQvdC40Y8g0LLRgNC10LzQtdC90Lgg0LIg0YDQtdCw0LvRjNC90L7QvCDQstGA0LXQvNC10L3QuFxyXG4gICAgcHJpdmF0ZSBwcm9ncmVzc1RpbWVJbnRlcnZhbHM6IHtcclxuICAgICAgICBtYWluQnVpbGQ/OiBOb2RlSlMuVGltZW91dDtcclxuICAgICAgICBzdXBlckh0bWxCdWlsZD86IE5vZGVKUy5UaW1lb3V0O1xyXG4gICAgICAgIHNmdHBMb2FkPzogTm9kZUpTLlRpbWVvdXQ7XHJcbiAgICB9ID0ge307XHJcblxyXG4gICAgLy8g0JzQvtC90LjRgtC+0YDQuNC90LMg0LfQsNGB0YLRgNGP0LLRiNC10LPQviDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgIHByaXZhdGUgc3R1Y2tQcm9ncmVzc1RpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcbiAgICBwcml2YXRlIGxhc3RQcm9ncmVzc1VwZGF0ZTogbnVtYmVyID0gMDtcclxuXHJcbiAgICAvLyBVSSDRjdC70LXQvNC10L3RgtGLXHJcbiAgICBwcml2YXRlIHVpRWxlbWVudHM6IFByb2dyZXNzTWFuYWdlclVJRWxlbWVudHMgJiB7XHJcbiAgICAgICAgLy8g0KHQvtCy0LzQtdGB0YLQuNC80L7RgdGC0Ywg0YHQviDRgdGC0LDRgNGL0Lwg0LrQvtC00L7QvCAo0LDQu9C40LDRgdGLKVxyXG4gICAgICAgIHByb2dyZXNzTWFpbj86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHByb2dyZXNzU3VwZXJodG1sPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcHJvZ3Jlc3NTZnRwPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgcHJvZ3Jlc3NNYWluVGltZT86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHByb2dyZXNzU3VwZXJodG1sVGltZT86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHByb2dyZXNzU2Z0cFRpbWU/OiBIVE1MRWxlbWVudDtcclxuICAgICAgICAvLyDQrdC70LXQvNC10L3RgtGLINC/0YDQvtCz0YDQtdGB0YEt0LHQsNGA0L7QslxyXG4gICAgICAgIG1haW5CdWlsZFByb2dyZXNzRmlsbD86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHN1cGVyaHRtbFByb2dyZXNzRmlsbD86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHNmdHBQcm9ncmVzc0ZpbGw/OiBIVE1MRWxlbWVudDtcclxuICAgICAgICBtYWluQnVpbGRQZXJjZW50YWdlPzogSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgc3VwZXJodG1sUGVyY2VudGFnZT86IEhUTUxFbGVtZW50O1xyXG4gICAgICAgIHNmdHBQZXJjZW50YWdlPzogSFRNTEVsZW1lbnQ7XHJcbiAgICB9ID0ge30gYXMgYW55O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHVpRWxlbWVudHM6IFByb2dyZXNzTWFuYWdlclVJRWxlbWVudHMpIHtcclxuICAgICAgICB0aGlzLnVpRWxlbWVudHMgPSB1aUVsZW1lbnRzO1xyXG5cclxuICAgICAgICAvLyDQo9GB0YLQsNC90LDQstC70LjQstCw0LXQvCDQsNC70LjQsNGB0Ysg0LTQu9GPINGB0L7QstC80LXRgdGC0LjQvNC+0YHRgtC4INGB0L4g0YHRgtCw0YDRi9C8INC60L7QtNCwXHJcbiAgICAgICAgdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpbiA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRTZWN0aW9uO1xyXG4gICAgICAgIHRoaXMudWlFbGVtZW50cy5wcm9ncmVzc1N1cGVyaHRtbCA9IHRoaXMudWlFbGVtZW50cy5zdXBlcmh0bWxTZWN0aW9uO1xyXG4gICAgICAgIC8vIHNmdHBQcm9ncmVzcyDQtNC+0LvQttC10L0g0YPQutCw0LfRi9Cy0LDRgtGMINC90LAg0YHQsNC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGALCDQsCDQvdC1INC90LAg0YHQtdC60YbQuNGOXHJcbiAgICAgICAgdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzTWFpblRpbWUgPSB0aGlzLnVpRWxlbWVudHMubWFpbkJ1aWxkVGltZTtcclxuICAgICAgICB0aGlzLnVpRWxlbWVudHMucHJvZ3Jlc3NTdXBlcmh0bWxUaW1lID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFRpbWU7XHJcbiAgICAgICAgdGhpcy51aUVsZW1lbnRzLnByb2dyZXNzU2Z0cFRpbWUgPSB0aGlzLnVpRWxlbWVudHMuc2Z0cFRpbWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9Cw0YDRgdC40L3QsyDQv9GA0L7Qs9GA0LXRgdGB0LAg0L7RgdC90L7QstC90L7Qs9C+INCx0LjQu9C00LAg0LjQtyDQu9C+0LPQvtCyXHJcbiAgICAgKi9cclxuICAgIHBhcnNlTWFpbkJ1aWxkUHJvZ3Jlc3MobXNnOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0L/RgNC+0LPRgNC10YHRgSDQuNC3INGB0YLRgNC+0Log0LLQuNC00LAgXCIwOS4wOS4yMDI1IDIxOjIwOjQyIC0gZGVidWc6IEdlbmVyYXRlIHN5c3RlbUpzLi4uLCBwcm9ncmVzczogMTclXCJcclxuICAgICAgICBjb25zdCBwcm9ncmVzc01hdGNoID0gbXNnLm1hdGNoKC9wcm9ncmVzczpcXHMqKFxcZCspJS8pO1xyXG4gICAgICAgIGlmIChwcm9ncmVzc01hdGNoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld1BlcmNlbnRhZ2UgPSBwYXJzZUludChwcm9ncmVzc01hdGNoWzFdKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7Qs9GA0LXRgdGBINGC0L7Qu9GM0LrQviDQtdGB0LvQuCDQvtC9INGD0LLQtdC70LjRh9C40LvRgdGPICjQuNC30LHQtdCz0LDQtdC8INC+0YLQutCw0YLQsCDQv9GA0L7Qs9GA0LXRgdGB0LApXHJcbiAgICAgICAgICAgIGlmIChuZXdQZXJjZW50YWdlID49IHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID0gbmV3UGVyY2VudGFnZTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQmNC30LLQu9C10LrQsNC10Lwg0L3QsNC30LLQsNC90LjQtSDRgtC10LrRg9GJ0LXQuSDQt9Cw0LTQsNGH0Lgg0LjQtyDRgNCw0LfQvdGL0YUg0YTQvtGA0LzQsNGC0L7QslxyXG4gICAgICAgICAgICAgICAgbGV0IHRhc2tNYXRjaCA9IG1zZy5tYXRjaCgvZGVidWc6XFxzKiguKz8pLFxccypwcm9ncmVzczovKTtcclxuICAgICAgICAgICAgICAgIGlmICghdGFza01hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC+0LHRg9C10Lwg0LTRgNGD0LPQvtC5INGE0L7RgNC80LDRgjogXCJsb2c6IHJ1biBidWlsZCB0YXNrIC4uLiBzdWNjZXNzIGluIFggbXPiiJosIHByb2dyZXNzOiBZJVwiXHJcbiAgICAgICAgICAgICAgICAgICAgdGFza01hdGNoID0gbXNnLm1hdGNoKC9sb2c6XFxzKnJ1biBidWlsZCB0YXNrXFxzKyguKz8pXFxzK3N1Y2Nlc3MvKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghdGFza01hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC+0LHRg9C10Lwg0YTQvtGA0LzQsNGCOiBcImRlYnVnOiBUYXNrTmFtZSBzdGFydC4uLiwgcHJvZ3Jlc3M6IFklXCJcclxuICAgICAgICAgICAgICAgICAgICB0YXNrTWF0Y2ggPSBtc2cubWF0Y2goL2RlYnVnOlxccyooW146XSs/KVxccytzdGFydFteLF0qLFxccypwcm9ncmVzczovKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAodGFza01hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5jdXJyZW50VGFzayA9IHRhc2tNYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVMYXN0UHJvZ3Jlc3NUaW1lKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KDQsNGB0YjQuNGA0LXQvdC90YvQtSDQv9Cw0YLRgtC10YDQvdGLINC00LvRjyDQvtC/0YDQtdC00LXQu9C10L3QuNGPINC30LDQstC10YDRiNC10L3QuNGPINCx0LjQu9C00LBcclxuICAgICAgICBjb25zdCBjb21wbGV0aW9uUGF0dGVybnMgPSBbXHJcbiAgICAgICAgICAgICdidWlsZCBzdWNjZXNzJyxcclxuICAgICAgICAgICAgJ2J1aWxkIFRhc2suKkZpbmlzaGVkJyxcclxuICAgICAgICAgICAgJ0J1aWxkIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHknLFxyXG4gICAgICAgICAgICAnQnVpbGQgZmluaXNoZWQnLFxyXG4gICAgICAgICAgICAnQ29tcGlsYXRpb24gY29tcGxldGVkJyxcclxuICAgICAgICAgICAgJ0J1aWxkIHByb2Nlc3MgY29tcGxldGVkJyxcclxuICAgICAgICAgICAgJ3dlYi1tb2JpbGUuKmJ1aWxkLipzdWNjZXNzJyxcclxuICAgICAgICAgICAgJ2J1aWxkLipzdWNjZXNzLippbi4qbXMnLFxyXG4gICAgICAgICAgICAnQnVpbGQuKmZpbmlzaGVkLipzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGNvbXBsZXRpb25QYXR0ZXJucykge1xyXG4gICAgICAgICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAocGF0dGVybiwgJ2knKTtcclxuICAgICAgICAgICAgaWYgKHJlZ2V4LnRlc3QobXNnKSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA8IDEwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA9IDEwMDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW5CdWlsZFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTGFzdFByb2dyZXNzVGltZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0YDQsNCx0LDRgtGL0LLQsNC10Lwg0YHQu9GD0YfQsNC5INC+0YjQuNCx0LrQuCDQsdC40LvQtNCwXHJcbiAgICAgICAgY29uc3QgZXJyb3JQYXR0ZXJucyA9IFtcclxuICAgICAgICAgICAgJ2J1aWxkIGVycm9yJyxcclxuICAgICAgICAgICAgJ2J1aWxkIGZhaWxlZCcsXHJcbiAgICAgICAgICAgICdlcnJvcjouKmJ1aWxkJyxcclxuICAgICAgICAgICAgJ0J1aWxkIGZhaWxlZCcsXHJcbiAgICAgICAgICAgICdDb21waWxhdGlvbiBmYWlsZWQnLFxyXG4gICAgICAgICAgICAnQnVpbGQgcHJvY2VzcyBmYWlsZWQnXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGVycm9yUGF0dGVybnMpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4sICdpJyk7XHJcbiAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KG1zZykpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSAn0J7RiNC40LHQutCwJztcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTWFpbkJ1aWxkUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3QsNGPINC/0YDQvtCy0LXRgNC60LA6INC10YHQu9C4INC/0YDQvtCz0YDQtdGB0YEg0LTQvtGB0YLQuNCzIDk5JSDQuCDQv9GA0L7RiNC70L4g0LLRgNC10LzRjywg0L/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LfQsNCy0LXRgNGI0LDQtdC8XHJcbiAgICAgICAgaWYgKHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA+PSA5OSkge1xyXG4gICAgICAgICAgICAvLyDQldGB0LvQuCDQv9GA0L7Qs9GA0LXRgdGBINC30LDRgdGC0YDRj9C7INC90LAgOTklLCDQttC00LXQvCDQvdC10LzQvdC+0LPQviDQuCDQv9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QviDQt9Cw0LLQtdGA0YjQsNC10LxcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID49IDk5ICYmIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA8IDEwMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA9IDEwMDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1haW5CdWlsZFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCAyMDAwKTsgLy8g0JbQtNC10LwgMiDRgdC10LrRg9C90LTRi1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QsNGA0YHQuNC90LMg0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTCDQsdC40LvQtNCwINC40Lcg0LvQvtCz0L7QslxyXG4gICAgICovXHJcbiAgICBwYXJzZVN1cGVySHRtbFByb2dyZXNzKG1zZzogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8LCDQtdGB0YLRjCDQu9C4INCyINGB0L7QvtCx0YnQtdC90LjQuCBbU1VQRVJIVE1MX1NVQ0NFU1NdXHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDRgdGC0YDRg9C60YLRg9GA0LjRgNC+0LLQsNC90L3Ri9C1INC70L7Qs9C4INGBINC60LvRjtGH0LDQvNC4XHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NNYXRjaCA9IG1zZy5tYXRjaCgvXFxbU1VQRVJIVE1MX1BST0dSRVNTXFxdIChcXGQrKSUgKC4rKS8pO1xyXG4gICAgICAgIGlmIChwcm9ncmVzc01hdGNoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBlcmNlbnRhZ2UgPSBwYXJzZUludChwcm9ncmVzc01hdGNoWzFdKTtcclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IHByb2dyZXNzTWF0Y2hbMl07XHJcbiAgICAgICAgICAgIC8vINCY0YHQv9C+0LvRjNC30YPQtdC8INC/0LvQsNCy0L3Rg9GOINCw0L3QuNC80LDRhtC40Y4g0LTQu9GPINC/0LXRgNC10YXQvtC00LAg0Log0L3QvtCy0L7QvNGDINC/0YDQvtGG0LXQvdGC0YNcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU3VwZXJIdG1sUHJvZ3Jlc3ModGFyZ2V0UGVyY2VudGFnZSwgODAwKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0LfQsNCy0LXRgNGI0LXQvdC40LUg0Y3RgtCw0L/QsFxyXG4gICAgICAgIGNvbnN0IHN0YWdlQ29tcGxldGVNYXRjaCA9IG1zZy5tYXRjaCgvXFxbU1VQRVJIVE1MX1NUQUdFXFxdICguKykgY29tcGxldGVkLyk7XHJcbiAgICAgICAgaWYgKHN0YWdlQ29tcGxldGVNYXRjaCkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gc3RhZ2VDb21wbGV0ZU1hdGNoWzFdICsgJyAtINC30LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3VwZXJIdG1sUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0L7RiNC40LHQutC4XHJcbiAgICAgICAgY29uc3QgZXJyb3JNYXRjaCA9IG1zZy5tYXRjaCgvXFxbU1VQRVJIVE1MX0VSUk9SXFxdICguKykvKTtcclxuICAgICAgICBpZiAoZXJyb3JNYXRjaCkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9Ce0YjQuNCx0LrQsDogJyArIGVycm9yTWF0Y2hbMV07XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3VwZXJIdG1sUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0YPRgdC/0LXRiNC90L7QtSDQt9Cw0LLQtdGA0YjQtdC90LjQtSDRgSDRg9C70YPRh9GI0LXQvdC90YvQvNC4INGA0LXQs9GD0LvRj9GA0L3Ri9C80Lgg0LLRi9GA0LDQttC10L3QuNGP0LzQuFxyXG4gICAgICAgIC8vINCe0YHQvdC+0LLQvdC+0Lkg0L/QsNGC0YLQtdGA0L06IFtTVVBFUkhUTUxfU1VDQ0VTU10gdmVyc2lvbk5hbWUgKGxhbmcpINC30LDQstC10YDRiNC10L0g0LfQsCBYcywg0YDQsNC30LzQtdGAOiBZS0JcclxuICAgICAgICBjb25zdCBzdWNjZXNzTWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NVUEVSSFRNTF9TVUNDRVNTXFxdXFxzKiguKz8pXFxzKlxcKChcXHcrKVxcKVxccyrQt9Cw0LLQtdGA0YjQtdC9XFxzKtC30LBcXHMqKFtcXGQuXSspcyxcXHMq0YDQsNC30LzQtdGAOlxccyooW1xcZC5dKylLQi8pO1xyXG4gICAgICAgIGlmIChzdWNjZXNzTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbk5hbWUgPSBzdWNjZXNzTWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICBjb25zdCBsYW5nQ29kZSA9IHN1Y2Nlc3NNYXRjaFsyXTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRUaW1lID0gcGFyc2VGbG9hdChzdWNjZXNzTWF0Y2hbM10pO1xyXG4gICAgICAgICAgICBjb25zdCBzaXplS0IgPSBwYXJzZUZsb2F0KHN1Y2Nlc3NNYXRjaFs0XSk7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0KHQvtGF0YDQsNC90Y/QtdC8INC40L3RhNC+0YDQvNCw0YbQuNGOINC+INGB0L7QsdGA0LDQvdC90L7QvCDRhNCw0LnQu9C1XHJcbiAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgbGFuZ0NvZGUsXHJcbiAgICAgICAgICAgICAgICBidWlsZFRpbWUsXHJcbiAgICAgICAgICAgICAgICBzaXplS0IsXHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogYCR7dmVyc2lvbk5hbWV9XyR7bGFuZ0NvZGV9Lmh0bWxgXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IGAke3ZlcnNpb25OYW1lfSAoJHtsYW5nQ29kZX0pINC30LDQstC10YDRiNC10L0g0LfQsCAke2J1aWxkVGltZX1zLCDRgNCw0LfQvNC10YA6ICR7c2l6ZUtCfUtCYDtcclxuICAgICAgICAgICAgLy8g0J/Qu9Cw0LLQvdC+INC00L7QstC+0LTQuNC8INC00L4gMTAwJVxyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTdXBlckh0bWxQcm9ncmVzcygxMDAsIDEwMDApO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDRgdC+0L7QsdGJ0LXQvdC40Y8g0L4g0LfQsNCy0LXRgNGI0LXQvdC40Lgg0YTQsNC50LvQvtCyINC40Lcg0LvQvtCz0L7QslxyXG4gICAgICAgIC8vINCY0YnQtdC8INC/0LDRgtGC0LXRgNC9IFwi4pyTIHZlcnNpb25OYW1lIChsYW5nKSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgWHMsINGA0LDQt9C80LXRgDogWWtiS0JcIlxyXG4gICAgICAgIGNvbnN0IGxvZ0NvbXBsZXRlTWF0Y2ggPSBtc2cubWF0Y2goL+Kck1xccyooXFx3KylcXHMqXFwoKFxcdyspXFwpXFxzKtC30LDQstC10YDRiNC10L1cXHMq0LfQsFxccyooW1xcZC5dKylzLFxccyrRgNCw0LfQvNC10YA6XFxzKihbXFxkLl0rKVxccyprYktCLyk7XHJcbiAgICAgICAgaWYgKGxvZ0NvbXBsZXRlTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbk5hbWUgPSBsb2dDb21wbGV0ZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICBjb25zdCBsYW5nQ29kZSA9IGxvZ0NvbXBsZXRlTWF0Y2hbMl07XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkVGltZSA9IHBhcnNlRmxvYXQobG9nQ29tcGxldGVNYXRjaFszXSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNpemVLQiA9IHBhcnNlRmxvYXQobG9nQ29tcGxldGVNYXRjaFs0XSk7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0KHQvtGF0YDQsNC90Y/QtdC8INC40L3RhNC+0YDQvNCw0YbQuNGOINC+INGB0L7QsdGA0LDQvdC90L7QvCDRhNCw0LnQu9C1XHJcbiAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgbGFuZ0NvZGUsXHJcbiAgICAgICAgICAgICAgICBidWlsZFRpbWUsXHJcbiAgICAgICAgICAgICAgICBzaXplS0IsXHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogYCR7dmVyc2lvbk5hbWV9XyR7bGFuZ0NvZGV9Lmh0bWxgXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IGAke3ZlcnNpb25OYW1lfSAoJHtsYW5nQ29kZX0pINC30LDQstC10YDRiNC10L0g0LfQsCAke2J1aWxkVGltZX1zLCDRgNCw0LfQvNC10YA6ICR7c2l6ZUtCfUtCYDtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0YHQvtC+0LHRidC10L3QuNGPINC+INC30LDQstC10YDRiNC10L3QuNC4INGE0LDQudC70L7QsiDQuNC3INC00YDRg9Cz0LjRhSDRhNC+0YDQvNCw0YLQvtCyIChmYWxsYmFjaylcclxuICAgICAgICAvLyDQmNGJ0LXQvCDQv9Cw0YLRgtC10YDQvSBcInZlcnNpb25OYW1lIChsYW5nKSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgWHMsINGA0LDQt9C80LXRgDogWUtCXCJcclxuICAgICAgICBjb25zdCBmaWxlQ29tcGxldGVNYXRjaCA9IG1zZy5tYXRjaCgvKFxcdyspXFxzKlxcKChcXHcrKVxcKVxccyrQt9Cw0LLQtdGA0YjQtdC9XFxzKtC30LBcXHMqKFtcXGQuXSspcyxcXHMq0YDQsNC30LzQtdGAOlxccyooW1xcZC5dKylcXHMqa2JLQi8pO1xyXG4gICAgICAgIGlmIChmaWxlQ29tcGxldGVNYXRjaCkge1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IGZpbGVDb21wbGV0ZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICBjb25zdCBsYW5nQ29kZSA9IGZpbGVDb21wbGV0ZU1hdGNoWzJdO1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZFRpbWUgPSBwYXJzZUZsb2F0KGZpbGVDb21wbGV0ZU1hdGNoWzNdKTtcclxuICAgICAgICAgICAgY29uc3Qgc2l6ZUtCID0gcGFyc2VGbG9hdChmaWxlQ29tcGxldGVNYXRjaFs0XSk7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0KHQvtGF0YDQsNC90Y/QtdC8INC40L3RhNC+0YDQvNCw0YbQuNGOINC+INGB0L7QsdGA0LDQvdC90L7QvCDRhNCw0LnQu9C1XHJcbiAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgbGFuZ0NvZGUsXHJcbiAgICAgICAgICAgICAgICBidWlsZFRpbWUsXHJcbiAgICAgICAgICAgICAgICBzaXplS0IsXHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogYCR7dmVyc2lvbk5hbWV9XyR7bGFuZ0NvZGV9Lmh0bWxgXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5jdXJyZW50VGFzayA9IGAke3ZlcnNpb25OYW1lfSAoJHtsYW5nQ29kZX0pINC30LDQstC10YDRiNC10L0g0LfQsCAke2J1aWxkVGltZX1zLCDRgNCw0LfQvNC10YA6ICR7c2l6ZUtCfUtCYDtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3Ri9C1INC/0LDRgtGC0LXRgNC90Ysg0LTQu9GPINC+0L/RgNC10LTQtdC70LXQvdC40Y8g0YDQsNC30LzQtdGA0LAg0YTQsNC50LvQsFxyXG4gICAgICAgIC8vINCY0YnQtdC8INC70Y7QsdGL0LUg0YHQvtC+0LHRidC10L3QuNGPINGBINGA0LDQt9C80LXRgNC+0Lwg0LIgS0JcclxuICAgICAgICBjb25zdCBzaXplTWF0Y2ggPSBtc2cubWF0Y2goL9GA0LDQt9C80LXRgDpcXHMqKFtcXGQuXSspS0IvKTtcclxuICAgICAgICBpZiAoc2l6ZU1hdGNoICYmICFtc2cuaW5jbHVkZXMoJ1tTVVBFUkhUTUxfU1VDQ0VTU10nKSAmJiAhbXNnLmluY2x1ZGVzKCfinJMnKSkge1xyXG4gICAgICAgICAgICBjb25zdCBzaXplS0IgPSBwYXJzZUZsb2F0KHNpemVNYXRjaFsxXSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GL0YLQsNC10LzRgdGPINC40LfQstC70LXRh9GMINC40L3RhNC+0YDQvNCw0YbQuNGOINC+INCy0LXRgNGB0LjQuCDQuCDRj9C30YvQutC1INC40Lcg0LrQvtC90YLQtdC60YHRgtCwXHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25NYXRjaCA9IG1zZy5tYXRjaCgvKFxcdyspXFxzKlxcKChcXHcrKVxcKS8pO1xyXG4gICAgICAgICAgICBpZiAodmVyc2lvbk1hdGNoKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IHZlcnNpb25NYXRjaFsxXTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxhbmdDb2RlID0gdmVyc2lvbk1hdGNoWzJdO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCf0YDQvtCy0LXRgNGP0LXQvCwg0L3QtSDQtNC+0LHQsNCy0LvQtdC9INC70Lgg0YPQttC1INGN0YLQvtGCINGE0LDQudC7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ0ZpbGUgPSB0aGlzLmJ1aWx0RmlsZXMuZmluZChmID0+IGYudmVyc2lvbk5hbWUgPT09IHZlcnNpb25OYW1lICYmIGYubGFuZ0NvZGUgPT09IGxhbmdDb2RlKTtcclxuICAgICAgICAgICAgICAgIGlmICghZXhpc3RpbmdGaWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5idWlsdEZpbGVzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uTmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ0NvZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkVGltZTogMCwgLy8g0JLRgNC10LzRjyDQvdC10LjQt9Cy0LXRgdGC0L3QvlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplS0IsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBgJHt2ZXJzaW9uTmFtZX1fJHtsYW5nQ29kZX0uaHRtbGBcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmFsbGJhY2sg0LTQu9GPINGB0YLQsNGA0L7Qs9C+INGE0L7RgNC80LDRgtCwIFNVQ0NFU1MgKNCx0LXQtyDQtNC10YLQsNC70YzQvdC+0Lkg0LjQvdGE0L7RgNC80LDRhtC40LgpXHJcbiAgICAgICAgY29uc3Qgc2ltcGxlU3VjY2Vzc01hdGNoID0gbXNnLm1hdGNoKC9cXFtTVVBFUkhUTUxfU1VDQ0VTU1xcXSAoLispLyk7XHJcbiAgICAgICAgaWYgKHNpbXBsZVN1Y2Nlc3NNYXRjaCkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gc2ltcGxlU3VjY2Vzc01hdGNoWzFdO1xyXG4gICAgICAgICAgICAvLyDQn9C70LDQstC90L4g0LTQvtCy0L7QtNC40Lwg0LTQviAxMDAlXHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QsNGA0YHQuNC8INGB0L7QvtCx0YnQtdC90LjRjyBTRlRQINGBINC30LDQstC10YDRiNC10L3QuNC10Lwg0YTQsNC50LvQvtCyXHJcbiAgICAgICAgLy8g0KTQvtGA0LzQsNGCOiDinIUgJ3ZlcnNpb25OYW1lJyAoU0ZUUCkgfCDwn5WTIHRpbWVcclxuICAgICAgICBjb25zdCBzZnRwQ29tcGxldGVNYXRjaCA9IG1zZy5tYXRjaCgv4pyFXFxzKicoW14nXSspJ1xccypcXChTRlRQXFwpXFxzKlxcfFxccyrwn5WTXFxzKihbXFxkLl0rKXMvKTtcclxuICAgICAgICBpZiAoc2Z0cENvbXBsZXRlTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbk5hbWUgPSBzZnRwQ29tcGxldGVNYXRjaFsxXTtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRUaW1lID0gcGFyc2VGbG9hdChzZnRwQ29tcGxldGVNYXRjaFsyXSk7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0JTQu9GPIFNGVFAg0YTQsNC50LvQvtCyINC80Ysg0L3QtSDQt9C90LDQtdC8INGA0LDQt9C80LXRgCwg0L3QviDQvNC+0LbQtdC8INC00L7QsdCw0LLQuNGC0Ywg0YTQsNC50Lsg0YEg0L/RgNC40LzQtdGA0L3Ri9C8INGA0LDQt9C80LXRgNC+0LxcclxuICAgICAgICAgICAgLy8g0LjQu9C4INC/0L7Qv9GA0L7QsdC+0LLQsNGC0Ywg0L/QvtC70YPRh9C40YLRjCDRgNCw0LfQvNC10YAg0LjQtyDRhNCw0LnQu9C+0LLQvtC5INGB0LjRgdGC0LXQvNGLXHJcbiAgICAgICAgICAgIHRoaXMuYnVpbHRGaWxlcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25OYW1lLFxyXG4gICAgICAgICAgICAgICAgbGFuZ0NvZGU6ICdTRlRQJywgLy8g0KPQutCw0LfRi9Cy0LDQtdC8INGH0YLQviDRjdGC0L4gU0ZUUCDRhNCw0LnQu1xyXG4gICAgICAgICAgICAgICAgYnVpbGRUaW1lLFxyXG4gICAgICAgICAgICAgICAgc2l6ZUtCOiAwLCAvLyDQoNCw0LfQvNC10YAg0L3QtdC40LfQstC10YHRgtC10L0g0LTQu9GPIFNGVFAg0YTQsNC50LvQvtCyXHJcbiAgICAgICAgICAgICAgICBmaWxlTmFtZTogYCR7dmVyc2lvbk5hbWV9X3NmdHAuaHRtbGBcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gYCR7dmVyc2lvbk5hbWV9IChTRlRQKSDQt9Cw0LLQtdGA0YjQtdC9INC30LAgJHtidWlsZFRpbWV9c2A7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gRmFsbGJhY2sg0LTQu9GPINGB0YLQsNGA0YvRhSDQu9C+0LPQvtCyICjQstGA0LXQvNC10L3QvdC+KVxyXG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ+KPsyDQmNC90LjRhtC40LDQu9C40LfQsNGG0LjRjyDRgdCx0L7RgNC60LguLi4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPJztcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU3VwZXJIdG1sUHJvZ3Jlc3MoMTAsIDUwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobXNnLmluY2x1ZGVzKCfij7Mg0JbQtNC10Lwg0L/QsNC60L7QstC60LguLi4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9Ce0LbQuNC00LDQvdC40LUg0L/QsNC60L7QstC60LgnO1xyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTdXBlckh0bWxQcm9ncmVzcygyMCwgNTAwKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSBlbHNlIGlmIChtc2cuaW5jbHVkZXMoJ+KchScpICYmIG1zZy5pbmNsdWRlcygnfCDwn5WTJykgJiYgbXNnLmluY2x1ZGVzKCd8IPCfk6YnKSkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVN1cGVySHRtbFByb2dyZXNzKDEwMCwgMTAwMCk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QsNGA0YHQuNC90LMg0YHRgtGA0YPQutGC0YPRgNC40YDQvtCy0LDQvdC90YvRhSBTRlRQINC70L7Qs9C+0LJcclxuICAgICAqL1xyXG4gICAgcGFyc2VTZnRwTG9ncyhtc2c6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgIGxldCBoYXNVcGRhdGVzID0gZmFsc2U7XHJcblxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0L/RgNC+0LPRgNC10YHRgSDQt9Cw0LPRgNGD0LfQutC4XHJcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3NNYXRjaCA9IG1zZy5tYXRjaCgvXFxbU0ZUUF9QUk9HUkVTU1xcXSAoXFxkKylcXC8oXFxkKykgKFtcXGQuXSspJSAoXFxkKylzLyk7XHJcbiAgICAgICAgaWYgKHByb2dyZXNzTWF0Y2gpIHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGVyY2VudGFnZSA9IHBhcnNlRmxvYXQocHJvZ3Jlc3NNYXRjaFszXSk7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnQgPSBwYXJzZUludChwcm9ncmVzc01hdGNoWzFdKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MudG90YWwgPSBwYXJzZUludChwcm9ncmVzc01hdGNoWzJdKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwUHJvZ3Jlc3MuZXRhID0gcGFyc2VJbnQocHJvZ3Jlc3NNYXRjaFs0XSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCDQv9C70LDQstC90YPRjiDQsNC90LjQvNCw0YbQuNGOINC00LvRjyDQv9C10YDQtdGF0L7QtNCwINC6INC90L7QstC+0LzRgyDQv9GA0L7RhtC10L3RgtGDXHJcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0ZVNmdHBQcm9ncmVzcyh0YXJnZXRQZXJjZW50YWdlLCA4MDApO1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDQvdCw0YfQsNC70L4g0LjQvdGE0L7RgNC80LDRhtC40Lgg0L4g0L/QsNC/0LrQtVxyXG4gICAgICAgIGNvbnN0IGNsZWFuSW5mb1N0YXJ0TWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NGVFBfQ0xFQU5fSU5GT19TVEFSVFxcXSAoLispIChcXGQrKS8pO1xyXG4gICAgICAgIGlmIChjbGVhbkluZm9TdGFydE1hdGNoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cENsZWFuSW5mbyA9IHtcclxuICAgICAgICAgICAgICAgIHBhdGg6IGNsZWFuSW5mb1N0YXJ0TWF0Y2hbMV0sXHJcbiAgICAgICAgICAgICAgICB0b3RhbEl0ZW1zOiBwYXJzZUludChjbGVhbkluZm9TdGFydE1hdGNoWzJdKSxcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiBbXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0LDRgNGB0LjQvCDRjdC70LXQvNC10L3RgtGLINC00LvRjyDRg9C00LDQu9C10L3QuNGPXHJcbiAgICAgICAgLy8g0JTQu9GPINC/0LDQv9C+0Lo6IFtTRlRQX0NMRUFOX0lURU1dIEZPTERFUiBuYW1lIHBhdGggLSBwZXJtaXNzaW9ucyBtb2RpZnlUaW1lXHJcbiAgICAgICAgLy8g0JTQu9GPINGE0LDQudC70L7QsjogW1NGVFBfQ0xFQU5fSVRFTV0gRklMRSBuYW1lIHBhdGggc2l6ZSBmb3JtYXR0ZWRTaXplIHBlcm1pc3Npb25zIG1vZGlmeVRpbWVcclxuXHJcbiAgICAgICAgLy8g0J7QsdGA0LDQsdCw0YLRi9Cy0LDQtdC8INCy0YHQtSDRjdC70LXQvNC10L3RgtGLINCyINGB0L7QvtCx0YnQtdC90LjQuCAo0LzQvtC20LXRgiDQsdGL0YLRjCDQvdC10YHQutC+0LvRjNC60L4pXHJcbiAgICAgICAgY29uc3QgZm9sZGVyTWF0Y2hlcyA9IG1zZy5tYXRjaEFsbCgvXFxbU0ZUUF9DTEVBTl9JVEVNXFxdIEZPTERFUiAoLispICguKykgLSAoLispICguKykvZyk7XHJcbiAgICAgICAgZm9yIChjb25zdCBtYXRjaCBvZiBmb2xkZXJNYXRjaGVzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnRk9MREVSJyxcclxuICAgICAgICAgICAgICAgIG5hbWU6IG1hdGNoWzFdLFxyXG4gICAgICAgICAgICAgICAgcGF0aDogbWF0Y2hbMl0sXHJcbiAgICAgICAgICAgICAgICBzaXplOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uczogbWF0Y2hbM10sXHJcbiAgICAgICAgICAgICAgICBtb2RpZnlUaW1lOiBtYXRjaFs0XVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBDbGVhbkluZm8uaXRlbXMucHVzaChpdGVtKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBmaWxlTWF0Y2hlcyA9IG1zZy5tYXRjaEFsbCgvXFxbU0ZUUF9DTEVBTl9JVEVNXFxdIEZJTEUgKC4rKSAoLispICguKykgKC4rKSAoLispICguKykvZyk7XHJcbiAgICAgICAgZm9yIChjb25zdCBtYXRjaCBvZiBmaWxlTWF0Y2hlcykge1xyXG4gICAgICAgICAgICBjb25zdCBpdGVtID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ0ZJTEUnLFxyXG4gICAgICAgICAgICAgICAgbmFtZTogbWF0Y2hbMV0sXHJcbiAgICAgICAgICAgICAgICBwYXRoOiBtYXRjaFsyXSxcclxuICAgICAgICAgICAgICAgIHNpemU6IG1hdGNoWzRdLCAvLyBmb3JtYXR0ZWRTaXplXHJcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uczogbWF0Y2hbNV0sXHJcbiAgICAgICAgICAgICAgICBtb2RpZnlUaW1lOiBtYXRjaFs2XVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBDbGVhbkluZm8uaXRlbXMucHVzaChpdGVtKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9Cw0YDRgdC40Lwg0YHRgtCw0YLQuNGB0YLQuNC60YNcclxuICAgICAgICBjb25zdCBjbGVhblN0YXRzTWF0Y2ggPSBtc2cubWF0Y2goL1xcW1NGVFBfQ0xFQU5fU1RBVFNcXF0gKFxcZCspIChcXGQrKSAoXFxkKykgKFxcZCspICguKykvKTtcclxuICAgICAgICBpZiAoY2xlYW5TdGF0c01hdGNoKSB7XHJcbiAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDRgdGC0LDRgtC40YHRgtC40LrRgyDQsiDQuNC90YLQtdGA0YTQtdC50YHQtVxyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNmdHBDbGVhbkluZm8oKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0LjQvdGC0LXRgNGE0LXQudGBINC/0L7RgdC70LUg0LrQsNC20LTQvtCz0L4g0LTQvtCx0LDQstC70LXQvdC40Y8g0Y3Qu9C10LzQtdC90YLQsFxyXG4gICAgICAgIGlmIChoYXNVcGRhdGVzKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2Z0cENsZWFuSW5mbygpO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIC8vIEZhbGxiYWNrINC00LvRjyDRgdGC0LDRgNGL0YUg0LvQvtCz0L7QsiBTRlRQICjQstGA0LXQvNC10L3QvdC+KVxyXG4gICAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ1NGVFAg0LfQsNC70LjQstC60LAg0L3QsNGH0LDQu9Cw0YHRjCcpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPJztcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU2Z0cFByb2dyZXNzKDEwLCA1MDApO1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKG1zZy5pbmNsdWRlcygn0J/QvtC00LrQu9GO0YfQtdC90LjQtSDQuiDRgdC10YDQstC10YDRgycpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9Cf0L7QtNC60LvRjtGH0LXQvdC40LUnO1xyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTZnRwUHJvZ3Jlc3MoMjAsIDUwMCk7XHJcbiAgICAgICAgICAgIGhhc1VwZGF0ZXMgPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAobXNnLmluY2x1ZGVzKCfQl9Cw0LPRgNGD0LfQutCwINGE0LDQudC70L7QsicpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQs9GA0YPQt9C60LAg0YTQsNC50LvQvtCyJztcclxuICAgICAgICAgICAgdGhpcy5hbmltYXRlU2Z0cFByb2dyZXNzKDUwLCA1MDApO1xyXG4gICAgICAgICAgICBoYXNVcGRhdGVzID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKG1zZy5pbmNsdWRlcygnU0ZUUCDQt9Cw0LvQuNCy0LrQsCDQt9Cw0LLQtdGA0YjQtdC90LAg0YPRgdC/0LXRiNC90L4nKSkge1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcy5jdXJyZW50VGFzayA9ICfQl9Cw0LLQtdGA0YjQtdC90L4nO1xyXG4gICAgICAgICAgICB0aGlzLmFuaW1hdGVTZnRwUHJvZ3Jlc3MoMTAwLCAxMDAwKTtcclxuICAgICAgICAgICAgaGFzVXBkYXRlcyA9IHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gaGFzVXBkYXRlcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0LHQvdC+0LLQu9C10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsCDQsiDQuNC90YLQtdGA0YTQtdC50YHQtVxyXG4gICAgICovXHJcbiAgICB1cGRhdGVNYWluQnVpbGRQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBtYWluQnVpbGRUaW1lID0gdGhpcy51aUVsZW1lbnRzLm1haW5CdWlsZFRpbWU7XHJcbiAgICAgICAgY29uc3QgbWFpbkJ1aWxkU2VjdGlvbiA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRTZWN0aW9uO1xyXG4gICAgICAgIGNvbnN0IG1haW5CdWlsZFByb2dyZXNzID0gdGhpcy51aUVsZW1lbnRzLm1haW5CdWlsZFByb2dyZXNzO1xyXG4gICAgICAgIGNvbnN0IG1haW5CdWlsZFN0YXR1cyA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRTdGF0dXM7XHJcbiAgICAgICAgY29uc3QgbWFpbkJ1aWxkUHJvZ3Jlc3NGaWxsID0gdGhpcy51aUVsZW1lbnRzLm1haW5CdWlsZFByb2dyZXNzRmlsbDtcclxuICAgICAgICBjb25zdCBtYWluQnVpbGRQZXJjZW50YWdlID0gdGhpcy51aUVsZW1lbnRzLm1haW5CdWlsZFBlcmNlbnRhZ2U7XHJcblxyXG4gICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQstGA0LXQvNGPXHJcbiAgICAgICAgaWYgKG1haW5CdWlsZFRpbWUpIHtcclxuICAgICAgICAgICAgbWFpbkJ1aWxkVGltZS50ZXh0Q29udGVudCA9IGBbJHt0aGlzLm1haW5CdWlsZEN1cnJlbnRUaW1lfV1gO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INGB0YLQsNGC0YPRgVxyXG4gICAgICAgIGlmIChtYWluQnVpbGRTdGF0dXMpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgbWFpbkJ1aWxkU3RhdHVzLnRleHRDb250ZW50ID0gJ+KPsyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgICAgICBtYWluQnVpbGRTdGF0dXMudGV4dENvbnRlbnQgPSAn4o+zJztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG1haW5CdWlsZFN0YXR1cy50ZXh0Q29udGVudCA9ICfinIUnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YBcclxuICAgICAgICBpZiAobWFpbkJ1aWxkUHJvZ3Jlc3NGaWxsKSB7XHJcbiAgICAgICAgICAgIG1haW5CdWlsZFByb2dyZXNzRmlsbC5zdHlsZS53aWR0aCA9IGAke3RoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZX0lYDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7RhtC10L3RglxyXG4gICAgICAgIGlmIChtYWluQnVpbGRQZXJjZW50YWdlKSB7XHJcbiAgICAgICAgICAgIG1haW5CdWlsZFBlcmNlbnRhZ2UudGV4dENvbnRlbnQgPSBgJHtNYXRoLnJvdW5kKHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSl9JWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0YHQvtGB0YLQvtGP0L3QuNC1INGB0LXQutGG0LjQuFxyXG4gICAgICAgIGlmIChtYWluQnVpbGRTZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIC8vINCj0LHQuNGA0LDQtdC8INCy0YHQtSDQutC70LDRgdGB0Ysg0YHQvtGB0YLQvtGP0L3QuNC5XHJcbiAgICAgICAgICAgIG1haW5CdWlsZFNlY3Rpb24uY2xhc3NMaXN0LnJlbW92ZSgncHJvZ3Jlc3MtcGVuZGluZycsICdwcm9ncmVzcy1hY3RpdmUnLCAncHJvZ3Jlc3MtY29tcGxldGVkJywgJ3Byb2dyZXNzLXNraXBwZWQnKTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIG1haW5CdWlsZFNlY3Rpb24uY2xhc3NMaXN0LmFkZCgncHJvZ3Jlc3MtcGVuZGluZycpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA8IDEwMCkge1xyXG4gICAgICAgICAgICAgICAgbWFpbkJ1aWxkU2VjdGlvbi5jbGFzc0xpc3QuYWRkKCdwcm9ncmVzcy1hY3RpdmUnKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG1haW5CdWlsZFNlY3Rpb24uY2xhc3NMaXN0LmFkZCgncHJvZ3Jlc3MtY29tcGxldGVkJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8L9GB0LrRgNGL0LLQsNC10Lwg0LjQvdC00LjQutCw0YLQvtGAINC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICAgIGlmIChtYWluQnVpbGRQcm9ncmVzcykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID4gMCkge1xyXG4gICAgICAgICAgICAgICAgbWFpbkJ1aWxkUHJvZ3Jlc3MuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgICAgICBtYWluQnVpbGRQcm9ncmVzcy5jbGFzc0xpc3QucmVtb3ZlKCdwZW5kaW5nJywgJ2NvbXBsZXRlZCcsICdza2lwcGVkJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWFpbkJ1aWxkUHJvZ3Jlc3MuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG1haW5CdWlsZFByb2dyZXNzLmNsYXNzTGlzdC5hZGQoJ2NvbXBsZXRlZCcpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbWFpbkJ1aWxkUHJvZ3Jlc3MuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntCx0L3QvtCy0LvQtdC90LjQtSDQv9GA0L7Qs9GA0LXRgdGB0LAgU3VwZXJIVE1MINCyINC40L3RgtC10YDRhNC10LnRgdC1XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZVN1cGVySHRtbFByb2dyZXNzKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHN1cGVyaHRtbFRpbWUgPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sVGltZTtcclxuICAgICAgICBjb25zdCBzdXBlcmh0bWxTZWN0aW9uID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFNlY3Rpb247XHJcbiAgICAgICAgY29uc3Qgc3VwZXJodG1sUHJvZ3Jlc3MgPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sUHJvZ3Jlc3M7XHJcbiAgICAgICAgY29uc3Qgc3VwZXJodG1sU3RhdHVzID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFN0YXR1cztcclxuICAgICAgICBjb25zdCBzdXBlcmh0bWxQcm9ncmVzc0ZpbGwgPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sUHJvZ3Jlc3NGaWxsO1xyXG4gICAgICAgIGNvbnN0IHN1cGVyaHRtbFBlcmNlbnRhZ2UgPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sUGVyY2VudGFnZTtcclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INCy0YDQtdC80Y9cclxuICAgICAgICBpZiAoc3VwZXJodG1sVGltZSkge1xyXG4gICAgICAgICAgICBzdXBlcmh0bWxUaW1lLnRleHRDb250ZW50ID0gYFske3RoaXMuc3VwZXJIdG1sQ3VycmVudFRpbWV9XWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0YHRgtCw0YLRg9GBXHJcbiAgICAgICAgaWYgKHN1cGVyaHRtbFN0YXR1cykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBzdXBlcmh0bWxTdGF0dXMudGV4dENvbnRlbnQgPSAn4o+zJztcclxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2UgPCAxMDApIHtcclxuICAgICAgICAgICAgICAgIHN1cGVyaHRtbFN0YXR1cy50ZXh0Q29udGVudCA9ICfij7MnO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VwZXJodG1sU3RhdHVzLnRleHRDb250ZW50ID0gJ+KchSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgFxyXG4gICAgICAgIGlmIChzdXBlcmh0bWxQcm9ncmVzc0ZpbGwpIHtcclxuICAgICAgICAgICAgc3VwZXJodG1sUHJvZ3Jlc3NGaWxsLnN0eWxlLndpZHRoID0gYCR7dGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlfSVgO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC/0YDQvtGG0LXQvdGCXHJcbiAgICAgICAgaWYgKHN1cGVyaHRtbFBlcmNlbnRhZ2UpIHtcclxuICAgICAgICAgICAgc3VwZXJodG1sUGVyY2VudGFnZS50ZXh0Q29udGVudCA9IGAke01hdGgucm91bmQodGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlKX0lYDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDRgdC+0YHRgtC+0Y/QvdC40LUg0YHQtdC60YbQuNC4XHJcbiAgICAgICAgaWYgKHN1cGVyaHRtbFNlY3Rpb24pIHtcclxuICAgICAgICAgICAgLy8g0KPQsdC40YDQsNC10Lwg0LLRgdC1INC60LvQsNGB0YHRiyDRgdC+0YHRgtC+0Y/QvdC40LlcclxuICAgICAgICAgICAgc3VwZXJodG1sU2VjdGlvbi5jbGFzc0xpc3QucmVtb3ZlKCdwcm9ncmVzcy1wZW5kaW5nJywgJ3Byb2dyZXNzLWFjdGl2ZScsICdwcm9ncmVzcy1jb21wbGV0ZWQnLCAncHJvZ3Jlc3Mtc2tpcHBlZCcpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgc3VwZXJodG1sU2VjdGlvbi5jbGFzc0xpc3QuYWRkKCdwcm9ncmVzcy1wZW5kaW5nJyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgICAgICBzdXBlcmh0bWxTZWN0aW9uLmNsYXNzTGlzdC5hZGQoJ3Byb2dyZXNzLWFjdGl2ZScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VwZXJodG1sU2VjdGlvbi5jbGFzc0xpc3QuYWRkKCdwcm9ncmVzcy1jb21wbGV0ZWQnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwv0YHQutGA0YvQstCw0LXQvCDQuNC90LTQuNC60LDRgtC+0YAg0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICAgICAgaWYgKHN1cGVyaHRtbFByb2dyZXNzKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2UgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBzdXBlcmh0bWxQcm9ncmVzcy5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgICAgIHN1cGVyaHRtbFByb2dyZXNzLmNsYXNzTGlzdC5yZW1vdmUoJ3BlbmRpbmcnLCAnY29tcGxldGVkJywgJ3NraXBwZWQnKTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2UgPCAxMDApIHtcclxuICAgICAgICAgICAgICAgICAgICBzdXBlcmh0bWxQcm9ncmVzcy5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VwZXJodG1sUHJvZ3Jlc3MuY2xhc3NMaXN0LmFkZCgnY29tcGxldGVkJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdXBlcmh0bWxQcm9ncmVzcy5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0LHQvdC+0LLQu9C10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCBTRlRQINCyINC40L3RgtC10YDRhNC10LnRgdC1XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZVNmdHBQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBzZnRwVGltZSA9IHRoaXMudWlFbGVtZW50cy5zZnRwVGltZTtcclxuICAgICAgICBjb25zdCBzZnRwU2VjdGlvbiA9IHRoaXMudWlFbGVtZW50cy5zZnRwU2VjdGlvbjtcclxuICAgICAgICBjb25zdCBzZnRwUHJvZ3Jlc3MgPSB0aGlzLnVpRWxlbWVudHMuc2Z0cFByb2dyZXNzO1xyXG4gICAgICAgIGNvbnN0IHNmdHBTdGF0dXMgPSB0aGlzLnVpRWxlbWVudHMuc2Z0cFN0YXR1cztcclxuICAgICAgICBjb25zdCBzZnRwUHJvZ3Jlc3NGaWxsID0gdGhpcy51aUVsZW1lbnRzLnNmdHBQcm9ncmVzc0ZpbGw7XHJcbiAgICAgICAgY29uc3Qgc2Z0cFBlcmNlbnRhZ2UgPSB0aGlzLnVpRWxlbWVudHMuc2Z0cFBlcmNlbnRhZ2U7XHJcblxyXG4gICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQstGA0LXQvNGPXHJcbiAgICAgICAgaWYgKHNmdHBUaW1lKSB7XHJcbiAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQstGA0LXQvNGPINGC0L7Qu9GM0LrQviDQtdGB0LvQuCDRgyDQvdCw0YEg0LXRgdGC0Ywg0LTQsNC90L3Ri9C1INC+INC/0YDQvtCz0YDQtdGB0YHQtVxyXG4gICAgICAgICAgICBpZiAodGhpcy5zZnRwUHJvZ3Jlc3MudG90YWwgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBzZnRwVGltZS50ZXh0Q29udGVudCA9IGBbJHt0aGlzLnNmdHBDdXJyZW50VGltZX1dIFske3RoaXMuc2Z0cFByb2dyZXNzLmN1cnJlbnR9LyR7dGhpcy5zZnRwUHJvZ3Jlc3MudG90YWx9XSAke01hdGgucm91bmQodGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSl9JWA7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZnRwVGltZS50ZXh0Q29udGVudCA9IGBbJHt0aGlzLnNmdHBDdXJyZW50VGltZX1dYDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INGB0YLQsNGC0YPRgVxyXG4gICAgICAgIGlmIChzZnRwU3RhdHVzKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNmdHBQcm9ncmVzcy5wZXJjZW50YWdlID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBzZnRwU3RhdHVzLnRleHRDb250ZW50ID0gJ+KPsyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSA8IDEwMCkge1xyXG4gICAgICAgICAgICAgICAgc2Z0cFN0YXR1cy50ZXh0Q29udGVudCA9ICfij7MnO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc2Z0cFN0YXR1cy50ZXh0Q29udGVudCA9ICfinIUnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YBcclxuICAgICAgICBpZiAoc2Z0cFByb2dyZXNzRmlsbCkge1xyXG4gICAgICAgICAgICBzZnRwUHJvZ3Jlc3NGaWxsLnN0eWxlLndpZHRoID0gYCR7dGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZX0lYDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7RhtC10L3RglxyXG4gICAgICAgIGlmIChzZnRwUGVyY2VudGFnZSkge1xyXG4gICAgICAgICAgICBzZnRwUGVyY2VudGFnZS50ZXh0Q29udGVudCA9IGAke01hdGgucm91bmQodGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSl9JWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0YHQvtGB0YLQvtGP0L3QuNC1INGB0LXQutGG0LjQuFxyXG4gICAgICAgIGlmIChzZnRwU2VjdGlvbikge1xyXG4gICAgICAgICAgICAvLyDQo9Cx0LjRgNCw0LXQvCDQstGB0LUg0LrQu9Cw0YHRgdGLINGB0L7RgdGC0L7Rj9C90LjQuVxyXG4gICAgICAgICAgICBzZnRwU2VjdGlvbi5jbGFzc0xpc3QucmVtb3ZlKCdwcm9ncmVzcy1wZW5kaW5nJywgJ3Byb2dyZXNzLWFjdGl2ZScsICdwcm9ncmVzcy1jb21wbGV0ZWQnLCAncHJvZ3Jlc3Mtc2tpcHBlZCcpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2UgPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHNmdHBTZWN0aW9uLmNsYXNzTGlzdC5hZGQoJ3Byb2dyZXNzLXBlbmRpbmcnKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNmdHBQcm9ncmVzcy5wZXJjZW50YWdlIDwgMTAwKSB7XHJcbiAgICAgICAgICAgICAgICBzZnRwU2VjdGlvbi5jbGFzc0xpc3QuYWRkKCdwcm9ncmVzcy1hY3RpdmUnKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNmdHBTZWN0aW9uLmNsYXNzTGlzdC5hZGQoJ3Byb2dyZXNzLWNvbXBsZXRlZCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQn9C+0LrQsNC30YvQstCw0LXQvC/RgdC60YDRi9Cy0LDQtdC8INC40L3QtNC40LrQsNGC0L7RgCDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAgICBpZiAoc2Z0cFByb2dyZXNzKSB7XHJcbiAgICAgICAgICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAINC10YHQu9C4INC10YHRgtGMINC00LDQvdC90YvQtSDQviDQv9GA0L7Qs9GA0LXRgdGB0LUgKHRvdGFsID4gMCkg0LjQu9C4INC10YHQu9C4INC/0YDQvtGG0LXQvdGCID4gMFxyXG4gICAgICAgICAgICBpZiAodGhpcy5zZnRwUHJvZ3Jlc3MudG90YWwgPiAwIHx8IHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2UgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBzZnRwUHJvZ3Jlc3MuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgICAgICBzZnRwUHJvZ3Jlc3MuY2xhc3NMaXN0LnJlbW92ZSgncGVuZGluZycsICdjb21wbGV0ZWQnLCAnc2tpcHBlZCcpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2UgPT09IDAgJiYgdGhpcy5zZnRwUHJvZ3Jlc3MudG90YWwgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0KHQvtGB0YLQvtGP0L3QuNC1INC+0LbQuNC00LDQvdC40Y8gLSDQv9C+0LrQsNC30YvQstCw0LXQvCDQutCw0LogcGVuZGluZ1xyXG4gICAgICAgICAgICAgICAgICAgIHNmdHBQcm9ncmVzcy5jbGFzc0xpc3QuYWRkKCdwZW5kaW5nJyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2UgPCAxMDApIHtcclxuICAgICAgICAgICAgICAgICAgICBzZnRwUHJvZ3Jlc3MuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHNmdHBQcm9ncmVzcy5jbGFzc0xpc3QuYWRkKCdjb21wbGV0ZWQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNmdHBQcm9ncmVzcy5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0LHQvdC+0LLQu9C10L3QuNC1INC40L3RhNC+0YDQvNCw0YbQuNC4INC+INC/0LDQv9C60LDRhSDQtNC70Y8g0YPQtNCw0LvQtdC90LjRj1xyXG4gICAgICovXHJcbiAgICB1cGRhdGVTZnRwQ2xlYW5JbmZvKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHNmdHBDbGVhbkluZm9FbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnNmdHBDbGVhbkluZm87XHJcbiAgICAgICAgaWYgKHNmdHBDbGVhbkluZm9FbGVtZW50ICYmIHRoaXMuc2Z0cENsZWFuSW5mby5pdGVtcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGxldCBodG1sID0gYDxkaXYgY2xhc3M9XCJzZnRwLWNsZWFuLWhlYWRlclwiPlxyXG4gICAgICAgICAgICAgICAgPGg0PkZvbGRlcjogJHt0aGlzLnNmdHBDbGVhbkluZm8ucGF0aH08L2g0PlxyXG4gICAgICAgICAgICAgICAgPHA+VG90YWwgaXRlbXM6ICR7dGhpcy5zZnRwQ2xlYW5JbmZvLnRvdGFsSXRlbXN9PC9wPlxyXG4gICAgICAgICAgICA8L2Rpdj5gO1xyXG5cclxuICAgICAgICAgICAgLy8g0JPRgNGD0L/Qv9C40YDRg9C10Lwg0L/QviDRgtC40L/QsNC8XHJcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSB0aGlzLnNmdHBDbGVhbkluZm8uaXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlID09PSAnRk9MREVSJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5zZnRwQ2xlYW5JbmZvLml0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ0ZJTEUnKTtcclxuXHJcblxyXG4gICAgICAgICAgICBpZiAoZm9sZGVycy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9ICc8ZGl2IGNsYXNzPVwic2Z0cC1jbGVhbi1ncm91cFwiPic7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IGA8aDU+Rm9sZGVycyAoJHtmb2xkZXJzLmxlbmd0aH0pOjwvaDU+YDtcclxuICAgICAgICAgICAgICAgIGZvbGRlcnMuZm9yRWFjaChmb2xkZXIgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9XCJzZnRwLWNsZWFuLWl0ZW0gZm9sZGVyXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJpdGVtLW5hbWVcIj4ke2ZvbGRlci5uYW1lfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PmA7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gJzwvZGl2Pic7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChmaWxlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9ICc8ZGl2IGNsYXNzPVwic2Z0cC1jbGVhbi1ncm91cFwiPic7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9IGA8aDU+RmlsZXMgKCR7ZmlsZXMubGVuZ3RofSk6PC9oNT5gO1xyXG4gICAgICAgICAgICAgICAgZmlsZXMuZm9yRWFjaChmaWxlID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwic2Z0cC1jbGVhbi1pdGVtIGZpbGVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cIml0ZW0tbmFtZVwiPiR7ZmlsZS5uYW1lfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PmA7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIGh0bWwgKz0gJzwvZGl2Pic7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQv9GA0LXQtNGD0L/RgNC10LbQtNC10L3QuNC1XHJcbiAgICAgICAgICAgIGh0bWwgKz0gJzxkaXYgY2xhc3M9XCJzZnRwLWNsZWFuLXdhcm5pbmdcIj4nO1xyXG4gICAgICAgICAgICBodG1sICs9ICc8ZGl2IGNsYXNzPVwid2FybmluZy10ZXh0XCI+QWxsIHRoZXNlIGl0ZW1zIHdpbGwgYmUgZGVsZXRlZCE8L2Rpdj4nO1xyXG4gICAgICAgICAgICBodG1sICs9ICc8L2Rpdj4nO1xyXG5cclxuXHJcbiAgICAgICAgICAgIHNmdHBDbGVhbkluZm9FbGVtZW50LmlubmVySFRNTCA9IGh0bWw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/Qu9Cw0LLQvdCw0Y8g0LDQvdC40LzQsNGG0LjRjyDQv9GA0L7Qs9GA0LXRgdGB0LAgU3VwZXJIVE1MXHJcbiAgICAgKi9cclxuICAgIGFuaW1hdGVTdXBlckh0bWxQcm9ncmVzcyh0YXJnZXRQZXJjZW50YWdlOiBudW1iZXIsIGR1cmF0aW9uOiBudW1iZXIgPSAxMDAwKTogdm9pZCB7XHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0L/RgNC10LTRi9C00YPRidGD0Y4g0LDQvdC40LzQsNGG0LjRjlxyXG4gICAgICAgIGlmICh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzdGFydFBlcmNlbnRhZ2UgPSB0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2U7XHJcbiAgICAgICAgY29uc3QgZGlmZmVyZW5jZSA9IHRhcmdldFBlcmNlbnRhZ2UgLSBzdGFydFBlcmNlbnRhZ2U7XHJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICAgICAgdGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2dyZXNzID0gTWF0aC5taW4oZWxhcHNlZCAvIGR1cmF0aW9uLCAxKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCY0YHQv9C+0LvRjNC30YPQtdC8IGVhc2luZyDRhNGD0L3QutGG0LjRjiDQtNC70Y8g0L/Qu9Cw0LLQvdC+0YHRgtC4XHJcbiAgICAgICAgICAgIGNvbnN0IGVhc2VQcm9ncmVzcyA9IDEgLSBNYXRoLnBvdygxIC0gcHJvZ3Jlc3MsIDMpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50UGVyY2VudGFnZSA9IHN0YXJ0UGVyY2VudGFnZSArIChkaWZmZXJlbmNlICogZWFzZVByb2dyZXNzKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZSA9IGN1cnJlbnRQZXJjZW50YWdlO1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN1cGVySHRtbFByb2dyZXNzKCk7XHJcblxyXG4gICAgICAgICAgICBpZiAocHJvZ3Jlc3MgPj0gMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcy5wZXJjZW50YWdlID0gdGFyZ2V0UGVyY2VudGFnZTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3VwZXJIdG1sUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIDE2KTsgLy8gfjYwIEZQU1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/Qu9Cw0LLQvdCw0Y8g0LDQvdC40LzQsNGG0LjRjyDQv9GA0L7Qs9GA0LXRgdGB0LAgU0ZUUFxyXG4gICAgICovXHJcbiAgICBhbmltYXRlU2Z0cFByb2dyZXNzKHRhcmdldFBlcmNlbnRhZ2U6IG51bWJlciwgZHVyYXRpb246IG51bWJlciA9IDEwMDApOiB2b2lkIHtcclxuICAgICAgICAvLyDQntGB0YLQsNC90LDQstC70LjQstCw0LXQvCDQv9GA0LXQtNGL0LTRg9GJ0YPRjiDQsNC90LjQvNCw0YbQuNGOXHJcbiAgICAgICAgaWYgKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc3RhcnRQZXJjZW50YWdlID0gdGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZTtcclxuICAgICAgICBjb25zdCBkaWZmZXJlbmNlID0gdGFyZ2V0UGVyY2VudGFnZSAtIHN0YXJ0UGVyY2VudGFnZTtcclxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgICAgICB0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2dyZXNzID0gTWF0aC5taW4oZWxhcHNlZCAvIGR1cmF0aW9uLCAxKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCY0YHQv9C+0LvRjNC30YPQtdC8IGVhc2luZyDRhNGD0L3QutGG0LjRjiDQtNC70Y8g0L/Qu9Cw0LLQvdC+0YHRgtC4XHJcbiAgICAgICAgICAgIGNvbnN0IGVhc2VQcm9ncmVzcyA9IDEgLSBNYXRoLnBvdygxIC0gcHJvZ3Jlc3MsIDMpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50UGVyY2VudGFnZSA9IHN0YXJ0UGVyY2VudGFnZSArIChkaWZmZXJlbmNlICogZWFzZVByb2dyZXNzKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzLnBlcmNlbnRhZ2UgPSBjdXJyZW50UGVyY2VudGFnZTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTZnRwUHJvZ3Jlc3MoKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChwcm9ncmVzcyA+PSAxKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcy5wZXJjZW50YWdlID0gdGFyZ2V0UGVyY2VudGFnZTtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU2Z0cFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCAxNik7IC8vIH42MCBGUFNcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCX0LDQv9GD0YHQuiDQvtGC0YHQu9C10LbQuNCy0LDQvdC40Y8g0LLRgNC10LzQtdC90Lgg0Y3RgtCw0L/QsFxyXG4gICAgICovXHJcbiAgICBzdGFydFN0YWdlVGltaW5nKHN0YWdlOiAnbWFpbkJ1aWxkJyB8ICdzdXBlckh0bWxCdWlsZCcgfCAnc2Z0cExvYWQnKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5zdGFnZVRpbWluZ3Nbc3RhZ2VdID0geyBzdGFydDogbmV3IERhdGUoKSB9O1xyXG5cclxuICAgICAgICAvLyDQl9Cw0L/Rg9GB0LrQsNC10Lwg0L7QsdC90L7QstC70LXQvdC40LUg0LLRgNC10LzQtdC90Lgg0LIg0YDQtdCw0LvRjNC90L7QvCDQstGA0LXQvNC10L3QuFxyXG4gICAgICAgIHRoaXMuc3RhcnRQcm9ncmVzc1RpbWVVcGRhdGUoc3RhZ2UpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JfQsNCy0LXRgNGI0LXQvdC40LUg0L7RgtGB0LvQtdC20LjQstCw0L3QuNGPINCy0YDQtdC80LXQvdC4INGN0YLQsNC/0LBcclxuICAgICAqL1xyXG4gICAgZW5kU3RhZ2VUaW1pbmcoc3RhZ2U6ICdtYWluQnVpbGQnIHwgJ3N1cGVySHRtbEJ1aWxkJyB8ICdzZnRwTG9hZCcpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5zdGFnZVRpbWluZ3Nbc3RhZ2VdKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXS5lbmQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgICAgICB0aGlzLnN0YWdlVGltaW5nc1tzdGFnZV0uZHVyYXRpb24gPSBNYXRoLnJvdW5kKFxyXG4gICAgICAgICAgICAgICAgKHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXS5lbmQhLmdldFRpbWUoKSAtIHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXS5zdGFydC5nZXRUaW1lKCkpIC8gMTAwMFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0L7QsdC90L7QstC70LXQvdC40LUg0LLRgNC10LzQtdC90Lgg0LIg0YDQtdCw0LvRjNC90L7QvCDQstGA0LXQvNC10L3QuFxyXG4gICAgICAgIHRoaXMuc3RvcFByb2dyZXNzVGltZVVwZGF0ZShzdGFnZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQpNC+0YDQvNCw0YLQuNGA0L7QstCw0L3QuNC1INCy0YDQtdC80LXQvdC4INGN0YLQsNC/0LBcclxuICAgICAqL1xyXG4gICAgZm9ybWF0U3RhZ2VUaW1lKGR1cmF0aW9uOiBudW1iZXIpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKGR1cmF0aW9uIC8gNjApO1xyXG4gICAgICAgIGNvbnN0IHNlY29uZHMgPSBkdXJhdGlvbiAlIDYwO1xyXG4gICAgICAgIHJldHVybiBgJHttaW51dGVzfdC8ICR7c2Vjb25kc33RgWA7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQl9Cw0L/Rg9GB0Log0L7QsdC90L7QstC70LXQvdC40Y8g0LLRgNC10LzQtdC90Lgg0LIg0YDQtdCw0LvRjNC90L7QvCDQstGA0LXQvNC10L3QuFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXJ0UHJvZ3Jlc3NUaW1lVXBkYXRlKHN0YWdlOiAnbWFpbkJ1aWxkJyB8ICdzdXBlckh0bWxCdWlsZCcgfCAnc2Z0cExvYWQnKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IHRpbWVFbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHN0YWdlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ21haW5CdWlsZCc6XHJcbiAgICAgICAgICAgICAgICB0aW1lRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRUaW1lIHx8IG51bGw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnc3VwZXJIdG1sQnVpbGQnOlxyXG4gICAgICAgICAgICAgICAgdGltZUVsZW1lbnQgPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sVGltZSB8fCBudWxsO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NmdHBMb2FkJzpcclxuICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnNmdHBUaW1lIHx8IG51bGw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGltZUVsZW1lbnQpIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g0J7Rh9C40YnQsNC10Lwg0L/RgNC10LTRi9C00YPRidC40Lkg0LjQvdGC0LXRgNCy0LDQuyDQtdGB0LvQuCDQtdGB0YLRjFxyXG4gICAgICAgIGlmICh0aGlzLnByb2dyZXNzVGltZUludGVydmFsc1tzdGFnZV0pIHtcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnByb2dyZXNzVGltZUludGVydmFsc1tzdGFnZV0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JfQsNC/0YPRgdC60LDQtdC8INC90L7QstGL0Lkg0LjQvdGC0LXRgNCy0LDQu1xyXG4gICAgICAgIHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzW3N0YWdlXSA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXSAmJiB0aGlzLnN0YWdlVGltaW5nc1tzdGFnZV0uc3RhcnQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbGFwc2VkID0gTWF0aC5yb3VuZCgobm93LmdldFRpbWUoKSAtIHRoaXMuc3RhZ2VUaW1pbmdzW3N0YWdlXS5zdGFydC5nZXRUaW1lKCkpIC8gMTAwMCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtaW51dGVzID0gTWF0aC5mbG9vcihlbGFwc2VkIC8gNjApO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2Vjb25kcyA9IGVsYXBzZWQgJSA2MDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVTdHJpbmcgPSBgJHttaW51dGVzfdC8ICR7c2Vjb25kc33RgWA7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0KHQvtGF0YDQsNC90Y/QtdC8INCy0YDQtdC80Y8g0LTQu9GPINGB0L7QvtGC0LLQtdGC0YHRgtCy0YPRjtGJ0LXQs9C+INGN0YLQsNC/0LBcclxuICAgICAgICAgICAgICAgIGlmIChzdGFnZSA9PT0gJ3NmdHBMb2FkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2Z0cEN1cnJlbnRUaW1lID0gdGltZVN0cmluZztcclxuICAgICAgICAgICAgICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0L/RgNC+0LPRgNC10YHRgSDQtdGB0LvQuCDQtdGB0YLRjCDQtNCw0L3QvdGL0LVcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zZnRwUHJvZ3Jlc3MudG90YWwgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU2Z0cFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZUVsZW1lbnQudGV4dENvbnRlbnQgPSBgWyR7dGltZVN0cmluZ31dYDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0YWdlID09PSAnbWFpbkJ1aWxkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDQstGA0LXQvNGPINC00LvRjyDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFpbkJ1aWxkQ3VycmVudFRpbWUgPSB0aW1lU3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQv9GA0L7Qs9GA0LXRgdGBINC10YHQu9C4INC10YHRgtGMINC00LDQvdC90YvQtVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTWFpbkJ1aWxkUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lRWxlbWVudC50ZXh0Q29udGVudCA9IGBbJHt0aW1lU3RyaW5nfV1gO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT09ICdzdXBlckh0bWxCdWlsZCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0LLRgNC10LzRjyDQtNC70Y8gU3VwZXJIVE1MINCx0LjQu9C00LBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN1cGVySHRtbEN1cnJlbnRUaW1lID0gdGltZVN0cmluZztcclxuICAgICAgICAgICAgICAgICAgICB0aW1lRWxlbWVudC50ZXh0Q29udGVudCA9IGBbJHt0aW1lU3RyaW5nfV1gO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSwgMTAwMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntGB0YLQsNC90L7QstC60LAg0L7QsdC90L7QstC70LXQvdC40Y8g0LLRgNC10LzQtdC90Lgg0LIg0YDQtdCw0LvRjNC90L7QvCDQstGA0LXQvNC10L3QuFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0b3BQcm9ncmVzc1RpbWVVcGRhdGUoc3RhZ2U6ICdtYWluQnVpbGQnIHwgJ3N1cGVySHRtbEJ1aWxkJyB8ICdzZnRwTG9hZCcpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNbc3RhZ2VdKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNbc3RhZ2VdKTtcclxuICAgICAgICAgICAgdGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNbc3RhZ2VdID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YfQuNGB0YLQutCwINCy0YHQtdGFINC40L3RgtC10YDQstCw0LvQvtCyINCy0YDQtdC80LXQvdC4XHJcbiAgICAgKi9cclxuICAgIGNsZWFyQWxsUHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzKCk6IHZvaWQge1xyXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzKS5mb3JFYWNoKHN0YWdlID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzW3N0YWdlIGFzIGtleW9mIHR5cGVvZiB0aGlzLnByb2dyZXNzVGltZUludGVydmFsc10pIHtcclxuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5wcm9ncmVzc1RpbWVJbnRlcnZhbHNbc3RhZ2UgYXMga2V5b2YgdHlwZW9mIHRoaXMucHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLnByb2dyZXNzVGltZUludGVydmFscyA9IHt9O1xyXG5cclxuICAgICAgICAvLyDQntGH0LjRidCw0LXQvCDQsNC90LjQvNCw0YbQuNGOINC/0YDQvtCz0YDQtdGB0YHQsCBTdXBlckhUTUxcclxuICAgICAgICBpZiAodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwpO1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INCw0L3QuNC80LDRhtC40Y4g0L/RgNC+0LPRgNC10YHRgdCwIFNGVFBcclxuICAgICAgICBpZiAodGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwpIHtcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INC80L7QvdC40YLQvtGA0LjQvdCzINC30LDRgdGC0YDRj9Cy0YjQtdCz0L4g0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICAgICAgdGhpcy5zdG9wU3R1Y2tQcm9ncmVzc01vbml0b3JpbmcoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCh0LHRgNC+0YEg0LLRgdC10YUg0L/RgNC+0LPRgNC10YHRgdC+0LJcclxuICAgICAqL1xyXG4gICAgcmVzZXRBbGxQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCBTRlRQINC/0YDQvtCz0YDQtdGB0YFcclxuICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcyA9IHsgY3VycmVudDogMCwgdG90YWw6IDAsIHBlcmNlbnRhZ2U6IDAsIGV0YTogMCwgY3VycmVudFRhc2s6ICcnIH07XHJcbiAgICAgICAgdGhpcy5zZnRwQ3VycmVudFRpbWUgPSAnMNGBJztcclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAgU0ZUUFxyXG4gICAgICAgIGNvbnN0IHNmdHBTZWN0aW9uID0gdGhpcy51aUVsZW1lbnRzLnNmdHBTZWN0aW9uO1xyXG4gICAgICAgIGlmIChzZnRwU2VjdGlvbikge1xyXG4gICAgICAgICAgICBzZnRwU2VjdGlvbi5jbGFzc0xpc3QucmVtb3ZlKCdwcm9ncmVzcy1wZW5kaW5nJywgJ3Byb2dyZXNzLWFjdGl2ZScsICdwcm9ncmVzcy1jb21wbGV0ZWQnLCAncHJvZ3Jlc3Mtc2tpcHBlZCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgSDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICAgICAgdGhpcy5tYWluQnVpbGRDdXJyZW50VGltZSA9ICcw0YEnO1xyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICAgIGNvbnN0IG1haW5CdWlsZFNlY3Rpb24gPSB0aGlzLnVpRWxlbWVudHMubWFpbkJ1aWxkU2VjdGlvbjtcclxuICAgICAgICBpZiAobWFpbkJ1aWxkU2VjdGlvbikge1xyXG4gICAgICAgICAgICBtYWluQnVpbGRTZWN0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ3Byb2dyZXNzLXBlbmRpbmcnLCAncHJvZ3Jlc3MtYWN0aXZlJywgJ3Byb2dyZXNzLWNvbXBsZXRlZCcsICdwcm9ncmVzcy1za2lwcGVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntGB0YLQsNC90LDQstC70LjQstCw0LXQvCDQsNC90LjQvNCw0YbQuNGOINC/0YDQvtCz0YDQtdGB0YHQsCBTdXBlckhUTUxcclxuICAgICAgICBpZiAodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwpO1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INCw0L3QuNC80LDRhtC40Y4g0L/RgNC+0LPRgNC10YHRgdCwIFNGVFBcclxuICAgICAgICBpZiAodGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwpIHtcclxuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEgU3VwZXJIVE1MINCx0LjQu9C00LBcclxuICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzID0geyBwZXJjZW50YWdlOiAwLCBjdXJyZW50VGFzazogJycsIGV0YTogMCB9O1xyXG4gICAgICAgIHRoaXMuc3VwZXJIdG1sQ3VycmVudFRpbWUgPSAnMNGBJztcclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAgU3VwZXJIVE1MINCx0LjQu9C00LBcclxuICAgICAgICBjb25zdCBzdXBlcmh0bWxTZWN0aW9uID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFNlY3Rpb247XHJcbiAgICAgICAgaWYgKHN1cGVyaHRtbFNlY3Rpb24pIHtcclxuICAgICAgICAgICAgc3VwZXJodG1sU2VjdGlvbi5jbGFzc0xpc3QucmVtb3ZlKCdwcm9ncmVzcy1wZW5kaW5nJywgJ3Byb2dyZXNzLWFjdGl2ZScsICdwcm9ncmVzcy1jb21wbGV0ZWQnLCAncHJvZ3Jlc3Mtc2tpcHBlZCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0LLRgNC10LzRjyDQsiDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgNCw0YVcclxuICAgICAgICBjb25zdCB0aW1lRWxlbWVudHMgPSBbXHJcbiAgICAgICAgICAgIHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRUaW1lLFxyXG4gICAgICAgICAgICB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sVGltZSxcclxuICAgICAgICAgICAgdGhpcy51aUVsZW1lbnRzLnNmdHBUaW1lXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgdGltZUVsZW1lbnRzLmZvckVhY2godGltZUVsZW1lbnQgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGltZUVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIHRpbWVFbGVtZW50LnRleHRDb250ZW50ID0gJ1swc10nO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INGB0L/QuNGB0L7QuiDRgdC+0LHRgNCw0L3QvdGL0YUg0YTQsNC50LvQvtCyXHJcbiAgICAgICAgdGhpcy5jbGVhckJ1aWx0RmlsZXMoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCh0LHRgNC+0YEg0YLQvtC70YzQutC+INC/0YDQvtCz0YDQtdGB0YHQsCAo0LHQtdC3INC+0YfQuNGB0YLQutC4INC00LDQvdC90YvRhSDQviDRhNCw0LnQu9Cw0YUpXHJcbiAgICAgKi9cclxuICAgIHJlc2V0UHJvZ3Jlc3NPbmx5KCk6IHZvaWQge1xyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8IFNGVFAg0L/RgNC+0LPRgNC10YHRgVxyXG4gICAgICAgIHRoaXMuc2Z0cFByb2dyZXNzID0geyBjdXJyZW50OiAwLCB0b3RhbDogMCwgcGVyY2VudGFnZTogMCwgZXRhOiAwLCBjdXJyZW50VGFzazogJycgfTtcclxuICAgICAgICB0aGlzLnNmdHBDdXJyZW50VGltZSA9ICcw0YEnO1xyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCBTRlRQXHJcbiAgICAgICAgY29uc3Qgc2Z0cFNlY3Rpb24gPSB0aGlzLnVpRWxlbWVudHMuc2Z0cFNlY3Rpb247XHJcbiAgICAgICAgaWYgKHNmdHBTZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHNmdHBTZWN0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ3Byb2dyZXNzLXBlbmRpbmcnLCAncHJvZ3Jlc3MtYWN0aXZlJywgJ3Byb2dyZXNzLWNvbXBsZXRlZCcsICdwcm9ncmVzcy1za2lwcGVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcyA9IHsgcGVyY2VudGFnZTogMCwgY3VycmVudFRhc2s6ICcnLCBldGE6IDAgfTtcclxuICAgICAgICB0aGlzLm1haW5CdWlsZEN1cnJlbnRUaW1lID0gJzDRgSc7XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGAINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgICAgY29uc3QgbWFpbkJ1aWxkU2VjdGlvbiA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRTZWN0aW9uO1xyXG4gICAgICAgIGlmIChtYWluQnVpbGRTZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIG1haW5CdWlsZFNlY3Rpb24uY2xhc3NMaXN0LnJlbW92ZSgncHJvZ3Jlc3MtcGVuZGluZycsICdwcm9ncmVzcy1hY3RpdmUnLCAncHJvZ3Jlc3MtY29tcGxldGVkJywgJ3Byb2dyZXNzLXNraXBwZWQnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INCw0L3QuNC80LDRhtC40Y4g0L/RgNC+0LPRgNC10YHRgdCwIFN1cGVySFRNTFxyXG4gICAgICAgIGlmICh0aGlzLnN1cGVySHRtbEFuaW1hdGlvbkludGVydmFsKSB7XHJcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zdXBlckh0bWxBbmltYXRpb25JbnRlcnZhbCk7XHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7RgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0LDQvdC40LzQsNGG0LjRjiDQv9GA0L7Qs9GA0LXRgdGB0LAgU0ZUUFxyXG4gICAgICAgIGlmICh0aGlzLnNmdHBBbmltYXRpb25JbnRlcnZhbCkge1xyXG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc2Z0cEFuaW1hdGlvbkludGVydmFsKTtcclxuICAgICAgICAgICAgdGhpcy5zZnRwQW5pbWF0aW9uSW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgSBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICAgICAgdGhpcy5zdXBlckh0bWxDdXJyZW50VGltZSA9ICcw0YEnO1xyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICAgIGNvbnN0IHN1cGVyaHRtbFNlY3Rpb24gPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sU2VjdGlvbjtcclxuICAgICAgICBpZiAoc3VwZXJodG1sU2VjdGlvbikge1xyXG4gICAgICAgICAgICBzdXBlcmh0bWxTZWN0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ3Byb2dyZXNzLXBlbmRpbmcnLCAncHJvZ3Jlc3MtYWN0aXZlJywgJ3Byb2dyZXNzLWNvbXBsZXRlZCcsICdwcm9ncmVzcy1za2lwcGVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQstGA0LXQvNGPINCyINC/0YDQvtCz0YDQtdGB0YEt0LHQsNGA0LDRhVxyXG4gICAgICAgIGNvbnN0IHRpbWVFbGVtZW50cyA9IFtcclxuICAgICAgICAgICAgdGhpcy51aUVsZW1lbnRzLm1haW5CdWlsZFRpbWUsXHJcbiAgICAgICAgICAgIHRoaXMudWlFbGVtZW50cy5zdXBlcmh0bWxUaW1lLFxyXG4gICAgICAgICAgICB0aGlzLnVpRWxlbWVudHMuc2Z0cFRpbWVcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICB0aW1lRWxlbWVudHMuZm9yRWFjaCh0aW1lRWxlbWVudCA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aW1lRWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgdGltZUVsZW1lbnQudGV4dENvbnRlbnQgPSAnWzBzXSc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8g0J3QlSDQvtGH0LjRidCw0LXQvCDRgdC/0LjRgdC+0Log0YHQvtCx0YDQsNC90L3Ri9GFINGE0LDQudC70L7QsiAtINC+0L3QuCDQtNC+0LvQttC90Ysg0YHQvtGF0YDQsNC90Y/RgtGM0YHRjyDQvNC10LbQtNGDINGB0LHQvtGA0LrQsNC80LhcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0LLRgNC10LzQtdC90Lgg0Y3RgtCw0L/QvtCyXHJcbiAgICAgKi9cclxuICAgIGdldFN0YWdlVGltaW5ncygpOiBTdGFnZVRpbWluZ3Mge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnN0YWdlVGltaW5ncztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQtdC90LjQtSDQtNCw0L3QvdGL0YUg0L4g0L/RgNC+0LPRgNC10YHRgdC1INC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgKi9cclxuICAgIGdldE1haW5CdWlsZFByb2dyZXNzKCk6IFByb2dyZXNzRGF0YSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3M7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LvRg9GH0LXQvdC40LUg0LTQsNC90L3Ri9GFINC+INC/0YDQvtCz0YDQtdGB0YHQtSBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICovXHJcbiAgICBnZXRTdXBlckh0bWxQcm9ncmVzcygpOiBQcm9ncmVzc0RhdGEge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnN1cGVySHRtbFByb2dyZXNzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviDQv9GA0L7Qs9GA0LXRgdGB0LUgU0ZUUFxyXG4gICAgICovXHJcbiAgICBnZXRTZnRwUHJvZ3Jlc3MoKTogU2Z0cFByb2dyZXNzRGF0YSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Z0cFByb2dyZXNzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC70YPRh9C10L3QuNC1INC00LDQvdC90YvRhSDQviBjbGVhbi1pbmZvIFNGVFBcclxuICAgICAqL1xyXG4gICAgZ2V0U2Z0cENsZWFuSW5mbygpOiBTZnRwQ2xlYW5JbmZvIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZnRwQ2xlYW5JbmZvO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7Rh9C40YHRgtC60LAg0LTQsNC90L3Ri9GFINC+IGNsZWFuLWluZm8gU0ZUUFxyXG4gICAgICovXHJcbiAgICBjbGVhclNmdHBDbGVhbkluZm8oKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5zZnRwQ2xlYW5JbmZvID0geyBwYXRoOiAnJywgdG90YWxJdGVtczogMCwgaXRlbXM6IFtdIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QvtC1INC30LDQstC10YDRiNC10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsFxyXG4gICAgICovXHJcbiAgICBmb3JjZUNvbXBsZXRlTWFpbkJ1aWxkKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLm1haW5CdWlsZFByb2dyZXNzLnBlcmNlbnRhZ2UgPCAxMDApIHtcclxuICAgICAgICAgICAgdGhpcy5tYWluQnVpbGRQcm9ncmVzcy5wZXJjZW50YWdlID0gMTAwO1xyXG4gICAgICAgICAgICB0aGlzLm1haW5CdWlsZFByb2dyZXNzLmN1cnJlbnRUYXNrID0gJ9CX0LDQstC10YDRiNC10L3Qvic7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlTWFpbkJ1aWxkUHJvZ3Jlc3MoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCh0LrRgNGL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAg0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRj1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0U2VjdGlvblN0YXRlKCdtYWluQnVpbGQnKTtcclxuICAgICAgICB9LCAyMDAwKTsgLy8g0JTQsNC10Lwg0LLRgNC10LzRjyDQv9C+0LrQsNC30LDRgtGMINC30LDQstC10YDRiNC10L3QvdC+0LUg0YHQvtGB0YLQvtGP0L3QuNC1XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QvtC1INC30LDQstC10YDRiNC10L3QuNC1INC/0YDQvtCz0YDQtdGB0YHQsCBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICovXHJcbiAgICBmb3JjZUNvbXBsZXRlU3VwZXJIdG1sQnVpbGQoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZSA8IDEwMCkge1xyXG4gICAgICAgICAgICB0aGlzLnN1cGVySHRtbFByb2dyZXNzLnBlcmNlbnRhZ2UgPSAxMDA7XHJcbiAgICAgICAgICAgIHRoaXMuc3VwZXJIdG1sUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSAn0JfQsNCy0LXRgNGI0LXQvdC+JztcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTdXBlckh0bWxQcm9ncmVzcygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQutGA0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCDQv9C+0YHQu9C1INC30LDQstC10YDRiNC10L3QuNGPXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucmVzZXRTZWN0aW9uU3RhdGUoJ3N1cGVySHRtbCcpO1xyXG4gICAgICAgIH0sIDIwMDApOyAvLyDQlNCw0LXQvCDQstGA0LXQvNGPINC/0L7QutCw0LfQsNGC0Ywg0LfQsNCy0LXRgNGI0LXQvdC90L7QtSDRgdC+0YHRgtC+0Y/QvdC40LVcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0YDQuNC90YPQtNC40YLQtdC70YzQvdC+0LUg0LfQsNCy0LXRgNGI0LXQvdC40LUg0L/RgNC+0LPRgNC10YHRgdCwIFNGVFBcclxuICAgICAqL1xyXG4gICAgZm9yY2VDb21wbGV0ZVNmdHBQcm9ncmVzcygpOiB2b2lkIHtcclxuICAgICAgICBpZiAodGhpcy5zZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSA8IDEwMCkge1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcy5wZXJjZW50YWdlID0gMTAwO1xyXG4gICAgICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcy5jdXJyZW50VGFzayA9ICfQl9Cw0LLQtdGA0YjQtdC90L4nO1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNmdHBQcm9ncmVzcygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHQutGA0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgCDQv9C+0YHQu9C1INC30LDQstC10YDRiNC10L3QuNGPXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucmVzZXRTZWN0aW9uU3RhdGUoJ3NmdHAnKTtcclxuICAgICAgICB9LCAyMDAwKTsgLy8g0JTQsNC10Lwg0LLRgNC10LzRjyDQv9C+0LrQsNC30LDRgtGMINC30LDQstC10YDRiNC10L3QvdC+0LUg0YHQvtGB0YLQvtGP0L3QuNC1XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQl9Cw0L/Rg9GB0Log0LzQvtC90LjRgtC+0YDQuNC90LPQsCDQt9Cw0YHRgtGA0Y/QstGI0LXQs9C+INC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICovXHJcbiAgICBzdGFydFN0dWNrUHJvZ3Jlc3NNb25pdG9yaW5nKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMubGFzdFByb2dyZXNzVXBkYXRlID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3R1Y2tQcm9ncmVzc1RpbWVvdXQpIHtcclxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3R1Y2tQcm9ncmVzc1RpbWVvdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zdHVja1Byb2dyZXNzVGltZW91dCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgY29uc3QgdGltZVNpbmNlTGFzdFVwZGF0ZSA9IG5vdyAtIHRoaXMubGFzdFByb2dyZXNzVXBkYXRlO1xyXG5cclxuICAgICAgICAgICAgLy8g0JXRgdC70Lgg0L/RgNC+0LPRgNC10YHRgSDQvdC1INC+0LHQvdC+0LLQu9GP0LvRgdGPINCx0L7Qu9C10LUgMzAg0YHQtdC60YPQvdC0INC4INC+0L0g0LHQvtC70YzRiNC1IDAsINC/0YDQuNC90YPQtNC40YLQtdC70YzQvdC+INC30LDQstC10YDRiNCw0LXQvFxyXG4gICAgICAgICAgICBpZiAodGltZVNpbmNlTGFzdFVwZGF0ZSA+IDMwMDAwICYmIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MucGVyY2VudGFnZSA+IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZm9yY2VDb21wbGV0ZU1haW5CdWlsZCgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdG9wU3R1Y2tQcm9ncmVzc01vbml0b3JpbmcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIDUwMDApOyAvLyDQn9GA0L7QstC10YDRj9C10Lwg0LrQsNC20LTRi9C1IDUg0YHQtdC60YPQvdC0XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntGB0YLQsNC90L7QstC60LAg0LzQvtC90LjRgtC+0YDQuNC90LPQsCDQt9Cw0YHRgtGA0Y/QstGI0LXQs9C+INC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICovXHJcbiAgICBzdG9wU3R1Y2tQcm9ncmVzc01vbml0b3JpbmcoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3R1Y2tQcm9ncmVzc1RpbWVvdXQpIHtcclxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3R1Y2tQcm9ncmVzc1RpbWVvdXQpO1xyXG4gICAgICAgICAgICB0aGlzLnN0dWNrUHJvZ3Jlc3NUaW1lb3V0ID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntCx0L3QvtCy0LvQtdC90LjQtSDQstGA0LXQvNC10L3QuCDQv9C+0YHQu9C10LTQvdC10LPQviDQvtCx0L3QvtCy0LvQtdC90LjRjyDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAqL1xyXG4gICAgdXBkYXRlTGFzdFByb2dyZXNzVGltZSgpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmxhc3RQcm9ncmVzc1VwZGF0ZSA9IERhdGUubm93KCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQodCx0YDQvtGBINCy0YHQtdGFINGB0L7RgdGC0L7Rj9C90LjQuSDRgdC10LrRhtC40Lkg0Log0L3QsNGH0LDQu9GM0L3QvtC80YMg0YHQvtGB0YLQvtGP0L3QuNGOXHJcbiAgICAgKi9cclxuICAgIHJlc2V0QWxsU2VjdGlvbnMoKTogdm9pZCB7XHJcbiAgICAgICAgLy8g0KHQsdGA0LDRgdGL0LLQsNC10Lwg0LTQsNC90L3Ri9C1INC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICAgIHRoaXMubWFpbkJ1aWxkUHJvZ3Jlc3MgPSB7IHBlcmNlbnRhZ2U6IDAsIGN1cnJlbnRUYXNrOiAnJywgZXRhOiAwIH07XHJcbiAgICAgICAgdGhpcy5zdXBlckh0bWxQcm9ncmVzcyA9IHsgcGVyY2VudGFnZTogMCwgY3VycmVudFRhc2s6ICcnLCBldGE6IDAgfTtcclxuICAgICAgICB0aGlzLnNmdHBQcm9ncmVzcyA9IHsgY3VycmVudDogMCwgdG90YWw6IDAsIHBlcmNlbnRhZ2U6IDAsIGV0YTogMCwgY3VycmVudFRhc2s6ICcnIH07XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INCy0YDQtdC80Y9cclxuICAgICAgICB0aGlzLm1haW5CdWlsZEN1cnJlbnRUaW1lID0gJzDRgSc7XHJcbiAgICAgICAgdGhpcy5zdXBlckh0bWxDdXJyZW50VGltZSA9ICcw0YEnO1xyXG4gICAgICAgIHRoaXMuc2Z0cEN1cnJlbnRUaW1lID0gJzDRgSc7XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INGB0L7RgdGC0L7Rj9C90LjRjyDRgdC10LrRhtC40LlcclxuICAgICAgICB0aGlzLnJlc2V0U2VjdGlvblN0YXRlKCdtYWluQnVpbGQnKTtcclxuICAgICAgICB0aGlzLnJlc2V0U2VjdGlvblN0YXRlKCdzdXBlckh0bWwnKTtcclxuICAgICAgICB0aGlzLnJlc2V0U2VjdGlvblN0YXRlKCdzZnRwJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LrQsNC3INC/0YDQvtCz0YDQtdGB0YEt0LHQsNGA0LAg0LTQu9GPINC60L7QvdC60YDQtdGC0L3QvtC5INGB0LXQutGG0LjQuFxyXG4gICAgICovXHJcbiAgICBzaG93U2VjdGlvblByb2dyZXNzKHNlY3Rpb246ICdtYWluQnVpbGQnIHwgJ3N1cGVySHRtbCcgfCAnc2Z0cCcpOiB2b2lkIHtcclxuICAgICAgICBsZXQgc2VjdGlvbkVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIGxldCBwcm9ncmVzc0VsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xyXG4gICAgICAgIGxldCBzdGF0dXNFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICAgICAgc3dpdGNoIChzZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ21haW5CdWlsZCc6XHJcbiAgICAgICAgICAgICAgICBzZWN0aW9uRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRTZWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLm1haW5CdWlsZFByb2dyZXNzO1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRTdGF0dXM7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnc3VwZXJIdG1sJzpcclxuICAgICAgICAgICAgICAgIHNlY3Rpb25FbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFNlY3Rpb247XHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc0VsZW1lbnQgPSB0aGlzLnVpRWxlbWVudHMuc3VwZXJodG1sUHJvZ3Jlc3M7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXNFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFN0YXR1cztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdzZnRwJzpcclxuICAgICAgICAgICAgICAgIHNlY3Rpb25FbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnNmdHBTZWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnNmdHBQcm9ncmVzcztcclxuICAgICAgICAgICAgICAgIHN0YXR1c0VsZW1lbnQgPSB0aGlzLnVpRWxlbWVudHMuc2Z0cFN0YXR1cztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KPRgdGC0LDQvdCw0LLQu9C40LLQsNC10Lwg0YHQvtGB0YLQvtGP0L3QuNC1IFwi0L7QttC40LTQsNC90LjQtVwiINC00LvRjyDRgdC10LrRhtC40LhcclxuICAgICAgICBpZiAoc2VjdGlvbkVsZW1lbnQpIHtcclxuICAgICAgICAgICAgc2VjdGlvbkVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgncHJvZ3Jlc3MtcGVuZGluZycsICdwcm9ncmVzcy1hY3RpdmUnLCAncHJvZ3Jlc3MtY29tcGxldGVkJywgJ3Byb2dyZXNzLXNraXBwZWQnKTtcclxuICAgICAgICAgICAgc2VjdGlvbkVsZW1lbnQuY2xhc3NMaXN0LmFkZCgncHJvZ3Jlc3MtcGVuZGluZycpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwg0LjQvdC00LjQutCw0YLQvtGAINC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICAgIGlmIChwcm9ncmVzc0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICBwcm9ncmVzc0VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgncGVuZGluZycsICdhY3RpdmUnLCAnY29tcGxldGVkJywgJ3NraXBwZWQnKTtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3BlbmRpbmcnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCj0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INGB0YLQsNGC0YPRgSDQvtC20LjQtNCw0L3QuNGPXHJcbiAgICAgICAgaWYgKHN0YXR1c0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgc3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9ICfij7MnO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCh0LHRgNC+0YEg0YHQvtGB0YLQvtGP0L3QuNGPINC60L7QvdC60YDQtdGC0L3QvtC5INGB0LXQutGG0LjQuFxyXG4gICAgICovXHJcbiAgICByZXNldFNlY3Rpb25TdGF0ZShzZWN0aW9uOiAnbWFpbkJ1aWxkJyB8ICdzdXBlckh0bWwnIHwgJ3NmdHAnKTogdm9pZCB7XHJcbiAgICAgICAgbGV0IHNlY3Rpb25FbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcclxuICAgICAgICBsZXQgcHJvZ3Jlc3NFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcclxuICAgICAgICBsZXQgc3RhdHVzRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoc2VjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICdtYWluQnVpbGQnOlxyXG4gICAgICAgICAgICAgICAgc2VjdGlvbkVsZW1lbnQgPSB0aGlzLnVpRWxlbWVudHMubWFpbkJ1aWxkU2VjdGlvbjtcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5tYWluQnVpbGRQcm9ncmVzcztcclxuICAgICAgICAgICAgICAgIHN0YXR1c0VsZW1lbnQgPSB0aGlzLnVpRWxlbWVudHMubWFpbkJ1aWxkU3RhdHVzO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgJ3N1cGVySHRtbCc6XHJcbiAgICAgICAgICAgICAgICBzZWN0aW9uRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5zdXBlcmh0bWxTZWN0aW9uO1xyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnN1cGVyaHRtbFByb2dyZXNzO1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5zdXBlcmh0bWxTdGF0dXM7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnc2Z0cCc6XHJcbiAgICAgICAgICAgICAgICBzZWN0aW9uRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5zZnRwU2VjdGlvbjtcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudCA9IHRoaXMudWlFbGVtZW50cy5zZnRwUHJvZ3Jlc3M7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXNFbGVtZW50ID0gdGhpcy51aUVsZW1lbnRzLnNmdHBTdGF0dXM7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCh0LHRgNCw0YHRi9Cy0LDQtdC8INC60LvQsNGB0YHRiyDRgdC+0YHRgtC+0Y/QvdC40Lkg0YHQtdC60YbQuNC4XHJcbiAgICAgICAgaWYgKHNlY3Rpb25FbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHNlY3Rpb25FbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3Byb2dyZXNzLXBlbmRpbmcnLCAncHJvZ3Jlc3MtYWN0aXZlJywgJ3Byb2dyZXNzLWNvbXBsZXRlZCcsICdwcm9ncmVzcy1za2lwcGVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodC60YDRi9Cy0LDQtdC8INC40L3QtNC40LrQsNGC0L7RgCDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAgICBpZiAocHJvZ3Jlc3NFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgcHJvZ3Jlc3NFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ3BlbmRpbmcnLCAnYWN0aXZlJywgJ2NvbXBsZXRlZCcsICdza2lwcGVkJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDRgdGC0LDRgtGD0YFcclxuICAgICAgICBpZiAoc3RhdHVzRWxlbWVudCkge1xyXG4gICAgICAgICAgICBzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gJ+KPsyc7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC70YPRh9C10L3QuNC1INGB0L/QuNGB0LrQsCDRgdC+0LHRgNCw0L3QvdGL0YUg0YTQsNC50LvQvtCyXHJcbiAgICAgKi9cclxuICAgIGdldEJ1aWx0RmlsZXMoKTogQnVpbHRGaWxlSW5mb1tdIHtcclxuICAgICAgICByZXR1cm4gWy4uLnRoaXMuYnVpbHRGaWxlc107XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntGH0LjRgdGC0LrQsCDRgdC/0LjRgdC60LAg0YHQvtCx0YDQsNC90L3Ri9GFINGE0LDQudC70L7QslxyXG4gICAgICovXHJcbiAgICBjbGVhckJ1aWx0RmlsZXMoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5idWlsdEZpbGVzID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LvRg9GH0LXQvdC40LUg0LzQsNC60YHQuNC80LDQu9GM0L3QvtCz0L4g0YDQsNC30LzQtdGA0LAg0YTQsNC50LvQsFxyXG4gICAgICovXHJcbiAgICBnZXRNYXhGaWxlU2l6ZSgpOiB7IHNpemVLQjogbnVtYmVyOyBmaWxlTmFtZTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgICAgICBpZiAodGhpcy5idWlsdEZpbGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCk0LjQu9GM0YLRgNGD0LXQvCDRhNCw0LnQu9GLINGBINC40LfQstC10YHRgtC90YvQvCDRgNCw0LfQvNC10YDQvtC8ICjQsdC+0LvRjNGI0LUgMClcclxuICAgICAgICBjb25zdCBmaWxlc1dpdGhTaXplID0gdGhpcy5idWlsdEZpbGVzLmZpbHRlcihmaWxlID0+IGZpbGUuc2l6ZUtCID4gMCk7XHJcblxyXG4gICAgICAgIGlmIChmaWxlc1dpdGhTaXplLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAvLyDQldGB0LvQuCDQvdC10YIg0YTQsNC50LvQvtCyINGBINC40LfQstC10YHRgtC90YvQvCDRgNCw0LfQvNC10YDQvtC8LCDQstC+0LfQstGA0LDRidCw0LXQvCDQv9C10YDQstGL0Lkg0YTQsNC50LtcclxuICAgICAgICAgICAgY29uc3QgZmlyc3RGaWxlID0gdGhpcy5idWlsdEZpbGVzWzBdO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc2l6ZUtCOiBmaXJzdEZpbGUuc2l6ZUtCLFxyXG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGZpcnN0RmlsZS5maWxlTmFtZSB8fCBgJHtmaXJzdEZpbGUudmVyc2lvbk5hbWV9XyR7Zmlyc3RGaWxlLmxhbmdDb2RlfS5odG1sYFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgbWF4RmlsZSA9IGZpbGVzV2l0aFNpemUucmVkdWNlKChtYXgsIGZpbGUpID0+XHJcbiAgICAgICAgICAgIGZpbGUuc2l6ZUtCID4gbWF4LnNpemVLQiA/IGZpbGUgOiBtYXhcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzaXplS0I6IG1heEZpbGUuc2l6ZUtCLFxyXG4gICAgICAgICAgICBmaWxlTmFtZTogbWF4RmlsZS5maWxlTmFtZSB8fCBgJHttYXhGaWxlLnZlcnNpb25OYW1lfV8ke21heEZpbGUubGFuZ0NvZGV9Lmh0bWxgXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxufVxyXG4iXX0=