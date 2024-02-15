export class Logger {
    private readonly title: string;

    constructor(title: string, ...args: string[]) {
        this.title = title;
        if(args.length) this.Log(...args);
        else this.Log('Logger');
    };

    static color(c, text) { return `^${c}${text}^0`; }

    static white(args: string | number | boolean) { return Logger.color(0, args); }
    static red(args: string | number | boolean) { return Logger.color(1, args); }
    static green(args: string | number | boolean) { return Logger.color(2, args); }
    static yellow(args: string | number | boolean) { return Logger.color(3, args); }
    static blue(args: string | number | boolean) { return Logger.color(4, args); }
    static cyan(args: string | number | boolean) { return Logger.color(5, args); }
    static magenta(args: string | number | boolean) { return Logger.color(6, args); }
    static darkred(args: string | number | boolean) { return Logger.color(8, args); }
    static darkblue(args: string | number | boolean) { return Logger.color(9, args); }

    Log(...args) {
        if(args.some((a) => typeof(a) == 'object')) {
            console.log(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), ...args.map((a) => Logger.white(a)));
        }
        else console.log(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), args.map((a) => Logger.white(a)).join(' '));
    }

    Warn(...args) {
        
        if(args.some((a) => typeof(a) == 'object')) {
            console.warn(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), ...args.map((a) => Logger.yellow(a)));
        }
        else console.warn(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), args.map((a) => Logger.yellow(a)).join(' '));
    }

    Error(...args) {
        
        if(args.some((a) => typeof(a) == 'object')) {
            console.error(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), ...args.map((a) => Logger.red(a)));
        }
        else console.error(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), args.map((a) => Logger.red(a)).join(' '));
    }
}