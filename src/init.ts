import readline from "readline";
import { createClient } from 'redis';
import _log from './lib/logger';

export async function init() {
    console.log(`机器人准备运行，正在初始化`);

    global._path = process.cwd();
    global.log = _log;

    log.info(`初始化：正在连接数据库`);
    global.redis = createClient({
        socket: { host: "127.0.0.1", port: 6379, },
        database: 0,
    });
    await global.redis.connect().then(() => {
        log.info(`初始化：redis数据库连接成功`);
    }).catch(err => {
        log.error(`初始化：redis数据库连接失败，正在退出程序\n${err}`);
        process.exit();
    });

    global.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    global.rl.setPrompt("等候指令中> ");
}