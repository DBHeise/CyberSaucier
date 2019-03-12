'use strict';

import chalk from 'chalk'
import config from './config'

const LogLevels = {
    All: 0,
    Trace: 15,
    Debug: 33,
    Info: 50,
    Warn: 75,
    Error: 90,
    Fatal: 100,
}

const colorMap = {}
colorMap[LogLevels.All] = chalk.gray;
colorMap[LogLevels.Trace] = chalk.blue;
colorMap[LogLevels.Debug] = chalk.green;
colorMap[LogLevels.Info] = chalk.whiteBright;
colorMap[LogLevels.Warn] = chalk.yellowBright;
colorMap[LogLevels.Error] = chalk.magentaBright;
colorMap[LogLevels.Fatal] = chalk.bold.redBright;


class Logger {
    constructor(classname, lvl) {
        this.classname = classname
        this.currentLogLevel = lvl
    }

    printmsg(level, msgObj) {
        if (level >= this.currentLogLevel) {
            var timestamp = new Date().toISOString()
            var className = this.classname
            var msg = msgObj
            var msg = `${timestamp} - ${className} - ${msg}`;
            msg = colorMap[level](msg)
            console.log(msg)
        }
    }

    Trace(msgObj) {
        this.printmsg(LogLevels.Trace, msgObj)
    }
    Debug(msgObj) {
        this.printmsg(LogLevels.Debug, msgObj)
    }
    Info(msgObj) {
        this.printmsg(LogLevels.Info, msgObj)
    }
    Warn(msgObj) {
        this.printmsg(LogLevels.Warn, msgObj)
    }
    Error(msgObj) {
        this.printmsg(LogLevels.Error, msgObj)
    }
    Fatal(msgObj) {
        this.printmsg(LogLevels.Fatal, msgObj)
    }
}


const NewLog = (name) => {
    return new Logger(name, config.LogLevel)
}

export default NewLog