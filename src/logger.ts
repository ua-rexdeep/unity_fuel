export class Logger {
    private readonly title: string;

    constructor(title: string, ...args) {
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
        const strs = args.filter((str) => typeof(str) != 'object');
        const objs = args.filter((str) => typeof(str) == 'object');
        console.log(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), strs.map((a) => Logger.white(a)).join(' '));
        if(objs.length) objs.forEach((obj) => console.log('^4', obj, '^0'));
    }

    Warn(...args) {
        const strs = args.filter((str) => typeof(str) != 'object');
        const objs = args.filter((str) => typeof(str) == 'object');
        console.warn(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), strs.map((a) => Logger.yellow(a)).join(' '));
        if(objs.length) objs.forEach((obj) => console.log('^4', obj, '^0'));
    }

    Error(...args) {
        const strs = args.filter((str) => typeof(str) != 'object');
        const objs = args.filter((str) => typeof(str) == 'object');
        console.error(Logger.cyan(`[${new Date().toLocaleTimeString()}]`), Logger.magenta(`[${this.title}]`), strs.map((a) => Logger.red(a)).join(' '));
        if(objs.length) objs.forEach((obj) => console.log('^4', obj, '^0'));
    }
}