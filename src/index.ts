
import { init } from "./init";



init().then(() => {
    const argv = process.argv;
    //log.debug(argv);

    global.rl.prompt();
    global.rl.on("line", (input: string) => {
        log.debug(input);
        global.rl.prompt();
    });

});

