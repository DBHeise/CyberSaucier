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

//Read all JSON files from the specified folder
const loadRecipes = async (folder) => {
    fs.readdir(folder, (err, files) => {
        files.forEach(file => {
            if (file.endsWith('.json')) {
                let fullPath = path.join(folder, file)
                let content = fs.readFileSync(fullPath);
                let j = JSON.parse(content);
                list[j.name] = j.recipe
            }
        })
    })
}

const init = async () => {
    const recipeFolder = path.resolve(config.RecipeFolder);

    try {
        fs.accessSync(recipeFolder, fs.constants.R_OK);
    } catch (err) {
        //if the repo does not exist, clone it now
        await git('.').clone(config.RecipeGit, recipeFolder);
    }

    await git(recipeFolder).pull()
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