'use strict';

import cluster from 'cluster';
import os from 'os';
import path from 'path';
import Service from './service';
import git from 'simple-git';
import config from './cybersaucier.json';

const MESSAGE_UPDATEDREPO = "UpdatedRepo"
process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

let children = []


function childMsgHandler(msg) {
    console.log("Master recieved a message: " + JSON.stringify(msg))
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
    var debug = process.execArgv.indexOf('--debug') !== -1;
    cluster.setupMaster({
        execArgv: process.execArgv.filter(function (s) { return s !== '--debug' })
    });

    let numCPUs = os.cpus().length;
    let numThreads = numCPUs / 4;
    console.log(`CPU Count: ${numCPUs}, Thread Count: ${numThreads}`)

    for (let i = 0; i < numThreads; i++) {
        children.push(startChild())
    }
    let gitWorker = startChild({ "CyberSaucier_Mode": "gitonly" })    

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died, restarting`);
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
    console.log("Creating Service")
    let s = new Service()
    const IsGitMode = process.env.CyberSaucier_Mode || false;
    if (IsGitMode) {

        const gitrun = async (srv) => {
            console.log("Initializing Git")
            await s.InitGit()
            process.send({ "MESSAGE": MESSAGE_UPDATEDREPO })

            const recipeFolder = path.resolve(config.RecipeFolder);
            const doGitCheck = async() => {
                console.log("Checking for updates from git repo")
                git(recipeFolder).silent(true).pull((err, update) => {                                        
                    if (err) {
                        console.error("ERROR pulling from git: " + JSON.stringify(err))
                    }
                    if (update) {
                        process.send({ "MESSAGE": MESSAGE_UPDATEDREPO, "Update": update })
                    }
                    setTimeout(doGitCheck, config.GitInterval)    
                })                                
            }
            if (config.GitInterval > 0) {
                setTimeout(doGitCheck, config.GitInterval)
            }
        }
        gitrun(s)
    } else {

        const run = async (srv) => {

            process.on('message', function (msg) {
                if (msg && msg.MESSAGE && msg.MESSAGE === MESSAGE_UPDATEDREPO) {
                    let update = msg.Update
                    srv.UpdateRecipies(update);
                }
            })

            console.log("Initializing Service")
            await srv.Init()

            console.log("Starting Service")
            await srv.Start()


        }
        run(s)
    }
}
