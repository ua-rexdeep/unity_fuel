export const Wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
export const vDist = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const deltaZ = z2 - z1;

    const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;
    const distance = Math.sqrt(distanceSquared);
    
    return distance;
};
export const LoadRopeTextures = async () => {
    RopeLoadTextures();
    while(!RopeAreTexturesLoaded()) await Wait(10);
    RopeLoadTextures();
};
export const LoadModel = async (modelName: string) => {
    if(!IsModelValid(modelName)) throw new Error(`Model '${modelName}' is not valid`);
    RequestModel(modelName);
    while(!HasModelLoaded(modelName)) await Wait(10);
    return modelName;
};
export const EventName = (suffix: string) => `UnityFuel::${suffix}`;
export function DrawText3D(x: number, y: number, z: number, text: string, r = 255, g = 255, b = 255) {   
    const [onScreen, _x, _y] = World3dToScreen2d(x, y, z);
    if(onScreen){
        SetTextScale(0.25, 0.25);
        SetTextFont(0);
        SetTextColour(r, g, b, 255);
        SetTextOutline();
        SetTextEntry('STRING');
        SetTextCentre(true);
        AddTextComponentString(text);
        DrawText(_x, _y);
    }
}
export class Vector3 {
    constructor(public x: number, public y: number, public z: number, public h?: number) {}
    static fromArray([x, y, z]: number[]) {
        return new this(x,y,z);
    }

    toObject() {
        return { x: this.x, y: this.y, z: this.z };
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    static fromXYZ({x,y,z}: { x: number, y: number, z: number }) {
        return new this(x,y,z);
    }
}

function* generator() {
    while (true) {
        const random = Math.random()
            .toString(16)
            .slice(2, 10);
        yield `0x${random}`;
    }
}
  
const preload = (knowObjects: any, refs: any, generate: any) => (reference = false) => {
    if (reference) {
        return refs;
    } else {
        return (obj: any) => {
            let address;
            if (knowObjects.has(obj)) {
                address = knowObjects.get(obj);
            } else {
                address = generate.next().value;
                knowObjects.set(obj, address);
                refs[address] = obj;
            }
            return address;
        };
    }
};
  
const setup = preload(new Map(), {}, generator());

/**
 * !!DEV ONLY
 * @deprecated
 */
export const get_mem_addr = (variable: any) => setup(false)(variable);