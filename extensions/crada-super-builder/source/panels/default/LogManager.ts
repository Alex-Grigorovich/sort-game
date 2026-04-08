/**
 * Модуль для управления логами и их форматированием
 */
export class LogManager {
    private logContent: HTMLElement | null = null;
    private logSummaryText: HTMLElement | null = null;

    constructor(logContent: HTMLElement | null, logSummaryText: HTMLElement | null) {
        this.logContent = logContent;
        this.logSummaryText = logSummaryText;
    }

    /**
     * Добавляет лог в интерфейс
     */
    appendLog(msg: string, type?: 'error' | 'warn' | 'success') {
        if (!this.logContent || !this.logSummaryText) return;

        // Фильтруем логи - показываем только важные сообщения
        if (this.shouldShowLog(msg)) {
            const line = document.createElement('div');

            // Форматируем сообщение для лучшего отображения
            const formattedMsg = this.formatLogMessage(msg);
            line.textContent = formattedMsg;

            // Определяем тип сообщения по содержимому
            const messageType = this.determineLogType(msg, type);
            if (messageType === 'error') line.classList.add('log-error');
            else if (messageType === 'warn') line.classList.add('log-warn');
            else if (messageType === 'success') line.classList.add('log-success');
            else if (messageType === 'info') line.classList.add('log-info');

            this.logContent.appendChild(line);
            line.classList.add('fade-in');
        }

        // Обновляем превью только для важных сообщений
        if (this.shouldShowLog(msg)) {
            const preview = msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
            this.logSummaryText.textContent = preview;
        }
        this.logContent.scrollTo({ top: this.logContent.scrollHeight, behavior: 'smooth' });
    }

    /**
     * Очищает все логи
     */
    clearLogs() {
        if (!this.logContent || !this.logSummaryText) return;

        this.logContent.classList.add('fade-out');
        setTimeout(() => {
            this.logContent!.innerHTML = '';
            this.logSummaryText!.textContent = 'Logs';
            this.logContent!.classList.remove('fade-out');
        }, 300);
    }

    /**
     * Определяет, нужно ли показывать лог в интерфейсе
     */
    private shouldShowLog(msg: string): boolean {
        // Показываем структурированные логи с ключами
        if (msg.includes('[SUPERHTML_') || msg.includes('[SFTP_') || msg.includes('[MAINBUILD_')) {
            return true;
        }

        // Показываем важные сообщения
        if (msg.includes('error') || msg.includes('Error') || msg.includes('ERROR')) {
            return true;
        }

        if (msg.includes('success') || msg.includes('Success') || msg.includes('SUCCESS')) {
            return true;
        }

        if (msg.includes('warning') || msg.includes('Warning') || msg.includes('WARNING')) {
            return true;
        }

        // Показываем сообщения о завершении этапов
        if (msg.includes('completed') || msg.includes('finished') || msg.includes('завершен')) {
            return true;
        }

        // Скрываем технические сообщения
        if (msg.includes('debug:') || msg.includes('verbose:') || msg.includes('trace:')) {
            return false;
        }

        // Скрываем сообщения о загрузке модулей
        if (msg.includes('Loading') || msg.includes('loading') || msg.includes('require(')) {
            return false;
        }

        // Скрываем сообщения о временных файлах
        if (msg.includes('temp') || msg.includes('tmp') || msg.includes('.cache')) {
            return false;
        }

        return true;
    }

    /**
     * Форматирует сообщение лога для лучшего отображения
     */
    private formatLogMessage(msg: string): string {
        // Убираем временные метки и лишние пробелы
        let formatted = msg.trim();

        // Форматируем структурированные логи
        if (formatted.includes('[SUPERHTML_PROGRESS]')) {
            const match = formatted.match(/\[SUPERHTML_PROGRESS\] (\d+)% (.+)/);
            if (match) {
                return `[${match[1]}%] ${match[2]}`;
            }
        }

        if (formatted.includes('[SUPERHTML_SUCCESS]')) {
            const match = formatted.match(/\[SUPERHTML_SUCCESS\] (.+)/);
            if (match) {
                return `✓ ${match[1]}`;
            }
        }

        if (formatted.includes('[SUPERHTML_ERROR]')) {
            const match = formatted.match(/\[SUPERHTML_ERROR\] (.+)/);
            if (match) {
                return `✗ ${match[1]}`;
            }
        }

        if (formatted.includes('[SUPERHTML_STAGE]')) {
            const match = formatted.match(/\[SUPERHTML_STAGE\] (.+) completed/);
            if (match) {
                return `→ ${match[1]} завершен`;
            }
        }

        if (formatted.includes('[SUPERHTML_INFO]')) {
            const match = formatted.match(/\[SUPERHTML_INFO\] (.+)/);
            if (match) {
                return `ℹ ${match[1]}`;
            }
        }

        // Убираем эмодзи и лишние символы из обычных сообщений
        formatted = formatted.replace(/[⏳🎉✅❌⚠️📦🕓]/g, '');
        formatted = formatted.replace(/\s+/g, ' ').trim();

        return formatted;
    }

    /**
     * Определяет тип сообщения лога
     */
    private determineLogType(msg: string, providedType?: 'error' | 'warn' | 'success'): 'error' | 'warn' | 'success' | 'info' {
        if (providedType) return providedType;

        if (msg.includes('[SUPERHTML_ERROR]') || msg.includes('error') || msg.includes('Error')) {
            return 'error';
        }

        if (msg.includes('[SUPERHTML_SUCCESS]') || msg.includes('success') || msg.includes('completed')) {
            return 'success';
        }

        if (msg.includes('warning') || msg.includes('Warning') || msg.includes('warn')) {
            return 'warn';
        }

        if (msg.includes('[SUPERHTML_INFO]') || msg.includes('[SUPERHTML_PROGRESS]')) {
            return 'info';
        }

        return 'info';
    }

    /**
     * Парсит URL из логов
     */
    parseUrlsFromLog(msg: string): { infoUrl?: string; infoQaUrl?: string } {
        const result: { infoUrl?: string; infoQaUrl?: string } = {};

        // Регулярное выражение для поиска URL info.html (с учетом ANSI escape-кодов)
        const infoUrlMatch = msg.match(/INFO:[\s\S]*?https:\/\/[^\s\[\]]+info\.html/);
        if (infoUrlMatch) {
            // Удаляем ANSI escape-коды и лишние символы
            result.infoUrl = infoUrlMatch[0]
                .replace(/INFO:\s*/, '')
                .replace(/\x1b\[[0-9;]*m/g, '') // Удаляем ANSI escape-коды
                .trim();
        }

        // Регулярное выражение для поиска URL info-qa.html (с учетом ANSI escape-кодов)
        const infoQaUrlMatch = msg.match(/INFO QA:[\s\S]*?https:\/\/[^\s\[\]]+info-qa\.html/);
        if (infoQaUrlMatch) {
            // Удаляем ANSI escape-коды и лишние символы
            result.infoQaUrl = infoQaUrlMatch[0]
                .replace(/INFO QA:\s*/, '')
                .replace(/\x1b\[[0-9;]*m/g, '') // Удаляем ANSI escape-коды
                .trim();
        }

        return result;
    }
}
