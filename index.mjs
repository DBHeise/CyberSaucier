'use strict';

import fs from 'fs';
import path from 'path';
import Hapi from 'hapi';
import inert from 'inert';
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

//POST - runs the request body as a payload against ALL recipies
server.route({
    method: "POST",
    path: "/",
    handler: (request, h) => {
        var input = request.payload
        return new Promise((resolve, reject) => {
            let recipies = [];            
            for (let field in list) { recipies.push(field) }
            let ovens = recipies.map((name) => {
                return cChef.bake(input, list[name]).then((baked) => {
                    return {
                        'recipeName': name,
                        'result' : baked.result
                    }
                })
            })
            Promise.all(ovens).then((results) => {
                resolve(results);
            }).catch(reject);
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
                cChef.bake(input, recipe).then(r => {
                    resolve(r.result);
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
                        list[j.name] = j.recipe
                    }
                }
            })
        })
    })
}


const sparseRepo = async(localFolder, remoteGit, sparseFolder) => {
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

const fullRepo = async(localFolder, remoteGit) => {
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

    await loadRecipes(recipeFolder)
    await server.register(inert);
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();