'use strict';

import fs from 'fs';
import path from 'path';
import Hapi from 'hapi';
import inert from 'inert';
import pino from 'hapi-pino';
import cChef from 'cyberchef/src/node/index';
import git from 'simple-git';
import config from './cybersaucier.json';

class Service {
    constructor(options) {
        this.cfg = options || config;

        this.server = new Hapi.server({
            port: this.cfg.Port,
            host: this.cfg.ListenIP
        })
        this.server.self = this
        this.list = {}
    }

    async Init() {
        this.server.route({ method: "GET", path: "/", handler: this.handlerGetStaticFile })
        this.server.route({ method: "POST", path: "/", handler: this.handlerAllRecipes })
        this.server.route({ method: "POST", path: "/{name}", handler: this.handlerOneRecipe })
        this.server.route({ method: "GET", path: "/recipes", handler: this.handlerListRecipes })
        this.server.route({ method: "GET", path: "/recipes/{name}", handler: this.handlerListOneRecipe })

        const recipeFolder = path.resolve(this.cfg.RecipeFolder);

        if (this.cfg.RecipeGit) {
            if (this.cfg.RecipeGitSparse && this.cfg.RecipeGitSparse.length > 0) {
                await this.setupSparseRepo(recipeFolder, this.cfg.RecipeGit, this.cfg.RecipeGitSparse)
            } else {
                await this.setupFullRepo(recipeFolder, this.cfg.RecipeGit)
            }
        }

        await this.loadRecipes(recipeFolder);
        await this.server.register(inert);
        
        if (!(this.cfg.DisableLogging)) {
            await this.server.register(pino);
        }
    }

    async Start() {
        await this.server.start();
        console.log(`Server running at: ${this.server.info.uri}`);
    }

    //Default Route - static configured file
    handlerGetStaticFile(request, h) {
        let self = request.server.self;
        return h.file(self.cfg.DefaultFile)
    }

    //POST - runs the request body as a payload against ALL recipes
    handlerAllRecipes(request, h) {
        let self = request.server.self;
        let input = request.payload
        return new Promise((resolve, reject) => {
            let recipes = [];

            let ovens = recipes.map((name) => {
                return cChef.bake(input, self.list[name].recipe).then((baked) => {
                    let rObj = { 'recipeName': name }
                    if (baked.error || baked.progress < 1) {
                        rObj['error'] = baked
                    } else {
                        rObj['result'] = baked.result

                        //Add recipe meta data
                        for (const key in self.list[name]["meta"]) {
                            if (self.list[name]["meta"].hasOwnProperty(key)) {
                                rObj[key] = self.list[name]["meta"][key];
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

    //POST - runs the request body against the specified recipe
    handlerOneRecipe(request, h) {
        let self = request.server.self;
        let input = request.payload
        const recipe = self.list[request.params.name];
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
                        if (self.list[name]["meta"].hasOwnProperty(key)) {
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

    //Retrieves the list of recipe names
    handlerListRecipes(request, h) {
        let ary = [];
        let self = request.server.self;
        for (let field in self.list) {
            ary.push(field)
        }
        return ary;
    }

    //Retrieves the specified recipe 
    handlerListOneRecipe(request, h) {
        let self = request.server.self;
        let recipe = self.list[request.params.name];
        if (typeof recipe === "undefined" || recipe === null || recipe === "") {
            let r = h.response('Invalid recipe name');
            r.statusCode = 406;
            return r;
        } else {
            return recipe;
        }
    }

    //Read all JSON files from the specified folder (and subfolders)
    async loadRecipes(folder) {
        fs.readdir(folder, (err, files) => {
            files.forEach(file => {
                let fullPath = path.join(folder, file)
                fs.stat(fullPath, (e, f) => {
                    if (f.isDirectory()) {
                        this.loadRecipes(fullPath)
                    } else {
                        if (file.endsWith('.json')) {

                            let content = fs.readFileSync(fullPath);
                            let j = JSON.parse(content);
                            this.list[j.name] = j
                        }
                    }
                })
            })
        })
    }


    async setupSparseRepo(localFolder, remoteGit, sparseFolder) {
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

    async setupFullRepo(localFolder, remoteGit) {
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

}




export default Service