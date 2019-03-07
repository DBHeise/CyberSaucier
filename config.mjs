import cfg from './cybersaucier.json';

for (const key in cfg) {
    if (cfg.hasOwnProperty(key)) {
        const envVal = process.env["CYBERSAUCIER_" + key]
        if (envVal) {
            cfg[key] = envVal;
        }        
    }
}

export default cfg