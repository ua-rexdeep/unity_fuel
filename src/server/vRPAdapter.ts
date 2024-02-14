type Callback = (...retArgs: unknown[]) => void;

const ids = {};

export const Adapter = {
    getInterface: (name) => new Proxy({ name }, {
        get: proxy_resolve,
    })
};
const proxy_resolve = (obj, funcName) => (...args: NonNullable<any>) => new Promise((done: Callback) => {
    
    TriggerEvent(`${obj.name}:proxy`, funcName, [...args], (...re: any[]) => {
        done(...re);
    });
});

export const ClientAdapter = {
    getInterface: (name, identifier) => new Proxy({ name, identifier }, {
        get: client_proxy_resolve,
    })
};

const tunnel_return = (rid, args) => {
    if(rid in ids) {
        ids[rid](args);
        delete ids[rid];
    }
};

const client_proxy_resolve = (obj, funcName: string) => {
    
    onNet(`${obj.name}:${obj.identifier}:tunnel_res`, tunnel_return);
    on(`${obj.name}:${obj.identifier}:tunnel_res`, tunnel_return);

    return (source: number, ...args: NonNullable<any>) => new Promise((done: Callback) => {

        let id = Date.now();
        while(ids[id] != null) {
            id++;
        }

        ids[id] = done;

        emitNet(`${obj.name}:tunnel_req`,source,funcName,args,obj.identifier, id);
    });
};