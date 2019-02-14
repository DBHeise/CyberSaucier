'use strict';

import cluster from 'cluster';
import os from 'os';
import Service from './service';

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});


if (cluster.isMaster) {
    var debug = process.execArgv.indexOf('--debug') !== -1;
    cluster.setupMaster({
      execArgv: process.execArgv.filter(function(s) { return s !== '--debug' })
    });

    let numCPUs = os.cpus().length;
    let numThreads = numCPUs / 4;
    console.log(`CPU Count: ${numCPUs}, Thread Count: ${numThreads}`)

    cluster.on('online', (worker) => {
        worker.on('message', msg => {
            console.log(msg)
        })
    })

    for (let i = 0; i < numThreads; i++) {
        cluster.fork()
    }


    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died, restarting`);
        cluster.fork();
    });

} else {
    console.log("Creating Service")
    let s = new Service()
    
    const run = async(srv) => {
        
        console.log("Initializing Service")
        await srv.Init()

        console.log("Starting Service")
        await srv.Start()
    }
    run(s)
}
