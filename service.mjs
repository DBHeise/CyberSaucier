'use strict';

import fs from 'fs';
const fsPromises = fs.promises;
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
        this.fileMap = {}
    }

    async Init() {
        this.server.route({ method: "GET", path: "/", handler: this.handlerGetStaticFile })
        this.server.route({ method: "POST", path: "/", handler: this.handlerAllRecipes })
        this.server.route({ method: "POST", path: "/{name}", handler: this.handlerOneRecipe })
        this.server.route({ method: "GET", path: "/recipes", handler: this.handlerListRecipes })
        this.server.route({ method: "GET", path: "/recipes/{name}", handler: this.handlerListOneRecipe })

        const recipeFolder = path.resolve(this.cfg.RecipeFolder);
        await this.server.register(inert);

        if (!(this.cfg.DisableLogging)) {
            await this.server.register(pino);
        }
    }
    async InitGit() {
        const recipeFolder = path.resolve(this.cfg.RecipeFolder);

        if (this.cfg.RecipeGit) {
            if (this.cfg.RecipeGitSparse && this.cfg.RecipeGitSparse.length > 0) {
                await this.setupSparseRepo(recipeFolder, this.cfg.RecipeGit, this.cfg.RecipeGitSparse)
            } else {
                await this.setupFullRepo(recipeFolder, this.cfg.RecipeGit)
            }
        }
        await this.loadRecipes(recipeFolder);
    }

    async Start() {
        await this.server.start();
        console.log(`Server running at: ${this.server.info.uri}`);
    }

    UpdateRecipies(updateBlob) {
        let self = this
        const recipeFolder = path.resolve(self.cfg.RecipeFolder);        
        if (updateBlob) {
            let delta = updateBlob.files
            for (let i = 0; i < delta.length; i++) {                
                self.removeRecipe(path.resolve(recipeFolder, delta[i]))
            }
        }
        self.loadRecipes(recipeFolder)
    }

    //Default Route - static configured file
    handlerGetStaticFile(request, h) {
        let self = request.server.self;
        return h.file(self.cfg.DefaultFile)
    }

    filterRecipes(lst, nameMatch, fileMatch) {
        let ans = []
        for (let field in lst) {
            if (nameMatch || fileMatch) {
                if (nameMatch && fileMatch) {
                    if (field.indexOf(nameMatch) > -1 && lst[field].filename.indexOf(fileMatch) > -1) {
                        if (ans.indexOf(field) == -1) {
                            ans.push(field)
                        }
                    }
                } else {
                    if (field.indexOf(nameMatch) > -1) {
                        if (ans.indexOf(field) == -1) {
                            ans.push(field)
                        }
                    }
                    if (lst[field].filename.indexOf(fileMatch) > -1) {
                        if (ans.indexOf(field) == -1) {
                            ans.push(field)
                        }
                    }
                }
            } else {
                ans.push(field)
            }
        }
        return ans
    }

    handleCChefResults(baked, recipe) {
        let rObj = { 'recipeName': recipe.name }
        if (baked.error || baked.progress < 1) {
            rObj['error'] = baked
        } else {
            rObj['result'] = baked.result

            //Add recipe meta data
            for (const key in recipe["meta"]) {
                if (recipe["meta"].hasOwnProperty(key)) {
                    rObj[key] = recipe["meta"][key];
                }
            }
        }

        return rObj
    }

    //POST - runs the request body as a payload against ALL recipes
    handlerAllRecipes(request, h) {
        let self = request.server.self;
        let matcher = request.query["match"]
        let file = request.query["file"]
        let input = request.payload
        return new Promise((resolve, reject) => {
            let recipes = self.filterRecipes(self.list, matcher, file)
            let ovens = recipes.map((name) => {
                return cChef.bake(input, self.list[name].recipe).then((baked) => {
                    return self.handleCChefResults(baked, self.list[name])
                }).catch(err => {

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
            return cChef.bake(input, recipe.recipe).then(r => {
                return self.handleCChefResults(r, recipe)
            }).catch(err => {

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

    removeRecipe(fullPath) {
        let name = this.fileMap[fullPath]
        delete this.list[name];
    }

    loadRecipeFile(fullPath, fileName) {
        console.log("Loading Recipe: " + fullPath)
        let content = fs.readFileSync(fullPath);
        let j = JSON.parse(content);
        j.filename = fileName
        j.fullpath = fullPath
        this.list[j.name] = j
        this.fileMap[fullPath] = j.name
    }

    //Read all JSON files from the specified folder (and subfolders)
    async loadRecipes(folder) {
        let self = this
        try {
            const names = await fsPromises.readdir(folder)
            for (let i = 0; i < names.length; i++) {
                let fullPath = path.join(folder, names[i])
                const f = await fsPromises.stat(fullPath)
                if (f.isDirectory()) {
                    await self.loadRecipes(fullPath)
                } else {
                    if (names[i].endsWith(".json")) {
                        self.loadRecipeFile(fullPath, names[i])
                    }
                }
            }
        } catch (err) {
            console.error("Error occured while loading recipies", err);
        }
    }


    async setupSparseRepo(localFolder, remoteGit, sparseFolder) {
        try {
            fs.accessSync(localFolder, fs.constants.R_OK);
            console.log(`Local git folder exists: ${localFolder}`)
        } catch (err) {
            //if the repo does not exist, clone it now
            console.log(`Setting up sparse checkout locally: ${localFolder}`)
            await git('.').silent(true).clone(remoteGit, localFolder, ["--no-checkout"])
            let g = git(localFolder)
            g.addConfig("core.sparsecheckout", "true")
            fs.writeFileSync(path.join(localFolder, ".git/info/sparse-checkout"), sparseFolder)
        }

        console.log(`Checkingout Latest`)
        await git(localFolder).silent(true).checkout("--")
    }

    async setupFullRepo(localFolder, remoteGit) {
        try {
            fs.accessSync(localFolder, fs.constants.R_OK);
            console.log(`Local git folder exists: ${localFolder}`)
        } catch (err) {
            //if the repo does not exist, clone it now
            console.log(`Cloning repo locally: ${localFolder}`)
            await git('.').silent(true).clone(remoteGit, localFolder);
        }

        console.log(`Pulling Latest`)
        await git(localFolder).pull()
    }

}




export default Service