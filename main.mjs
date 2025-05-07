'use strict';

import cluster from 'cluster';
import os from 'os';
import path from 'path';
import Service from './service.mjs';
import git from 'simple-git';
import config from './config.mjs';
import logger from './logger.mjs';
const log = logger("main")

const MESSAGE_UPDATEDREPO = "UpdatedRepo"

process.on('unhandledRejection', (err) => {
    log.Error(err);
    process.exit(1);
});

let children = []


function childMsgHandler(msg) {
    log.Debug("Master recieved a message: " + JSON.stringify(msg))
    children.forEach(child => {
        child.send(msg);
    });
}

function startChild(env) {
    var worker = cluster.fork(env)
    worker.on('message', childMsgHandler)
    return worker;
}


if (cluster.isMaster) {
    log.Trace("Master started: " + JSON.stringify(config))
    var debug = process.execArgv.indexOf('--debug') !== -1;
    cluster.setupMaster({
        execArgv: process.execArgv.filter(function (s) { return s !== '--debug' })
    });

    let numCPUs = os.cpus().length;
    let numThreads = numCPUs;
    log.Debug(`CPU Count: ${numCPUs}, Thread Count: ${numThreads}`)

    for (let i = 0; i < numThreads; i++) {
        children.push(startChild())
    }
    let gitWorker = startChild({ "CyberSaucier_Mode": "gitonly" })    

    cluster.on('exit', (worker, code, signal) => {
        log.Debug(`worker ${worker.process.pid} died, restarting`);
        if (worker.process.pid == gitWorker.process.pid) {
            gitWorker = startChild({ "CyberSaucier_Mode": "gitonly" })
        } else {
            var workerIdx = children.indexOf(worker);
            if (workerIdx > -1) {
                children.splice(workerIdx, 1)
            }
            children.push(startChild())
        }
    });

} else {
    log.Info("Creating Service")
    let s = new Service()
    const IsGitMode = process.env.CyberSaucier_Mode || false;
    if (IsGitMode) {

        const gitrun = async (srv) => {
            log.Trace("Initializing Git")
            await s.InitGit()
            process.send({ "MESSAGE": MESSAGE_UPDATEDREPO })

            const recipeFolder = path.resolve(config.RecipeFolder);
            const doGitCheck = async() => {
                log.Debug("Checking for updates from git repo")
                git(recipeFolder).pull((err, update) => {                                        
                    if (err) {
                        log.Error("ERROR pulling from git: " + JSON.stringify(err))
                    }                    
                    if (update && update.files && update.files.length > 0) {
                        process.send({ "MESSAGE": MESSAGE_UPDATEDREPO, "Update": update })
                    } else {
                        log.Debug("No changes to git repo")
                    }
                    setTimeout(doGitCheck, config.GitInterval)    
                })                                
            }
            if (config.GitInterval > 0) {
                setTimeout(doGitCheck, config.GitInterval)
            }
        }
        if (config.RecipeGit && config.RecipeGit.length > 0) {
            gitrun(s)
        } 
    } else {

        const run = async (srv) => {

            process.on('message', function (msg) {
                if (msg && msg.MESSAGE && msg.MESSAGE === MESSAGE_UPDATEDREPO) {
                    let update = msg.Update
                    srv.UpdateRecipes(update);
                }
            })

            log.Debug("Initializing Service")
            await srv.Init()

            if (!config.RecipeGit || config.RecipeGit.length < 1) {
                await srv.InitGit()
            }

            log.Info("Starting Service")
            await srv.Start()


        }
        run(s)
    }
}
