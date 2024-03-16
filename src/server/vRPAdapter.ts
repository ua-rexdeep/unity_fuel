type Callback = (...retArgs: unknown[]) => void;

const ids: Record<number, any> = {};

export const Adapter = {
    getInterface: (name: string): vRPServerFunctions => new Proxy({ name }, {
        get: proxy_resolve,
    })
};
const proxy_resolve = (obj: any, funcName: string) => (...args: NonNullable<any>) => new Promise((done: Callback) => {
    
    TriggerEvent(`${obj.name}:proxy`, funcName, [...args], (...re: any[]) => {
        done(...re[0]);
    });
});

export const ClientAdapter = {
    getInterface: (name: string, identifier: string) => {
    
        onNet(`${name}:${identifier}:tunnel_res`, tunnel_return);
        on(`${name}:${identifier}:tunnel_res`, tunnel_return);
        
        return new Proxy({ name, identifier }, {
            get: client_proxy_resolve,
        });
    }
};

const tunnel_return = (rid: number, args: any) => {
    if(rid in ids) {
        ids[rid](args);
        delete ids[rid];
    }
};

const client_proxy_resolve = (obj: any, funcName: string) => (source: number, ...args: NonNullable<any>) => new Promise((done: Callback) => {

    let id = Date.now();
    while(ids[id] != null) {
        id++;
    }

    ids[id] = done;

    emitNet(`${obj.name}:tunnel_req`,source,funcName,args,obj.identifier, id);
});