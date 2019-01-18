'use strict';

import Hapi from 'hapi';
import inert from 'inert';
import cChef from 'cyberchef/src/node/index';

const server = Hapi.server({
    port: 7000,
    host: '0.0.0.0'
});

server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
       return h.file("cyberchef.htm")
    }
});


server.route({
    method:"POST",
    path: "/",
    handler: (request, h) => {
        var input = request.payload
        //const recipie =  [{"op":"Split","args":["%u",""]},{"op":"From Hex","args":["Auto"]},{"op":"Swap endianness","args":["Raw",2,true]}];
        const recipie = [{"op":"From Base64", "args": ["A-Za-z0-9+/=",true]}, {"op":"Decode text", "args":["UTF16LE (1200"]}];
        return new Promise((resolve, reject) => {
            cChef.bake(input, recipie).then (r => {            
                resolve(r.result);
            })    
        })
    }
})


const init = async() => {
    await server.register(inert);
    await server.start();
    console.log(`Server running at: ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();