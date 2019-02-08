'use strict';

import cluster from 'cluster';
import os from 'os';
import fs from 'fs';
import path from 'path';
import Hapi from 'hapi';
import inert from 'inert';
import pino from 'hapi-pino';
import cChef from 'cyberchef/src/node/index';
import git from 'simple-git';
import config from './cybersaucier.json';


const server = Hapi.server({
    port: config.Port,
    host: config.ListenIP
});

let list = {}

//Default Route - standard CyberChef page
server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
        return h.file(config.DefaultFile)
    }
});

//POST - runs the request body as a payload against ALL recipes
server.route({
    method: "POST",
    path: "/",
    handler: (request, h) => {
        var input = request.payload
        return new Promise((resolve, reject) => {
            let recipes = [];
            for (let field in list) { recipes.push(field) }
            let ovens = recipes.map((name) => {
                return cChef.bake(input, list[name].recipe).then((baked) => {
                    let rObj = {'recipeName' : name}
                    if (baked.error || baked.progress < 1) {
                        rObj['error'] = baked
                    } else {                        
                        rObj['result'] = baked.result

                        //Add recipe meta data
                        for (const key in list[name]["meta"]) {
                            if (list[name]["meta"].hasOwnProperty(key)) {
                                rObj[key] = list[name]["meta"][key];
                            }
                        }
                    }

                    return rObj
                }).catch(err => {
                    return err
                })
            })
            Promise.all(ovens).then((results) => {
                resolve(results);
            })
        })
    }
})

//POST - runs the request body against the specified recipe
server.route({
    method: "POST",
    path: "/{name}",
    handler: (request, h) => {
        var input = request.payload
        const recipe = list[request.params.name];
        if (typeof recipe === "undefined" || recipe === null || recipe === "") {
            let r = h.response('Invalid recipe name');
            r.statusCode = 406;
            return r
        } else {
            return new Promise((resolve, reject) => {
                cChef.bake(input, recipe.recipe).then(r => {
                    let rObj = {
                        'recipeName': name,
                        'result': r.result
                    }
                    //Add recipe meta data
                    for (const key in recipe["meta"]) {
                        if (list[name]["meta"].hasOwnProperty(key)) {
                            rObj[key] = recipe["meta"][key];
                        }
                    }
                    return rObj
                }).catch(err => {
                    return err
                })
            })
        }
    }
})

//Retrieves the list of recipe names
server.route({
    method: "GET",
    path: "/recipes",
    handler: (request, h) => {
        let ary = [];
        for (let field in list) {
            ary.push(field)
        }
        return ary;
    }
})

//Retrieves the specified recipe 
server.route({
    method: "GET",
    path: "/recipes/{name}",
    handler: (request, h) => {
        let recipe = list[request.params.name];
        if (typeof recipe === "undefined" || recipe === null || recipe === "") {
            let r = h.response('Invalid recipe name');
            r.statusCode = 406;
            return r;
        } else {
            return recipe;
        }
    }
})

//Read all JSON files from the specified folder (and subfolders)
const loadRecipes = async (folder) => {
    fs.readdir(folder, (err, files) => {
        files.forEach(file => {
            let fullPath = path.join(folder, file)
            fs.stat(fullPath, (e, f) => {
                if (f.isDirectory()) {
                    loadRecipes(fullPath)
                } else {
                    if (file.endsWith('.json')) {

                        let content = fs.readFileSync(fullPath);
                        let j = JSON.parse(content);
                        list[j.name] = j
                    }
                }
            })
        })
    })
}


const sparseRepo = async (localFolder, remoteGit, sparseFolder) => {
    try {
        fs.accessSync(localFolder, fs.constants.R_OK);
        console.log(`Local git folder exists: ${localFolder}`)
    } catch (err) {
        //if the repo does not exist, clone it now
        console.log(`Setting up sparse checkout locally: ${localFolder}`)
        await git('.').clone(remoteGit, localFolder, ["--no-checkout"])
        let g = git(localFolder)
        g.addConfig("core.sparsecheckout", "true")
        fs.writeFileSync(path.join(localFolder, ".git/info/sparse-checkout"), sparseFolder)
    }

    console.log(`Checkingout Latest`)
    await git(localFolder).checkout("--")
}

const fullRepo = async (localFolder, remoteGit) => {
    try {
        fs.accessSync(localFolder, fs.constants.R_OK);
        console.log(`Local git folder exists: ${localFolder}`)
    } catch (err) {
        //if the repo does not exist, clone it now
        console.log(`Cloning repo locally: ${localFolder}`)
        await git('.').clone(remoteGit, localFolder);
    }

    console.log(`Pulling Latest`)
    await git(localFolder).pull()
}

const init = async () => {

    const recipeFolder = path.resolve(config.RecipeFolder);

    if (config.RecipeGit) {
        if (config.RecipeGitSparse && config.RecipeGitSparse.length > 0) {
            await sparseRepo(recipeFolder, config.RecipeGit, config.RecipeGitSparse)
        } else {
            await fullRepo(recipeFolder, config.RecipeGit)
        }
    }

    await loadRecipes(recipeFolder);

    await server.register(inert);
    await server.register(pino);

    await server.start();
    console.log(`Server running at: ${server.info.uri}`);

}

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});


if (cluster.isMaster) {
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
    init();
}
