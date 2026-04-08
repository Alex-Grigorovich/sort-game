/**
 * Module for managing logs and their formatting
 */
export class LogManager {
    private logContent: HTMLElement | null = null;
    private logSummaryText: HTMLElement | null = null;

    constructor(logContent: HTMLElement | null, logSummaryText: HTMLElement | null) {
        this.logContent = logContent;
        this.logSummaryText = logSummaryText;
    }

    /**
     * Adds log to interface
     */
    appendLog(msg: string, type?: 'error' | 'warn' | 'success') {
        if (!this.logContent || !this.logSummaryText) return;

        // Filter logs - show only important messages
        if (this.shouldShowLog(msg)) {
            const line = document.createElement('div');

            // Format message for better display
            const formattedMsg = this.formatLogMessage(msg);
            line.textContent = formattedMsg;

            // Determine message type by content
            const messageType = this.determineLogType(msg, type);
            if (messageType === 'error') line.classList.add('log-error');
            else if (messageType === 'warn') line.classList.add('log-warn');
            else if (messageType === 'success') line.classList.add('log-success');
            else if (messageType === 'info') line.classList.add('log-info');

            this.logContent.appendChild(line);
            line.classList.add('fade-in');
        }

        // Update preview only for important messages
        if (this.shouldShowLog(msg)) {
            const preview = msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
            this.logSummaryText.textContent = preview;
        }
        this.logContent.scrollTo({ top: this.logContent.scrollHeight, behavior: 'smooth' });
    }

    /**
     * Clears all logs
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
     * Determines whether to show log in interface
     */
    private shouldShowLog(msg: string): boolean {
        // Show structured logs with keys
        if (msg.includes('[SUPERHTML_') || msg.includes('[SFTP_') || msg.includes('[MAINBUILD_')) {
            return true;
        }

        // Show important messages
        if (msg.includes('error') || msg.includes('Error') || msg.includes('ERROR')) {
            return true;
        }

        if (msg.includes('success') || msg.includes('Success') || msg.includes('SUCCESS')) {
            return true;
        }

        if (msg.includes('warning') || msg.includes('Warning') || msg.includes('WARNING')) {
            return true;
        }

        // Show stage completion messages
        if (msg.includes('completed') || msg.includes('finished')) {
            return true;
        }

        // Hide technical messages
        if (msg.includes('debug:') || msg.includes('verbose:') || msg.includes('trace:')) {
            return false;
        }

        // Hide module loading messages
        if (msg.includes('Loading') || msg.includes('loading') || msg.includes('require(')) {
            return false;
        }

        // Hide temporary file messages
        if (msg.includes('temp') || msg.includes('tmp') || msg.includes('.cache')) {
            return false;
        }

        return true;
    }

    /**
     * Formats log message for better display
     */
    private formatLogMessage(msg: string): string {
        // Remove timestamps and extra spaces
        let formatted = msg.trim();



        // Format structured logs
        if (formatted.includes('[SUPERHTML_PROGRESS]')) {
            const match = formatted.match(/\[SUPERHTML_PROGRESS\] (\d+)% (.+)/);
            if (match) {
                return `[${match[1]}%] ${match[2]}`;
            }
        }

        if (formatted.includes('[SUPERHTML_SUCCESS]')) {
            // Parse messages with time and size details
            const detailedMatch = formatted.match(/\[SUPERHTML_SUCCESS\]\s*([^(]+)\s*\(([^)]+)\)\s*завершен\s*за\s*([\d.]+)s,\s*размер:\s*([\d.]+)KB/);
            if (detailedMatch) {
                const versionName = detailedMatch[1].trim();
                const langCode = detailedMatch[2].trim();
                const buildTime = parseFloat(detailedMatch[3]);
                const sizeKB = parseFloat(detailedMatch[4]);

                return `✓ ${versionName} (${langCode}) completed in ${buildTime}s, size: ${sizeKB}KB`;
            }

            // Parse simple messages without details
            const simpleMatch = formatted.match(/\[SUPERHTML_SUCCESS\]\s*(.+)/);
            if (simpleMatch) {
                return `✓ ${simpleMatch[1].trim()}`;
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
                return `→ ${match[1]} completed`;
            }
        }

        if (formatted.includes('[SUPERHTML_INFO]')) {
            const match = formatted.match(/\[SUPERHTML_INFO\] (.+)/);
            if (match) {
                return `ℹ ${match[1]}`;
            }
        }

        // Remove emojis and extra characters from regular messages
        formatted = formatted.replace(/[⏳🎉✅❌⚠️📦🕓]/g, '');
        formatted = formatted.replace(/\s+/g, ' ').trim();

        return formatted;
    }

    /**
     * Determines log message type
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
     * Parses URLs from logs
     */
    parseUrlsFromLog(msg: string): { infoUrl?: string; infoQaUrl?: string } {
        const result: { infoUrl?: string; infoQaUrl?: string } = {};

        // Regular expression for searching info.html URL (considering ANSI escape codes)
        const infoUrlMatch = msg.match(/INFO:[\s\S]*?https:\/\/[^\s\[\]]+info\.html/);
        if (infoUrlMatch) {
            // Remove ANSI escape codes and extra characters
            result.infoUrl = infoUrlMatch[0]
                .replace(/INFO:\s*/, '')
                .replace(/\x1b\[[0-9;]*m/g, '') // Удаляем ANSI escape-коды
                .trim();
        }

        // Regular expression for searching info-qa.html URL (considering ANSI escape codes)
        const infoQaUrlMatch = msg.match(/INFO QA:[\s\S]*?https:\/\/[^\s\[\]]+info-qa\.html/);
        if (infoQaUrlMatch) {
            // Remove ANSI escape codes and extra characters
            result.infoQaUrl = infoQaUrlMatch[0]
                .replace(/INFO QA:\s*/, '')
                .replace(/\x1b\[[0-9;]*m/g, '') // Удаляем ANSI escape-коды
                .trim();
        }

        // Additional patterns: look for URLs that might come in separate messages
        // Look for any https URL containing info.html
        const directInfoUrlMatch = msg.match(/https:\/\/[^\s\[\]]+info\.html/);
        if (directInfoUrlMatch && !result.infoUrl) {
            result.infoUrl = directInfoUrlMatch[0]
                .replace(/\x1b\[[0-9;]*m/g, '') // Удаляем ANSI escape-коды
                .trim();
        }

        // Look for any https URL containing info-qa.html
        const directInfoQaUrlMatch = msg.match(/https:\/\/[^\s\[\]]+info-qa\.html/);
        if (directInfoQaUrlMatch && !result.infoQaUrl) {
            result.infoQaUrl = directInfoQaUrlMatch[0]
                .replace(/\x1b\[[0-9;]*m/g, '') // Удаляем ANSI escape-коды
                .trim();
        }

        return result;
    }
}
