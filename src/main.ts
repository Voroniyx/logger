import winston from 'winston';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export interface LoggerOptions {
    /*
    * Whether to also log to a file
    *
    * Default: false
    */
    logToFile?: boolean;
    /*
    * Relativ path for the log dir when `logToFile` is `true`
    *
    * Default: `logs`
    */
    logDir?: string;
    /*
    * The file name for the log file
    *
    * Default: `Date.now()` when the instance is created
    */
    logFile?: string;
    /*
    * Optional information in the log message
    *
    * Default: `Manager`
    */
    instance?: string;
    /*
    * Whether to also create a .gitignore in the log directory
    *
    * Default: true
    */
    withGitIgnore?: boolean;
}

interface LogMetadata {
    newInstance?: number | undefined | string;
    level?: 'info' | 'warning' | 'error';
    error?: Error | undefined;
    stack?: string | undefined;
}


export default class Logger {
    private readonly logger: winston.Logger;

    constructor(_logger: winston.Logger) {
        this.logger = _logger;
    }

    private static genLogDir(logDir: string, withGitIgnore: boolean = true) {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);

            if (withGitIgnore) {
                const gitignorePath = path.join(logDir, '.gitignore');
                const gitignoreContent = '*.log';
                fs.writeFileSync(gitignorePath, gitignoreContent);
            }
        }
    }

    /**
     *
     * @param message
     * @param instance when instance is a string, it will overwrite the default instance, set when created this logger instance,
     * and use this one. when it's a number it's the cluster id and will display like this: `Cluster {id}`
     */
    public info(message: string, instance?: number | string) {
        this.logger.log('info', message, {newInstance: instance});
    }

    /**
     *
     * @param message
     * @param instance when instance is a string, it will overwrite the default instance, set when created this logger instance,
     * and use this one. when it's a number it's the cluster id and will display like this: `Cluster {id}`
     */
    public warn(message: string, instance?: number | string) {
        this.logger.log('warn', message, {newInstance: instance});
    }

    /**
     *
     * @param message
     * @param cluster display: `Cluster {id}`
     * @param error
     */
    public error(message: string, cluster: number, error: Error): void;
    public error(message: string, error: Error): void;
    public error(
        message: string,
        arg2: number | Error | undefined = undefined,
        arg3: Error | undefined = undefined,
    ): void {
        let cluster: number | undefined;
        let error: Error | undefined;

        if (typeof arg2 === 'number' && arg3 instanceof Error) {
            cluster = arg2;
            error = arg3;
        } else if (arg2 instanceof Error) {
            cluster = undefined;
            error = arg2;
        }

        this.logger.log('error', message, {cluster, error, stack: error?.stack});
    }


    private static colorize(message: string, level: string) {
        switch (level) {
            case 'error':
                return chalk.red(message);
            case 'warn':
                return chalk.yellow(message);
            case 'info':
                return chalk.blue(message);
            case 'http':
                return chalk.green(message);
            default:
                return chalk.blue(message);
        }
    }


    public static build(options: LoggerOptions) {
        const consoleFormat = winston.format.printf(
            (
                {
                    timestamp,
                    level,
                    message,
                    ...meta
                }: winston.Logform.TransformableInfo) => {
                const str = Logger.createBaseFormat(options, {timestamp, level, message, ...meta});

                return Logger.colorize(str, level);
            }
        );

        const fileFormat = winston.format.printf(
            (
                {
                    timestamp,
                    level,
                    message,
                    ...meta
                }: winston.Logform.TransformableInfo) => {
                return Logger.createBaseFormat(options, {timestamp, level, message, ...meta});
            }
        );

        const transports: winston.transport[] = [
            new winston.transports.Console({
                format: consoleFormat,
            }),
        ];

        if (options.logToFile) {
            Logger.genLogDir(options.logDir ?? 'logs', options.withGitIgnore ?? true);
            transports.push(new winston.transports.Stream({
                stream: fs.createWriteStream(path.join(options.logDir ?? 'logs', options.logFile ?? Date.now() + '.logs'), {flags: 'a'}),
                format: fileFormat,
            }));
        }

        const log = winston.createLogger({
            level: "http",
            exitOnError: false,
            handleRejections: true,
            handleExceptions: true,
            format: winston.format.combine(
                winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
                winston.format.errors({stack: true}), // Include stack traces if present
            ),
            transports: transports,
        });

        return new Logger(log);
    }

    private static createBaseFormat(
        options: LoggerOptions,
        {
            timestamp,
            level,
            message,
            ...meta
        }: winston.Logform.TransformableInfo) {
        const {newInstance, error, stack} = meta as LogMetadata;
        let instance = "Manager";

        if (typeof (newInstance) === "string") {
            instance = newInstance;
        } else if (typeof (newInstance) === "number") {
            instance = `Cluster ${newInstance}`;
        } else if (options.instance) {
            instance = options.instance;
        }

        const errorDetails = error
            ? `${stack ? `\nStack: ${stack}` : ''}`
            : '';

        let prefix = `[${timestamp}] [${instance}]`;

        const fillUpSpaces = prefix.length >= 39 ? '' : Logger.repeatChar(' ', 39 - prefix.length);

        prefix += fillUpSpaces;
        prefix += `: ${message}${errorDetails}`;

        return prefix;
    }

    private static repeatChar(char: string, times: number): string {
        let result = "";
        for (let i = 0; i < times; i++) {
            result += char;
        }
        return result;
    }
}
